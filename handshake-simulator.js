/*
 * Robot-to-PLC four-way handshake simulator.
 * Original demonstration logic for the portfolio — no customer program is represented.
 *
 * Model: the PLC is the master. For each command it drives a four-way handshake with
 * the robot so that no signal edge can be missed if the two controllers scan at
 * different rates:
 *   1 REQUEST  PLC sets CMD_REQ (+ command code)
 *   2 ACK      Robot sets CMD_ACK (busy) and begins motion
 *   3 EXEC     Robot runs the move (CMD_ACK held)
 *   4 COMPLETE Robot sets CMD_DONE
 *   5 CLEAR    PLC sees DONE and clears CMD_REQ
 *   6 CLEARED  Robot sees REQ low and clears CMD_ACK / CMD_DONE -> next command
 */
(function () {
  "use strict";

  var TICK_MS = 720;
  var EXEC_TICKS = 2; // dwell to make the "motion" phase read as real work
  var CHART_LEN = 84;

  // Machine-tending command sequence (one full pass = one part cycled).
  var COMMANDS = [
    { code: "PICK_CNC", label: "Pick finished part from CNC" },
    { code: "PLACE_OUT", label: "Place part to outfeed" },
    { code: "PICK_IN", label: "Pick blank from infeed" },
    { code: "LOAD_CNC", label: "Load blank into CNC" }
  ];

  var PLC_SIGNALS = [
    { key: "REQ", label: "CMD_REQ" },
    { key: "AUTO", label: "AUTO_MODE" },
    { key: "RESET", label: "RESET" },
    { key: "HOLDREQ", label: "HOLD_REQ" },
    { key: "ABORT", label: "ABORT" }
  ];
  var ROBOT_SIGNALS = [
    { key: "ACK", label: "CMD_ACK" },
    { key: "DONE", label: "CMD_DONE" },
    { key: "FAULT", label: "ROBOT_FAULT", tone: "danger" },
    { key: "MOTION", label: "IN_MOTION" },
    { key: "HOME", label: "AT_HOME" }
  ];
  var FLAG_SIGNALS = [
    { key: "PART", label: "PART_PRESENT" },
    { key: "DOOR", label: "CNC_DOOR_OPEN" },
    { key: "AIR", label: "LOW_AIR_WARN", tone: "warn" },
    { key: "MAINT", label: "MAINT_DUE", tone: "warn" }
  ];
  // Rows drawn on the timing chart.
  var CHART_ROWS = [
    { key: "REQ", label: "REQ", color: "#1f6feb" },
    { key: "ACK", label: "ACK", color: "#2a8c63" },
    { key: "DONE", label: "DONE", color: "#20846e" },
    { key: "FAULT", label: "FAULT", color: "#a6423a" },
    { key: "HOLDREQ", label: "HOLD", color: "#b56b18" }
  ];

  // Displayed phase labels map to the four handshake wires (internal phase ids
  // skip 2 and 6, which are folded into transitions).
  var PHASE_TEXT = {
    0: "Ready",
    1: "1 · Request",
    3: "2 · Acknowledge",
    4: "3 · Complete",
    5: "4 · Clear"
  };

  var reduceMotion =
    !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // ---- state ------------------------------------------------------------
  var sig = {};
  var state = "IDLE"; // IDLE | RUN | HOLD | FAULT | FAULT_RESET | ABORTED
  var mode = "auto"; // auto | manual
  var phase = 0;
  var cmdIndex = 0;
  var cycles = 0;
  var execLeft = 0;
  var heartbeat = false;
  var chart = [];
  var els = {};

  function resetSignals() {
    [PLC_SIGNALS, ROBOT_SIGNALS, FLAG_SIGNALS].forEach(function (group) {
      group.forEach(function (s) { sig[s.key] = false; });
    });
    sig.HOME = true;
    sig.AUTO = mode === "auto";
  }

  // ---- DOM build --------------------------------------------------------
  function buildLeds(listEl, defs) {
    listEl.innerHTML = "";
    defs.forEach(function (def) {
      var li = document.createElement("li");
      li.className = "led-row";
      li.dataset.led = def.key;
      if (def.tone) li.dataset.tone = def.tone;
      var dot = document.createElement("span");
      dot.className = "led";
      var name = document.createElement("span");
      name.className = "led-name";
      name.textContent = def.label;
      var val = document.createElement("span");
      val.className = "led-val";
      val.textContent = "0";
      li.appendChild(dot);
      li.appendChild(name);
      li.appendChild(val);
      listEl.appendChild(li);
    });
  }

  function cacheEls() {
    els.stateChip = document.querySelector("[data-state-chip]");
    els.hb = document.querySelector("[data-hb]");
    els.canvas = document.querySelector("[data-chart]");
    els.ctx = els.canvas ? els.canvas.getContext("2d") : null;
    els.readout = {};
    ["mode", "command", "phase", "cycles", "message"].forEach(function (k) {
      els.readout[k] = document.querySelector('[data-readout="' + k + '"]');
    });
    els.wires = {};
    ["req", "ack", "done", "clear"].forEach(function (w) {
      els.wires[w] = document.querySelector('[data-wire="' + w + '"]');
    });
    els.plcNode = document.querySelector('[data-node="plc"]');
    els.robotNode = document.querySelector('[data-node="robot"]');
  }

  // ---- transitions ------------------------------------------------------
  function setMessage(text) { els.readout.message.textContent = text; }

  function currentCommand() { return COMMANDS[cmdIndex]; }

  function advancePhase() {
    // Only progresses the handshake; guarded by run() before calling.
    switch (phase) {
      case 0: // ready -> issue request
        sig.REQ = true;
        setMessage("PLC requests: " + currentCommand().label + ".");
        phase = 1;
        break;
      case 1: // robot acknowledges, starts motion
        sig.ACK = true;
        sig.MOTION = true;
        sig.HOME = false;
        execLeft = EXEC_TICKS;
        setMessage("Robot acknowledged — executing " + currentCommand().label + ".");
        phase = 3;
        break;
      case 3: // executing (dwell)
        if (execLeft > 0) { execLeft--; return; }
        sig.DONE = true;
        sig.MOTION = false;
        setMessage("Robot reports complete.");
        phase = 4;
        break;
      case 4: // PLC sees DONE, clears request
        sig.REQ = false;
        setMessage("PLC cleared the request.");
        phase = 5;
        break;
      case 5: // robot sees REQ low, clears its flags
        sig.ACK = false;
        sig.DONE = false;
        completeCommand();
        phase = 0;
        break;
      default:
        phase = 0;
    }
  }

  function completeCommand() {
    // Illustrative flag movement as the part progresses.
    var code = currentCommand().code;
    if (code === "PICK_CNC") { sig.PART = true; sig.DOOR = true; }
    else if (code === "PLACE_OUT") { sig.PART = false; }
    else if (code === "PICK_IN") { sig.PART = true; }
    else if (code === "LOAD_CNC") { sig.PART = false; sig.DOOR = false; }

    cmdIndex++;
    if (cmdIndex >= COMMANDS.length) {
      cmdIndex = 0;
      cycles++;
      // Occasional non-critical maintenance reminders — never stop the cycle.
      sig.AIR = cycles % 4 === 0;
      sig.MAINT = cycles % 3 === 0;
    }
  }

  // ---- control actions --------------------------------------------------
  function doRun() {
    if (state === "FAULT" || state === "FAULT_RESET") {
      setMessage(
        state === "FAULT"
          ? "Robot is faulted. Press Reset, then Recover before running."
          : "Fault cleared. Press Recover to home the robot before running."
      );
      return;
    }
    if (state === "HOLD") { sig.HOLDREQ = false; }
    state = "RUN";
    sig.ABORT = false;
    if (mode === "auto") setMessage("Running in auto. Cycling parts through the CNC.");
    else setMessage("Manual mode armed — press Step to advance one handshake phase.");
  }

  function doHold() {
    if (state !== "RUN") return;
    state = "HOLD";
    sig.HOLDREQ = true;
    sig.MOTION = false;
    setMessage("Cycle held. Robot decelerated at a safe point. Press Run to resume.");
  }

  function doStep() {
    if (mode !== "manual") return;
    if (state !== "RUN") { setMessage("Press Run first to arm manual stepping."); return; }
    advancePhase();
    render();
  }

  function doFault() {
    if (state === "ABORTED") return;
    state = "FAULT";
    sig.FAULT = true;
    sig.MOTION = false;
    setMessage("FAULT: robot stopped mid-cycle. Latched flags held. Press Reset, then Recover.");
  }

  function doReset() {
    sig.RESET = true; // momentary; cleared next tick
    if (state === "FAULT") {
      sig.FAULT = false;
      state = "FAULT_RESET";
      setMessage("Fault reset. Robot is off-home — press Recover to return it safely.");
    } else if (state === "ABORTED") {
      setMessage("Reset acknowledged. Press Run to restart the cycle from home.");
    } else {
      setMessage("Reset pulse issued.");
    }
  }

  function doRecover() {
    if (state !== "FAULT_RESET" && state !== "FAULT") {
      setMessage("Recover is only needed after a fault reset.");
      return;
    }
    if (state === "FAULT") { setMessage("Clear the fault with Reset before recovering."); return; }
    // Home the robot and rewind to a clean command boundary.
    sig.FAULT = false;
    sig.ACK = false; sig.DONE = false; sig.REQ = false; sig.MOTION = false;
    sig.HOME = true;
    phase = 0;
    cmdIndex = 0;
    execLeft = 0;
    state = "IDLE";
    setMessage("Recovered: robot homed and cycle rewound. Press Run to resume.");
  }

  function doAbort() {
    state = "ABORTED";
    sig.REQ = false; sig.ACK = false; sig.DONE = false;
    sig.HOLDREQ = false; sig.FAULT = false; sig.MOTION = false;
    sig.ABORT = true;
    sig.HOME = true;
    phase = 0;
    cmdIndex = 0;
    execLeft = 0;
    setMessage("Cycle aborted. Outputs cleared, robot safe at home. Press Run to restart.");
  }

  function setMode(next) {
    mode = next;
    sig.AUTO = mode === "auto";
    els.readout.mode.textContent = mode === "auto" ? "Auto" : "Manual";
    document.querySelectorAll(".mode-btn").forEach(function (b) {
      var on = b.dataset.mode === mode;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    document.querySelector('[data-action="step"]').disabled = mode !== "manual";
    if (mode === "manual" && state === "RUN") {
      setMessage("Manual mode — press Step to advance one handshake phase.");
    }
  }

  // ---- tick -------------------------------------------------------------
  function tick() {
    if (document.hidden) return; // don't burn CPU/battery in background tabs
    heartbeat = !heartbeat;
    if (sig.RESET) sig.RESET = false; // momentary pulse
    if (mode === "auto" && state === "RUN") {
      advancePhase();
    }
    sampleChart();
    render();
  }

  function sampleChart() {
    var frame = {};
    CHART_ROWS.forEach(function (r) { frame[r.key] = sig[r.key] ? 1 : 0; });
    chart.push(frame);
    if (chart.length > CHART_LEN) chart.shift();
  }

  // ---- render -----------------------------------------------------------
  function render() {
    els.stateChip.textContent = state === "FAULT_RESET" ? "RESET" : state;
    els.stateChip.dataset.tone = toneForState();
    els.readout.command.textContent =
      state === "IDLE" || state === "ABORTED" ? "—" : currentCommand().label;
    els.readout.phase.textContent = phaseLabel();
    els.readout.cycles.textContent = String(cycles);
    els.hb.classList.toggle("beat", (reduceMotion ? true : heartbeat) && state !== "ABORTED");

    updateLeds("plc", PLC_SIGNALS);
    updateLeds("robot", ROBOT_SIGNALS);
    updateLeds("flags", FLAG_SIGNALS);
    updateWires();
    drawChart();
  }

  function toneForState() {
    if (state === "FAULT") return "danger";
    if (state === "ABORTED") return "danger";
    if (state === "HOLD" || state === "FAULT_RESET") return "warn";
    if (state === "RUN") return "run";
    return "idle";
  }

  function phaseLabel() {
    if (state === "IDLE") return "Idle";
    if (state === "ABORTED") return "Aborted";
    if (state === "FAULT") return "Faulted";
    if (state === "FAULT_RESET") return "Awaiting recover";
    if (state === "HOLD") return "Held · " + PHASE_TEXT[phase];
    return PHASE_TEXT[phase];
  }

  function updateLeds(group, defs) {
    var list = document.querySelector('[data-signals="' + group + '"]');
    defs.forEach(function (def) {
      var row = list.querySelector('[data-led="' + def.key + '"]');
      if (!row) return;
      var on = !!sig[def.key];
      row.classList.toggle("on", on);
      row.querySelector(".led-val").textContent = on ? "1" : "0";
    });
  }

  function updateWires() {
    var active = { req: false, ack: false, done: false, clear: false };
    var plcActive = false, robotActive = false;
    if (state === "RUN" || state === "HOLD") {
      if (phase === 1) { active.req = true; plcActive = true; }
      else if (phase === 3) { active.ack = true; robotActive = true; }
      else if (phase === 4) { active.done = true; robotActive = true; }
      else if (phase === 5) { active.clear = true; plcActive = true; }
    }
    Object.keys(els.wires).forEach(function (w) {
      els.wires[w].classList.toggle("is-active", active[w]);
    });
    els.plcNode.classList.toggle("is-active", plcActive);
    els.robotNode.classList.toggle("is-active", robotActive || sig.FAULT);
    els.robotNode.classList.toggle("is-fault", sig.FAULT);
  }

  // Scale the canvas backing store to the device pixel ratio so traces/text
  // stay sharp on retina and mobile screens. Drawing then happens in CSS px.
  function sizeCanvas() {
    var c = els.canvas;
    if (!c || !els.ctx) return;
    var cssW = c.getBoundingClientRect().width || 900;
    var cssH = cssW * (240 / 900);
    var dpr = window.devicePixelRatio || 1;
    c.width = Math.round(cssW * dpr);
    c.height = Math.round(cssH * dpr);
    els.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    els.cssW = cssW;
    els.cssH = cssH;
  }

  function drawChart() {
    var ctx = els.ctx;
    if (!ctx) return;
    var W = els.cssW || els.canvas.width, H = els.cssH || els.canvas.height;
    var gutter = 60;
    var rows = CHART_ROWS.length;
    var rowH = H / rows;
    ctx.clearRect(0, 0, W, H);

    // row guides + labels
    ctx.font = "600 12px Inter, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    for (var i = 0; i < rows; i++) {
      var y0 = i * rowH;
      ctx.strokeStyle = "rgba(93,105,117,0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gutter, y0 + 0.5);
      ctx.lineTo(W, y0 + 0.5);
      ctx.stroke();
      ctx.fillStyle = "#5d6975";
      ctx.fillText(CHART_ROWS[i].label, 8, y0 + rowH / 2);
    }

    if (chart.length < 2) return;
    var plotW = W - gutter;
    var stepX = plotW / (CHART_LEN - 1);
    var pad = rowH * 0.26;

    for (var r = 0; r < rows; r++) {
      var row = CHART_ROWS[r];
      var top = r * rowH + pad;
      var bot = (r + 1) * rowH - pad;
      ctx.strokeStyle = row.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (var s = 0; s < chart.length; s++) {
        var x = gutter + s * stepX;
        var y = chart[s][row.key] ? top : bot;
        if (s === 0) { ctx.moveTo(x, y); }
        else {
          var prevY = chart[s - 1][row.key] ? top : bot;
          if (prevY !== y) ctx.lineTo(x, prevY); // vertical edge
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
  }

  // ---- wiring -----------------------------------------------------------
  function bindControls() {
    document.querySelectorAll(".mode-btn").forEach(function (b) {
      b.addEventListener("click", function () { setMode(b.dataset.mode); });
    });
    var actions = {
      run: doRun, hold: doHold, step: doStep, fault: doFault,
      reset: doReset, recover: doRecover, abort: doAbort
    };
    document.querySelectorAll("[data-action]").forEach(function (b) {
      var fn = actions[b.dataset.action];
      if (fn) b.addEventListener("click", function () { fn(); render(); });
    });
  }

  function init() {
    cacheEls();
    if (!els.canvas) return; // this script is only meaningful on the simulator page
    buildLeds(document.querySelector('[data-signals="plc"]'), PLC_SIGNALS);
    buildLeds(document.querySelector('[data-signals="robot"]'), ROBOT_SIGNALS);
    buildLeds(document.querySelector('[data-signals="flags"]'), FLAG_SIGNALS);
    resetSignals();
    setMode("auto");
    bindControls();
    sizeCanvas();
    render();
    setInterval(tick, TICK_MS);
    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        sizeCanvas();
        drawChart();
      }, 150);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
