// Port of src/data/mockData.ts's stages() helper — the legacy 7-step WorkflowStage[] display
// strip kept alongside the real 9-stage journey for UI backward-compat (Application.stages).
function workflowStages(currentIdx, blockedIdx = null) {
  const labels = ["Profile", "Documents", "Application", "Decision", "Acceptance", "Visa", "Enrolment"];
  return labels.map((label, i) => ({
    key: label.toLowerCase(),
    label,
    status: blockedIdx === i ? "blocked" : i < currentIdx ? "done" : i === currentIdx ? "current" : "upcoming",
  }));
}

module.exports = { workflowStages };
