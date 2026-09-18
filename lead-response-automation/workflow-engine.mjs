export const DEFAULT_SETTINGS = Object.freeze({
  workflowVersion: "LRA-SANDBOX-1.0.0",
  timeZone: "America/Chicago",
  businessHours: { start: 9, end: 17 },
  holidayDates: [],
  allowedSources: ["website-form", "shared-inbox"],
  syntheticEmailDomains: ["example.com", "test.invalid"],
  syntheticPhonePrefix: "+1555000",
  bookingUrl: "https://example.com/lead-automation-demo-booking",
  maxRetries: 2,
  primaryAlertRecipient: "primary-operator@example.com",
  backupAlertRecipient: "backup-operator@example.com"
});

const FINAL_STATES = new Set([
  "Replied", "Booked", "Staff takeover", "Opted out", "Suppressed",
  "Duplicate", "Unqualified", "Failed/review", "Closed - outcome unknown"
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso(clock) {
  return new Date(clock()).toISOString();
}

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function safeName(value) {
  const trimmed = String(value || "").trim();
  return trimmed || "there";
}

function isSyntheticContact(email, phone, settings) {
  if (email) {
    const domain = email.split("@").pop();
    if (!settings.syntheticEmailDomains.includes(domain)) return false;
  }
  if (phone && !String(phone).startsWith(settings.syntheticPhonePrefix)) return false;
  return Boolean(email || phone);
}

export class WorkflowEngine {
  constructor(settings = {}, clock = () => Date.now()) {
    this.settings = {
      ...clone(DEFAULT_SETTINGS),
      ...clone(settings),
      businessHours: { ...DEFAULT_SETTINGS.businessHours, ...(settings.businessHours || {}) }
    };
    this.clock = clock;
    this.reset();
  }

  reset() {
    this.paused = false;
    this.leads = new Map();
    this.processedEvents = new Set();
    this.suppression = new Set();
    this.activity = [];
    this.outbox = [];
    this.alerts = [];
    this.calendarRoutes = [];
  }

  setPaused(paused, actor = "operator") {
    this.paused = Boolean(paused);
    this.#audit("SYSTEM", this.paused ? "EMERGENCY_PAUSE" : "EMERGENCY_RESUME", actor);
    return this.snapshot();
  }

  suppress(email, reason = "existing opt-out") {
    const key = normalizeEmail(email);
    if (key) this.suppression.add(key);
    this.#audit("SYSTEM", "SUPPRESSION_ADDED", reason);
  }

  processEvent(input, context = { authorized: true }) {
    const event = clone(input || {});
    const eventId = String(event.eventId || "").trim();
    const email = normalizeEmail(event.email);
    const phone = String(event.phone || "").trim();
    const source = String(event.source || "").trim();

    if (!context.authorized) return this.#reject(401, "UNAUTHORIZED", eventId);
    if (this.paused) return this.#reject(423, "EMERGENCY_PAUSED", eventId);
    if (!eventId || !source || !this.settings.allowedSources.includes(source)) {
      return this.#exception(eventId, "INVALID_REQUIRED_FIELDS");
    }
    if (String(event.channel || "").toLowerCase() === "sms") {
      return this.#exception(eventId, "UNSUPPORTED_CHANNEL");
    }
    if (!email && !phone) return this.#exception(eventId, "MISSING_CONTACT");
    if (!isSyntheticContact(email, phone, this.settings)) {
      return this.#exception(eventId, "NON_SYNTHETIC_CONTACT_REJECTED");
    }
    if (!email) return this.#exception(eventId, "NON_EMAIL_CONTACT_REJECTED");
    if (this.processedEvents.has(eventId)) {
      this.#audit(eventId, "DUPLICATE_SUPPRESSED", source);
      return { ok: true, code: "DUPLICATE", status: "Duplicate", eventId };
    }

    this.processedEvents.add(eventId);
    const lead = {
      leadId: String(event.leadId || eventId),
      eventId,
      source,
      receivedAt: new Date(event.receivedAt || this.clock()).toISOString(),
      processedAt: nowIso(this.clock),
      leadName: safeName(event.leadName),
      email,
      phone,
      service: String(event.service || "general inquiry"),
      assignedTo: "primary operator",
      workflowVersion: this.settings.workflowVersion,
      status: "New",
      touchCount: 0,
      finalAt: null
    };
    this.leads.set(lead.leadId, lead);
    this.#audit(eventId, "LEAD_LOGGED", source);

    if (email && this.suppression.has(email)) {
      lead.status = "Suppressed";
      lead.finalAt = nowIso(this.clock);
      this.#audit(eventId, "CUSTOMER_MESSAGE_SUPPRESSED", "existing opt-out");
      return { ok: true, code: "SUPPRESSED", status: lead.status, lead: clone(lead) };
    }

    if (event.consentApproved !== true || event.channelApproved === false) {
      lead.status = "Staff takeover";
      lead.finalAt = nowIso(this.clock);
      this.#addAlert(eventId, "MANUAL_HANDLING_REQUIRED", false);
      this.#audit(eventId, "CUSTOMER_MESSAGE_SUPPRESSED", "channel or consent not approved");
      return { ok: true, code: "MANUAL_FOLLOW_UP", status: lead.status, lead: clone(lead) };
    }

    const alert = this.#addAlert(eventId, "NEW_LEAD", Boolean(event.simulateAlertFailure));
    if (event.simulateVendorError) {
      lead.status = "Failed/review";
      lead.finalAt = nowIso(this.clock);
      this.#audit(eventId, "VENDOR_ERROR", "customer action not attempted");
      return { ok: false, code: "VENDOR_ERROR", status: lead.status, alert, lead: clone(lead) };
    }

    const businessStatus = this.#businessStatus(lead.receivedAt, Boolean(event.forceHoliday));
    const messageType = businessStatus === "OPEN" ? "BUSINESS_HOURS_ACK" : "AFTER_HOURS_ACK";
    const message = {
      eventId,
      channel: "email",
      recipient: email || phone,
      type: messageType,
      body: businessStatus === "OPEN"
        ? `Hi ${lead.leadName}, we received your inquiry. A team member will follow up.`
        : `Hi ${lead.leadName}, we received your inquiry after hours. A team member will follow up during the next eligible business period.`,
      simulated: true,
      attemptedAt: nowIso(this.clock),
      deliveryStatus: "SIMULATED_ONLY"
    };
    this.outbox.push(message);
    lead.status = businessStatus === "OPEN"
      ? "Awaiting staff response"
      : "Queued for next business period";
    lead.touchCount = 1;
    this.#audit(eventId, "ACKNOWLEDGMENT_SIMULATED", messageType);

    this.calendarRoutes.push({
      eventId,
      url: this.settings.bookingUrl,
      mobileValidated: /^https:\/\//.test(this.settings.bookingUrl),
      desktopValidated: /^https:\/\//.test(this.settings.bookingUrl),
      routedAt: nowIso(this.clock)
    });
    this.#audit(eventId, "BOOKING_ROUTE_ATTACHED", "synthetic URL");
    return { ok: true, code: "ACKNOWLEDGED", status: lead.status, alert, message, lead: clone(lead) };
  }

  applyAction(leadId, action, context = { authorized: true }) {
    if (!context.authorized) return this.#reject(401, "UNAUTHORIZED", leadId);
    const lead = this.leads.get(String(leadId));
    if (!lead) return this.#reject(404, "LEAD_NOT_FOUND", leadId);
    if (FINAL_STATES.has(lead.status) && action !== "close") {
      return { ok: false, code: "ALREADY_FINAL", status: lead.status, lead: clone(lead) };
    }

    const actions = {
      reply: ["Replied", "CUSTOMER_REPLY_DETECTED"],
      booked: ["Booked", "BOOKING_DETECTED"],
      takeover: ["Staff takeover", "STAFF_TAKEOVER"],
      optout: ["Opted out", "OPT_OUT_DETECTED"],
      unqualified: ["Unqualified", "LEAD_UNQUALIFIED"],
      close: ["Closed - outcome unknown", "LEAD_CLOSED"]
    };
    if (!actions[action]) return this.#reject(400, "UNKNOWN_ACTION", leadId);
    const [status, auditAction] = actions[action];
    lead.status = status;
    lead.reminderEligible = false;
    lead.finalAt = nowIso(this.clock);
    if (action === "optout" && lead.email) this.suppression.add(lead.email);
    this.#audit(lead.eventId, auditAction, "automation stopped");
    this.#addAlert(lead.eventId, auditAction, false);
    return { ok: true, code: auditAction, status, lead: clone(lead) };
  }

  snapshot() {
    return {
      paused: this.paused,
      settings: clone(this.settings),
      leads: [...this.leads.values()].map(clone),
      activity: clone(this.activity),
      outbox: clone(this.outbox),
      alerts: clone(this.alerts),
      calendarRoutes: clone(this.calendarRoutes),
      suppression: [...this.suppression]
    };
  }

  #businessStatus(receivedAt, forceHoliday) {
    const date = new Date(receivedAt);
    const dateKey = date.toISOString().slice(0, 10);
    if (forceHoliday || this.settings.holidayDates.includes(dateKey)) return "CLOSED";
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: this.settings.timeZone,
      weekday: "short",
      hour: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date);
    const weekday = parts.find((p) => p.type === "weekday")?.value;
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    if (["Sat", "Sun"].includes(weekday)) return "CLOSED";
    return hour >= this.settings.businessHours.start && hour < this.settings.businessHours.end ? "OPEN" : "CLOSED";
  }

  #addAlert(eventId, type, forcePrimaryFailure) {
    if (forcePrimaryFailure) {
      this.alerts.push({ eventId, type, recipient: this.settings.primaryAlertRecipient, outcome: "SIMULATED_FAILURE", at: nowIso(this.clock) });
      const backup = { eventId, type: `${type}_BACKUP`, recipient: this.settings.backupAlertRecipient, outcome: "SIMULATED_DELIVERY", at: nowIso(this.clock) };
      this.alerts.push(backup);
      this.#audit(eventId, "BACKUP_ALERT_ACTIVATED", type);
      return clone(backup);
    }
    const alert = { eventId, type, recipient: this.settings.primaryAlertRecipient, outcome: "SIMULATED_DELIVERY", at: nowIso(this.clock) };
    this.alerts.push(alert);
    this.#audit(eventId, "INTERNAL_ALERT_SIMULATED", type);
    return clone(alert);
  }

  #exception(eventId, reason) {
    this.#addAlert(eventId || "UNKNOWN", "INTAKE_EXCEPTION", false);
    this.#audit(eventId || "UNKNOWN", "EVENT_REJECTED", reason);
    return { ok: false, code: reason, status: "Needs review", eventId };
  }

  #reject(statusCode, code, eventId) {
    this.#audit(eventId || "UNKNOWN", code, `HTTP ${statusCode}`);
    return { ok: false, statusCode, code, eventId };
  }

  #audit(eventId, action, detail) {
    this.activity.push({
      eventId,
      action,
      detail: String(detail || "").slice(0, 120),
      at: nowIso(this.clock),
      workflowVersion: this.settings.workflowVersion
    });
  }
}
