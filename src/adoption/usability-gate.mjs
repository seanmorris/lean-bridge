import { readFile } from "node:fs/promises";

const roles = new Set(["lean-author", "javascript-consumer", "python-consumer", "automated-agent"]);
const participantTypes = new Set(["human", "agent"]);
const statuses = new Set(["pending", "passed", "blocked", "failed"]);

export class UsabilityGateError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "UsabilityGateError";
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details = {}) => {
  throw new UsabilityGateError(code, message, details);
};

const exactKeys = (value, expected, label) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail("invalid-usability-sessions", `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) fail("invalid-usability-sessions", `${label} fields must be closed`, { actual, expected: wanted });
};

const stringArray = (value, label, { empty = true } = {}) => {
  if (!Array.isArray(value) || (!empty && value.length === 0) || value.some(item => typeof item !== "string" || item === "")) {
    fail("invalid-usability-sessions", `${label} must be ${empty ? "a" : "a non-empty"} string array`);
  }
};

const nonNegative = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 0) fail("invalid-usability-sessions", `${label} must be a non-negative integer`);
};

export const validateUsabilitySessions = document => {
  exactKeys(document, ["schemaVersion", "protocol", "sessions"], "usability sessions");
  if (document.schemaVersion !== 1) fail("invalid-usability-sessions", "usability session version must be 1");
  if (typeof document.protocol !== "string" || document.protocol === "") fail("invalid-usability-sessions", "protocol must be a path");
  if (!Array.isArray(document.sessions)) fail("invalid-usability-sessions", "sessions must be an array");
  const seen = new Set();
  for (const session of document.sessions) {
    exactKeys(session, [
      "id", "role", "participantType", "status", "cleanCheckout", "revision", "commands",
      "publishingAnnotations", "handwrittenWrappers", "prompts", "unfamiliarConcepts",
      "actionableDiagnostics", "familiarInstall", "reproducibleVerified", "evidence",
    ], `session ${session?.id ?? "unknown"}`);
    if (typeof session.id !== "string" || session.id === "" || seen.has(session.id)) fail("invalid-usability-sessions", "session ids must be unique non-empty strings");
    seen.add(session.id);
    if (!roles.has(session.role)) fail("invalid-usability-sessions", `unsupported usability role ${session.role}`);
    if (!participantTypes.has(session.participantType)) fail("invalid-usability-sessions", `unsupported participant type ${session.participantType}`);
    if (session.role === "automated-agent" && session.participantType !== "agent") fail("invalid-usability-sessions", "automated-agent must use an agent participant");
    if (session.role !== "automated-agent" && session.participantType !== "human") fail("invalid-usability-sessions", `${session.role} must use a human participant`);
    if (!statuses.has(session.status)) fail("invalid-usability-sessions", `unsupported session status ${session.status}`);
    if (typeof session.cleanCheckout !== "boolean") fail("invalid-usability-sessions", "cleanCheckout must be boolean");
    if (session.revision !== null && (typeof session.revision !== "string" || !/^[0-9a-f]{40}$/.test(session.revision))) {
      fail("invalid-usability-sessions", "revision must be a 40-character Git identity or null");
    }
    if (session.status !== "pending" && session.revision === null) fail("invalid-usability-sessions", "completed or attempted sessions require a revision");
    stringArray(session.commands, "commands", { empty: session.status !== "passed" });
    stringArray(session.unfamiliarConcepts, "unfamiliarConcepts");
    stringArray(session.evidence, "evidence", { empty: session.status === "pending" });
    for (const key of ["publishingAnnotations", "handwrittenWrappers", "prompts"]) nonNegative(session[key], key);
    for (const key of ["actionableDiagnostics", "familiarInstall", "reproducibleVerified"]) {
      if (typeof session[key] !== "boolean") fail("invalid-usability-sessions", `${key} must be boolean`);
    }
  }
  return true;
};

export const readUsabilitySessions = async path => {
  let document;
  try {
    document = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    fail("invalid-usability-sessions-json", `cannot read usability sessions ${path}`, { cause: error.message });
  }
  validateUsabilitySessions(document);
  return document;
};

const violation = (session, code, message) => Object.freeze({
  session: session.id,
  role: session.role,
  code,
  message,
  evidence: Object.freeze([...session.evidence]),
});

export const evaluateUsabilityGate = document => {
  validateUsabilitySessions(document);
  const violations = [];
  const passingRoles = new Set(document.sessions.filter(session => session.status === "passed").map(session => session.role));
  for (const role of roles) {
    const matches = document.sessions.filter(session => session.role === role);
    if (matches.length === 0) {
      violations.push(Object.freeze({ session: null, role, code: "missing-role-session", message: `No ${role} session is recorded`, evidence: Object.freeze([]) }));
    }
  }
  for (const session of document.sessions) {
    if (passingRoles.has(session.role) && session.status !== "passed") continue;
    if (session.status !== "passed") violations.push(violation(session, `session-${session.status}`, `The ${session.role} session is ${session.status}`));
    if (session.status !== "pending" && !session.cleanCheckout) violations.push(violation(session, "checkout-not-clean", "The session did not start and end on a clean checkout"));
    if (session.publishingAnnotations > 0) violations.push(violation(session, "publishing-annotation-required", "The session added publishing annotations"));
    if (session.handwrittenWrappers > 0) violations.push(violation(session, "handwritten-wrapper-required", "The session added handwritten host wrappers"));
    if (session.prompts > 0) violations.push(violation(session, "baseline-prompt-required", "The baseline required an interactive prompt"));
    if (session.unfamiliarConcepts.length > 0) violations.push(violation(session, "unfamiliar-concepts-exposed", "The ordinary workflow exposed bridge implementation concepts"));
    if (session.status !== "pending" && !session.actionableDiagnostics) violations.push(violation(session, "diagnostics-not-actionable", "The participant could not act on the diagnostics without bridge knowledge"));
    if (session.status !== "pending" && !session.familiarInstall) violations.push(violation(session, "install-not-familiar", "The consumer did not receive an ordinary package-manager install"));
    if (session.status !== "pending" && !session.reproducibleVerified) violations.push(violation(session, "reproducibility-not-verified", "The session did not verify the released artifact"));
  }
  violations.sort((left, right) => left.role.localeCompare(right.role) || String(left.session).localeCompare(String(right.session)) || left.code.localeCompare(right.code));
  return Object.freeze({
    schemaVersion: 1,
    passed: violations.length === 0,
    summary: Object.freeze({
      requiredRoles: roles.size,
      sessions: document.sessions.length,
      passedSessions: document.sessions.filter(session => session.status === "passed").length,
      pendingSessions: document.sessions.filter(session => session.status === "pending").length,
      blockedSessions: document.sessions.filter(session => session.status === "blocked").length,
      failedSessions: document.sessions.filter(session => session.status === "failed").length,
      passedRoles: passingRoles.size,
      violations: violations.length,
    }),
    violations: Object.freeze(violations),
  });
};
