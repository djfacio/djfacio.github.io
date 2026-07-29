/**
 * effects.js — interactive polish for the portfolio homepage.
 *
 * Design intent: read as an engineered instrument panel, not web flair.
 * Everything is gated behind prefers-reduced-motion and pointer capability,
 * and the page is fully usable (and fully visible) if this file never runs.
 */
(() => {
  "use strict";

  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer: fine)");

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /* Signal to CSS that JS is live so reveal states can safely hide first. */
  if (!reduceMotion.matches) root.classList.add("fx-ready");

  /* ============================================================
   * 1. TCP reticle cursor — a machine-vision crosshair that eases
   *    toward the pointer and "acquires" interactive targets.
   * ========================================================== */
  function initReticle() {
    if (reduceMotion.matches || !finePointer.matches) return;

    const reticle = document.createElement("div");
    reticle.className = "fx-reticle";
    reticle.setAttribute("aria-hidden", "true");
    reticle.innerHTML =
      '<span class="fx-reticle-corner tl"></span>' +
      '<span class="fx-reticle-corner tr"></span>' +
      '<span class="fx-reticle-corner bl"></span>' +
      '<span class="fx-reticle-corner br"></span>' +
      '<span class="fx-reticle-dot"></span>';
    document.body.appendChild(reticle);
    /* Native cursor stays visible; the reticle trails it (ryansass-style, but snappier). */

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const pos = { x: target.x, y: target.y };
    let visible = false;
    let hovering = false;

    const interactive =
      'a, button, .case-card, .tool-card, input, textarea, summary, label, [role="button"]';

    window.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerType && e.pointerType !== "mouse") return;
        target.x = e.clientX;
        target.y = e.clientY;
        if (!visible) {
          visible = true;
          reticle.classList.add("is-visible");
        }
        const t = e.target.closest ? e.target.closest(interactive) : null;
        const nextHover = Boolean(t);
        if (nextHover !== hovering) {
          hovering = nextHover;
          reticle.classList.toggle("is-target", hovering);
        }
      },
      { passive: true }
    );

    window.addEventListener("pointerdown", () => reticle.classList.add("is-down"));
    window.addEventListener("pointerup", () => reticle.classList.remove("is-down"));
    document.addEventListener("mouseleave", () => {
      visible = false;
      reticle.classList.remove("is-visible");
    });

    /* Follow profile: each "leg" (a gap the pointer opens up) is covered in two
       stages — a long slow drift over the first half of the distance, then a
       quick commit over the rest. The two speeds are tuned independently. */
    const SLOW_K = 0.012; /* easing coefficient for the opening drift */
    const FAST_K = 0.1; /* easing coefficient for the catch-up */
    const SLOW_UNTIL = 0.25; /* fraction of the leg covered at the slow speed */
    let legDist = 0; /* gap length when the current leg began */

    (function frame() {
      const dx = target.x - pos.x;
      const dy = target.y - pos.y;
      const dist = Math.hypot(dx, dy);

      /* A new leg begins whenever the pointer opens the gap wider than before. */
      if (dist > legDist) legDist = dist;
      if (dist < 0.5) legDist = 0;

      const covered = legDist > 0 ? 1 - dist / legDist : 1;
      const k = covered < SLOW_UNTIL ? SLOW_K : FAST_K;

      pos.x = lerp(pos.x, target.x, k);
      pos.y = lerp(pos.y, target.y, k);
      reticle.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%)`;
      requestAnimationFrame(frame);
    })();
  }

  /* ============================================================
   * 2. Hero reduction + parallax — the background plate scales and
   *    the content lifts and fades as the hero scrolls away.
   * 3. Sensor-sweep glow — a contained radial light tracking the
   *    cursor across the hero grid.
   * ========================================================== */
  function initHero() {
    const hero = document.querySelector(".hero");
    if (!hero) return;
    const visual = hero.querySelector(".hero-visual");
    const content = hero.querySelector(".hero-content");

    if (reduceMotion.matches || !visual) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const h = hero.offsetHeight || window.innerHeight;
        const p = clamp(window.scrollY / h, 0, 1);
        visual.style.transform = `scale(${1 + p * 0.14}) translateY(${p * 26}px)`;
        visual.style.filter = `brightness(${1 - p * 0.28})`;
        if (content) {
          content.style.transform = `translateY(${p * -46}px)`;
          content.style.opacity = String(clamp(1 - p * 1.15, 0, 1));
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ============================================================
   * 4a. Magnetic CTAs — primary/secondary buttons pull toward cursor.
   * ========================================================== */
  function initMagnetic() {
    if (reduceMotion.matches || !finePointer.matches) return;
    document.querySelectorAll(".hero-actions .button").forEach((btn) => {
      const strength = 0.32;
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        btn.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
      });
      btn.addEventListener("pointerleave", () => {
        btn.style.transform = "";
      });
    });
  }

  /* ============================================================
   * 4b. Case-card tilt — subtle 3D response toward the cursor.
   * ========================================================== */
  function initTilt() {
    if (reduceMotion.matches || !finePointer.matches) return;
    document.querySelectorAll(".case-card, .tool-card").forEach((card) => {
      const max = 5; // degrees
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform =
          `perspective(900px) rotateX(${-py * max}deg) rotateY(${px * max}deg) translateY(-4px)`;
      });
      card.addEventListener("pointerleave", () => {
        card.style.transform = "";
      });
    });
  }

  /* ============================================================
   * 5a. Scroll reveal — sections and cards rise into view.
   * ========================================================== */
  function initReveal() {
    if (reduceMotion.matches || !("IntersectionObserver" in window)) return;
    const targets = document.querySelectorAll(
      ".section-heading, .case-card, .tool-card, .metrics div, .hardware-grid figure, " +
        ".skill-columns > div, .growth-grid > div, .about-portrait, .about-copy, .about-pair figure"
    );
    targets.forEach((el, i) => {
      el.classList.add("fx-reveal");
      el.style.setProperty("--fx-delay", `${(i % 4) * 60}ms`);
    });
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            obs.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    targets.forEach((el) => io.observe(el));
  }

  /* ============================================================
   * 5b. Metric count-up — 40+, $1.2M, 3, 4 tick up on entry.
   * ========================================================== */
  function initCountUp() {
    if (reduceMotion.matches || !("IntersectionObserver" in window)) return;
    const metrics = document.querySelectorAll(".metrics strong");
    if (!metrics.length) return;

    const parse = (text) => {
      const m = text.match(/^([^\d.]*)([\d.]+)(.*)$/);
      if (!m) return null;
      return { prefix: m[1], value: parseFloat(m[2]), suffix: m[3], raw: m[2] };
    };

    const animate = (el) => {
      const parsed = parse(el.textContent.trim());
      if (!parsed) return;
      const decimals = parsed.raw.includes(".") ? parsed.raw.split(".")[1].length : 0;
      const dur = 1100;
      const start = performance.now();
      const step = (now) => {
        const t = clamp((now - start) / dur, 0, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        const current = (parsed.value * eased).toFixed(decimals);
        el.textContent = `${parsed.prefix}${current}${parsed.suffix}`;
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animate(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    metrics.forEach((el) => io.observe(el));
  }

  function init() {
    initReticle();
    initHero();
    initMagnetic();
    initTilt();
    initReveal();
    initCountUp();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
