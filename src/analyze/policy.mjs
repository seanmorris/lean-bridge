import { readFileSync } from "node:fs";

import { canonicalJson, sha256 } from "../capsule/node.mjs";

const allowedPolicyKeys = new Set([
  "schemaVersion",
  "maxWarnings",
  "maxUndocumentedExports",
  "minimumExports",
  "requireCompiledExports",
  "allowStaticallyInferredIr",
  "requireSemanticVersion",
]);

export class AnalysisPolicyError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "AnalysisPolicyError";
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details = {}) => {
  throw new AnalysisPolicyError(code, message, details);
};

const optionalLimit = (value, name) => {
  if (value !== null && (!Number.isSafeInteger(value) || value < 0)) {
    fail("invalid-analysis-policy", `${name} must be a non-negative integer or null`);
  }
};

export const builtinAnalysisPolicy = Object.freeze({
  schemaVersion: 1,
  maxWarnings: null,
  maxUndocumentedExports: null,
  minimumExports: 1,
  requireCompiledExports: false,
  allowStaticallyInferredIr: true,
  requireSemanticVersion: false,
});

export const validateAnalysisPolicy = policy => {
  if (policy === null || typeof policy !== "object" || Array.isArray(policy)) {
    fail("invalid-analysis-policy", "analysis policy must be an object");
  }
  const unknown = Object.keys(policy).filter(key => !allowedPolicyKeys.has(key));
  if (unknown.length > 0) fail("invalid-analysis-policy", "analysis policy fields must be closed", { unknown });
  if (policy.schemaVersion !== 1) fail("invalid-analysis-policy", "analysis policy version must be 1");
  optionalLimit(policy.maxWarnings ?? null, "maxWarnings");
  optionalLimit(policy.maxUndocumentedExports ?? null, "maxUndocumentedExports");
  if (policy.minimumExports !== undefined && (!Number.isSafeInteger(policy.minimumExports) || policy.minimumExports < 1)) {
    fail("invalid-analysis-policy", "minimumExports must be a positive integer");
  }
  for (const name of ["requireCompiledExports", "allowStaticallyInferredIr", "requireSemanticVersion"]) {
    if (policy[name] !== undefined && typeof policy[name] !== "boolean") {
      fail("invalid-analysis-policy", `${name} must be boolean`);
    }
  }
  return true;
};

export const normalizeAnalysisPolicy = policy => {
  validateAnalysisPolicy(policy);
  return Object.freeze({
    schemaVersion: 1,
    maxWarnings: policy.maxWarnings ?? null,
    maxUndocumentedExports: policy.maxUndocumentedExports ?? null,
    minimumExports: policy.minimumExports ?? builtinAnalysisPolicy.minimumExports,
    requireCompiledExports: policy.requireCompiledExports ?? builtinAnalysisPolicy.requireCompiledExports,
    allowStaticallyInferredIr: policy.allowStaticallyInferredIr ?? builtinAnalysisPolicy.allowStaticallyInferredIr,
    requireSemanticVersion: policy.requireSemanticVersion ?? builtinAnalysisPolicy.requireSemanticVersion,
  });
};

export const analysisPolicyIdentity = policy => sha256(canonicalJson(normalizeAnalysisPolicy(policy)));

export const readAnalysisPolicy = path => {
  let contents;
  try {
    contents = readFileSync(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") fail("analysis-policy-not-found", `analysis policy does not exist: ${path}`);
    fail("analysis-policy-unreadable", `analysis policy cannot be read: ${path}`, { cause: error.message });
  }
  let document;
  try {
    document = JSON.parse(contents);
  } catch (error) {
    fail("invalid-analysis-policy-json", `analysis policy is not valid JSON: ${path}`, { cause: error.message });
  }
  const policy = normalizeAnalysisPolicy(document);
  return Object.freeze({ source: "file", path, sha256: sha256(canonicalJson(policy)), document: policy });
};

export const builtinAnalysisPolicyRecord = () => Object.freeze({
  source: "builtin",
  path: null,
  sha256: analysisPolicyIdentity(builtinAnalysisPolicy),
  document: builtinAnalysisPolicy,
});

const stringValue = value => value === null ? "null" : typeof value === "string" ? value : JSON.stringify(value);

const violation = (code, message, expected, actual) => Object.freeze({
  code,
  message,
  expected: stringValue(expected),
  actual: stringValue(actual),
});

const exportCandidate = (analysis, declaration) => analysis.exportCandidates.find(candidate =>
  candidate.declaration === declaration || `lean:${candidate.declaration}` === declaration
);

export const evaluateAnalysisPolicy = ({ analysis, policyRecord, policyPath = null }) => {
  const policy = normalizeAnalysisPolicy(policyRecord.document);
  const requiredHints = analysis.adapterHints.filter(item => item.required).length;
  const errors = analysis.diagnostics.filter(item => item.severity === "error").length;
  const warnings = analysis.diagnostics.filter(item => item.severity === "warning").length;
  const declarations = analysis.bindingIr?.document.declarations ?? [];
  const candidates = declarations.map(declaration => exportCandidate(
    analysis,
    declaration.source?.declaration ?? declaration.id,
  ));
  const documentedCandidates = candidates.filter(Boolean);
  const undocumentedExports = documentedCandidates.filter(candidate => candidate.documentation === null).length;
  const compiledExports = candidates.filter(candidate => candidate?.evidence.includes("compiled-interface:present")).length;
  const proposedExports = analysis.proposedExports.length;
  const semanticVersionPresent = analysis.project.version !== "0.0.0-local";
  const bindingIrOrigin = analysis.bindingIr?.origin ?? null;
  const metrics = Object.freeze({
    errors,
    warnings,
    requiredHints,
    proposedExports,
    undocumentedExports,
    compiledExports,
    semanticVersionPresent,
    bindingIrOrigin,
  });
  const violations = [];
  if (analysis.bindingIr === null) {
    violations.push(violation("analysis-policy-binding-ir-required", "Analysis must produce a Binding IR", "present", "absent"));
  }
  if (requiredHints > 0) {
    violations.push(violation("analysis-policy-required-hints", "Analysis must resolve every required adapter hint", 0, requiredHints));
  }
  if (errors > 0) {
    violations.push(violation("analysis-policy-error-diagnostics", "Analysis must contain no error diagnostics", 0, errors));
  }
  if (proposedExports < policy.minimumExports) {
    violations.push(violation(
      "analysis-policy-minimum-exports",
      "Analysis produced fewer exports than policy requires",
      `>=${policy.minimumExports}`,
      proposedExports,
    ));
  }
  if (policy.maxWarnings !== null && warnings > policy.maxWarnings) {
    violations.push(violation(
      "analysis-policy-warning-limit",
      "Analysis warning count exceeds policy",
      `<=${policy.maxWarnings}`,
      warnings,
    ));
  }
  if (policy.maxUndocumentedExports !== null && undocumentedExports > policy.maxUndocumentedExports) {
    violations.push(violation(
      "analysis-policy-undocumented-export-limit",
      "Undocumented export count exceeds policy",
      `<=${policy.maxUndocumentedExports}`,
      undocumentedExports,
    ));
  }
  if (policy.requireCompiledExports && compiledExports !== proposedExports) {
    violations.push(violation(
      "analysis-policy-compiled-exports-required",
      "Every proposed export must have compiled interface evidence",
      proposedExports,
      compiledExports,
    ));
  }
  if (!policy.allowStaticallyInferredIr && bindingIrOrigin === "statically-inferred") {
    violations.push(violation(
      "analysis-policy-inferred-ir-forbidden",
      "Policy requires an existing validated Binding IR",
      "existing-validated",
      bindingIrOrigin,
    ));
  }
  if (policy.requireSemanticVersion && !semanticVersionPresent) {
    violations.push(violation(
      "analysis-policy-semantic-version-required",
      "Policy requires a declared semantic package version",
      "declared semantic version",
      analysis.project.version,
    ));
  }
  violations.sort((left, right) => left.code.localeCompare(right.code));
  return Object.freeze({
    schemaVersion: 1,
    analysisSha256: sha256(canonicalJson(analysis)),
    policy: Object.freeze({
      source: policyRecord.source,
      path: policyPath,
      sha256: policyRecord.sha256,
      document: policy,
    }),
    passed: violations.length === 0,
    metrics,
    violations: Object.freeze(violations),
  });
};
