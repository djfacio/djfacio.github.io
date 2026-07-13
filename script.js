const checklistData = [
  {
    title: "Application Fit",
    items: [
      "Primary operation is defined",
      "Business problem is clear",
      "Automation is justified by volume, safety, quality, labor, or cycle time",
      "Success metrics are defined"
    ]
  },
  {
    title: "Part and Process Inputs",
    items: [
      "Part drawings are available",
      "Part variation is understood",
      "Material, weight, and surface finish are known",
      "Incoming orientation is defined",
      "Required tolerances are defined",
      "Reject criteria are defined"
    ]
  },
  {
    title: "Robot Selection",
    items: [
      "Payload is confirmed, including EOAT",
      "Reach is confirmed",
      "Cycle time is estimated",
      "Mounting orientation is selected",
      "Controller and options are confirmed",
      "Required I/O and communication options are confirmed"
    ]
  },
  {
    title: "EOAT and Fixturing",
    items: [
      "Grip method is selected",
      "Part retention is verified",
      "Sensor feedback is defined",
      "Compliance requirements are reviewed",
      "Quick-change requirements are reviewed",
      "Maintenance access is considered",
      "Fixture or nest design is reviewed"
    ]
  },
  {
    title: "Vision and Sensing",
    items: [
      "Vision requirement is confirmed",
      "2D or 3D approach is selected",
      "Lighting concept is defined",
      "Calibration method is defined",
      "Offset data format is defined",
      "Pass/fail criteria are defined",
      "Camera access and protection are considered"
    ]
  },
  {
    title: "PLC and Controls",
    items: [
      "PLC platform is selected",
      "Robot handshake is defined",
      "Auto and manual modes are defined",
      "Fault and reset behavior is defined",
      "Alarm list is started",
      "HMI screens are defined",
      "Recipe or part selection needs are reviewed",
      "Data logging requirements are reviewed"
    ]
  },
  {
    title: "Communication",
    items: [
      "EtherNet/IP, Profinet, Modbus, FL-Net, or other protocol is selected",
      "IP plan is created",
      "Critical and non-critical signals are separated",
      "Safety communication is defined",
      "Remote support requirements are defined"
    ]
  },
  {
    title: "Safety",
    items: [
      "Risk assessment is completed",
      "Guarding concept is defined",
      "DCS or safety zones are reviewed",
      "Light curtains, scanners, or interlocks are selected",
      "E-stop chain is defined",
      "Teach and recovery access are considered",
      "Lockout/tagout needs are considered"
    ]
  },
  {
    title: "Mechanical Integration",
    items: [
      "Machine interface is reviewed",
      "Conveyor or feed system is defined",
      "Pneumatics requirements are defined",
      "Servo or VFD axes are defined",
      "Tooling access is verified",
      "Maintenance clearance is verified"
    ]
  },
  {
    title: "Electrical",
    items: [
      "Power requirements are known",
      "Panel space is confirmed",
      "I/O list is created",
      "Sensor and actuator list is created",
      "Cable routing is considered",
      "Spare I/O is planned",
      "Electrical drawings are required or available"
    ]
  },
  {
    title: "Commissioning",
    items: [
      "FAT plan is defined",
      "SAT plan is defined",
      "Dry cycle plan is defined",
      "Recovery scenarios are tested",
      "Fault scenarios are tested",
      "Operator training is planned",
      "Maintenance training is planned"
    ]
  },
  {
    title: "Documentation and Handoff",
    items: [
      "Final drawings are complete",
      "Robot backup is saved",
      "PLC backup is saved",
      "HMI backup is saved",
      "Vision backup is saved",
      "Electrical schematics are complete",
      "BOM is complete",
      "User manual is complete",
      "Maintenance guide is complete",
      "Spare parts list is complete"
    ]
  }
];

const checklist = document.querySelector("#checklist");
const progressText = document.querySelector("#progressText");
const progressBar = document.querySelector("#progressBar");
const readinessScore = document.querySelector("#readinessScore");
const riskBand = document.querySelector("#riskBand");
const openItems = document.querySelector("#openItems");
const criticalSections = document.querySelector("#criticalSections");
const resetButton = document.querySelector("#resetChecklist");
const exportButton = document.querySelector("#exportChecklist");
const printButton = document.querySelector("#printChecklist");
const storageKey = "robotic-cell-assessment-v1";
const projectStorageKey = "robotic-cell-assessment-project-v1";

function getSavedState() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch {
    return {};
  }
}

function saveState() {
  const state = {};
  document.querySelectorAll("[data-check-id]").forEach((input) => {
    state[input.dataset.checkId] = input.checked;
  });
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function getProjectState() {
  try {
    return JSON.parse(localStorage.getItem(projectStorageKey)) || {};
  } catch {
    return {};
  }
}

function saveProjectState() {
  const state = {};
  document.querySelectorAll("[data-project-field]").forEach((field) => {
    state[field.dataset.projectField] = field.value;
  });
  localStorage.setItem(projectStorageKey, JSON.stringify(state));
}

function restoreProjectState() {
  const state = getProjectState();
  document.querySelectorAll("[data-project-field]").forEach((field) => {
    field.value = state[field.dataset.projectField] || "";
    field.addEventListener("input", saveProjectState);
  });
}

function updateSectionCounts() {
  document.querySelectorAll(".check-section").forEach((section) => {
    const inputs = [...section.querySelectorAll("input")];
    const complete = inputs.filter((input) => input.checked).length;
    const count = section.querySelector("[data-section-count]");
    count.textContent = `${complete}/${inputs.length}`;
  });
}

function updateProgress() {
  const inputs = [...document.querySelectorAll("[data-check-id]")];
  const complete = inputs.filter((input) => input.checked).length;
  const total = inputs.length;
  const percent = total ? Math.round((complete / total) * 100) : 0;
  const incompleteSections = [...document.querySelectorAll(".check-section")].filter((section) => {
    const sectionInputs = [...section.querySelectorAll("input")];
    return sectionInputs.some((input) => !input.checked);
  }).length;

  progressText.textContent = `${complete} of ${total} complete`;
  readinessScore.textContent = `${percent}% readiness`;
  progressBar.style.width = `${percent}%`;
  riskBand.textContent = getRiskBand(percent);
  openItems.textContent = `${total - complete} open ${total - complete === 1 ? "item" : "items"}`;
  criticalSections.textContent = `${incompleteSections} ${incompleteSections === 1 ? "section" : "sections"} incomplete`;
  updateSectionCounts();
}

function getRiskBand(percent) {
  if (percent >= 90) return "Ready for review";
  if (percent >= 70) return "Mostly defined";
  if (percent >= 45) return "Needs engineering review";
  return "Needs discovery";
}

function buildSummary() {
  const projectState = getProjectState();
  const lines = [
    "Robotic Cell Project Assessment",
    "================================",
    "",
    `Project: ${projectState.project || "Not specified"}`,
    `Application: ${projectState.application || "Not specified"}`,
    `Robot / PLC: ${projectState.robotPlc || "Not specified"}`,
    `Vision / Sensors: ${projectState.vision || "Not specified"}`,
    "",
    `Notes: ${projectState.notes || "None"}`,
    "",
    `Overall: ${readinessScore.textContent}`,
    `Status: ${riskBand.textContent}`,
    `Open items: ${openItems.textContent}`,
    "",
    "Open Items",
    "----------"
  ];

  document.querySelectorAll(".check-section").forEach((section) => {
    const title = section.querySelector("summary").childNodes[0].textContent.trim();
    const unchecked = [...section.querySelectorAll(".check-item")]
      .filter((item) => !item.querySelector("input").checked)
      .map((item) => item.querySelector("span").textContent.trim());

    if (unchecked.length) {
      lines.push("", title);
      unchecked.forEach((item) => lines.push(`- ${item}`));
    }
  });

  return lines.join("\n");
}

function exportSummary() {
  const summary = buildSummary();
  const blob = new Blob([summary], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `robotic-cell-assessment-${date}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderChecklist() {
  const savedState = getSavedState();

  checklist.innerHTML = checklistData
    .map((section, sectionIndex) => {
      const items = section.items
        .map((item, itemIndex) => {
          const id = `section-${sectionIndex}-item-${itemIndex}`;
          const checked = savedState[id] ? "checked" : "";
          return `
            <label class="check-item">
              <input type="checkbox" data-check-id="${id}" ${checked} />
              <span>${item}</span>
            </label>
          `;
        })
        .join("");

      return `
        <details class="check-section" ${sectionIndex < 3 ? "open" : ""}>
          <summary>
            ${section.title}
            <span data-section-count>0/${section.items.length}</span>
          </summary>
          <div class="check-items">
            ${items}
          </div>
        </details>
      `;
    })
    .join("");

  checklist.addEventListener("change", (event) => {
    if (event.target.matches("[data-check-id]")) {
      saveState();
      updateProgress();
    }
  });

  updateProgress();
}

resetButton.addEventListener("click", () => {
  localStorage.removeItem(storageKey);
  localStorage.removeItem(projectStorageKey);
  document.querySelectorAll("[data-check-id]").forEach((input) => {
    input.checked = false;
  });
  document.querySelectorAll("[data-project-field]").forEach((field) => {
    field.value = "";
  });
  updateProgress();
});

exportButton.addEventListener("click", exportSummary);

printButton.addEventListener("click", () => {
  window.print();
});

restoreProjectState();
renderChecklist();
