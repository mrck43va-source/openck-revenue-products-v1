import { WorkflowEngine } from "./workflow-engine.mjs";

const settings = await fetch("./sandbox.settings.json").then((r) => r.json());
const engine = new WorkflowEngine(settings);
let activeLeadId = null;

const $ = (id) => document.getElementById(id);
const eventId = () => `TEST-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

function setNewId() {
  $("eventId").value = eventId();
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function render() {
  const state = engine.snapshot();
  $("pauseBadge").textContent = state.paused ? "PAUSED" : "ACTIVE";
  $("pauseBadge").className = `badge ${state.paused ? "danger" : "safe"}`;
  $("pause").textContent = state.paused ? "Resume workflow" : "Emergency pause";
  $("versionBadge").textContent = state.settings.workflowVersion;
  $("leadCount").textContent = state.leads.length;
  $("messageCount").textContent = state.outbox.length;
  $("alertCount").textContent = state.alerts.length;
  $("suppressionCount").textContent = state.suppression.length;

  $("leadLog").innerHTML = state.leads.length ? state.leads.slice().reverse().map((lead) => `
    <button class="record ${lead.leadId === activeLeadId ? "selected" : ""}" data-lead="${esc(lead.leadId)}">
      <span><strong>${esc(lead.leadName)}</strong><small>${esc(lead.source)}  |  ${esc(lead.eventId)}</small></span>
      <em>${esc(lead.status)}</em>
    </button>`).join("") : "No records yet.";
  $("activityLog").innerHTML = state.activity.length ? state.activity.slice(-8).reverse().map((item) => `
    <div class="log"><strong>${esc(item.action)}</strong><span>${esc(item.eventId)}</span><small>${new Date(item.at).toLocaleTimeString()}</small></div>`).join("") : "No activity yet.";
  $("outbox").innerHTML = state.outbox.length ? state.outbox.slice().reverse().map((item) => `
    <div class="message"><strong>${esc(item.type)}</strong><p>${esc(item.body)}</p><small>${esc(item.deliveryStatus)}</small></div>`).join("") : "No acknowledgments yet.";

  document.querySelectorAll("[data-lead]").forEach((button) => button.addEventListener("click", () => {
    activeLeadId = button.dataset.lead;
    render();
  }));
}

$("leadForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const result = engine.processEvent({
    eventId: $("eventId").value,
    source: $("source").value,
    leadName: $("leadName").value,
    email: $("email").value,
    service: $("service").value,
    consentApproved: $("consentApproved").checked,
    channelApproved: true,
    receivedAt: new Date().toISOString()
  });
  if (result.lead) activeLeadId = result.lead.leadId;
  $("formResult").textContent = `${result.code}: ${result.status || "event processed"}`;
  render();
});

$("newEvent").addEventListener("click", setNewId);
$("duplicateEvent").addEventListener("click", () => $("leadForm").requestSubmit());
$("pause").addEventListener("click", () => { engine.setPaused(!engine.snapshot().paused); render(); });
$("reset").addEventListener("click", () => { engine.reset(); activeLeadId = null; setNewId(); $("formResult").textContent = "Sandbox reset."; render(); });

document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => {
  if (!activeLeadId) { $("formResult").textContent = "Select a lead first."; return; }
  const result = engine.applyAction(activeLeadId, button.dataset.action);
  $("formResult").textContent = `${result.code}: ${result.status || "action processed"}`;
  render();
}));

setNewId();
render();

