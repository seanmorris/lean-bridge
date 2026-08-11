import { readFile } from "node:fs/promises";

const stages = new Set(["analyze", "generate", "build", "rebuild", "compare", "publish", "consume"]);
const kinds = new Set([
  "annotation", "hint", "manual-edit", "host-dependency", "registry-step", "target-special-case",
]);
const classifications = new Set(["safely-inferable", "unavoidable-ambiguity", "policy-choice", "defect"]);

export class ZeroConfigAuditError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ZeroConfigAuditError";
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details = {}) => {
  throw new ZeroConfigAuditError(code, message, details);
};

const exactKeys = (value, expected, label) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail("invalid-zero-config-audit", `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail("invalid-zero-config-audit", `${label} fields must be closed`, { actual, expected: wanted });
  }
};

const nonEmpty = (value, label) => {
  if (typeof value !== "string" || value.trim() === "") fail("invalid-zero-config-audit", `${label} must be a non-empty string`);
};

const stringArray = (value, label) => {
  if (!Array.isArray(value) || value.length === 0 || value.some(item => typeof item !== "string" || item === "")) {
    fail("invalid-zero-config-audit", `${label} must be a non-empty string array`);
  }
};

export const validateZeroConfigAudit = document => {
  exactKeys(document, ["schemaVersion", "scope", "exceptions", "defaults"], "zero-config audit");
  if (document.schemaVersion !== 1) fail("invalid-zero-config-audit", "zero-config audit version must be 1");
  nonEmpty(document.scope, "scope");
  if (!Array.isArray(document.exceptions)) fail("invalid-zero-config-audit", "exceptions must be an array");
  if (!Array.isArray(document.defaults)) fail("invalid-zero-config-audit", "defaults must be an array");
  const ids = new Set();
  for (const item of document.exceptions) {
    exactKeys(item, [
      "id", "stage", "fixture", "kind", "classification", "mandatory", "blocking",
      "targetSpecificRebuild", "description", "evidence", "remediation",
    ], `exception ${item?.id ?? "unknown"}`);
    nonEmpty(item.id, "exception id");
    if (ids.has(item.id)) fail("invalid-zero-config-audit", `duplicate exception ${item.id}`);
    ids.add(item.id);
    if (!stages.has(item.stage)) fail("invalid-zero-config-audit", `unsupported stage ${item.stage}`);
    if (item.fixture !== null) nonEmpty(item.fixture, "fixture");
    if (!kinds.has(item.kind)) fail("invalid-zero-config-audit", `unsupported kind ${item.kind}`);
    if (!classifications.has(item.classification)) fail("invalid-zero-config-audit", `unsupported classification ${item.classification}`);
    for (const key of ["mandatory", "blocking", "targetSpecificRebuild"]) {
      if (typeof item[key] !== "boolean") fail("invalid-zero-config-audit", `${key} must be boolean`);
    }
    nonEmpty(item.description, "exception description");
    stringArray(item.evidence, "exception evidence");
    nonEmpty(item.remediation, "exception remediation");
  }
  for (const item of document.defaults) {
    exactKeys(item, ["id", "stage", "behavior", "visible", "reversible", "evidence"], `default ${item?.id ?? "unknown"}`);
    nonEmpty(item.id, "default id");
    if (ids.has(item.id)) fail("invalid-zero-config-audit", `duplicate audit id ${item.id}`);
    ids.add(item.id);
    if (!stages.has(item.stage)) fail("invalid-zero-config-audit", `unsupported stage ${item.stage}`);
    nonEmpty(item.behavior, "default behavior");
    if (typeof item.visible !== "boolean" || typeof item.reversible !== "boolean") {
      fail("invalid-zero-config-audit", "default visibility and reversibility must be boolean");
    }
    stringArray(item.evidence, "default evidence");
  }
  return true;
};

export const readZeroConfigAudit = async path => {
  let document;
  try {
    document = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    fail("invalid-zero-config-audit-json", `cannot read zero-config audit ${path}`, { cause: error.message });
  }
  validateZeroConfigAudit(document);
  return document;
};

const violation = (item, code, message) => Object.freeze({
  id: item.id,
  code,
  message,
  evidence: Object.freeze([...item.evidence]),
});

export const evaluateZeroConfigAudit = document => {
  validateZeroConfigAudit(document);
  const violations = [];
  for (const item of document.exceptions) {
    if (item.kind === "annotation" && item.mandatory) {
      violations.push(violation(item, "mandatory-publishing-annotation", "The baseline requires a publishing annotation"));
    }
    if (item.kind === "manual-edit" && item.mandatory) {
      violations.push(violation(item, "mandatory-manual-edit", "The baseline requires a manual file or edit"));
    }
    if (item.targetSpecificRebuild) {
      violations.push(violation(item, "target-specific-rebuild", "A target projection rebuilds the component"));
    }
    if (item.classification === "defect" && item.blocking) {
      violations.push(violation(item, "blocking-zero-config-defect", item.description));
    }
  }
  for (const item of document.defaults) {
    if (!item.visible) violations.push(violation(item, "silent-default", "A default is absent from diagnostics and reports"));
    if (!item.reversible) violations.push(violation(item, "irreversible-default", "A default cannot be changed through supported configuration"));
  }
  violations.sort((left, right) => left.id.localeCompare(right.id) || left.code.localeCompare(right.code));
  return Object.freeze({
    schemaVersion: 1,
    passed: violations.length === 0,
    summary: Object.freeze({
      exceptions: document.exceptions.length,
      unavoidableAmbiguities: document.exceptions.filter(item => item.classification === "unavoidable-ambiguity").length,
      policyChoices: document.exceptions.filter(item => item.classification === "policy-choice").length,
      defects: document.exceptions.filter(item => item.classification === "defect").length,
      defaults: document.defaults.length,
      violations: violations.length,
    }),
    violations: Object.freeze(violations),
  });
};
