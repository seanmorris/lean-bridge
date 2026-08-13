import { readFileSync } from "node:fs";

import { canonicalJson, sha256 } from "../capsule/node.mjs";

const allowedPolicyKeys = new Set([
	"schemaVersion"
	, "maxWarnings"
	, "maxUndocumentedExports"
	, "minimumExports"
	, "requireCompiledExports"
	, "allowStaticallyInferredIr"
	, "requireSemanticVersion"
]);

/**
 * Reports analysis policy failures with stable machine-readable codes and structured diagnostic context.
 */
export class AnalysisPolicyError extends Error
{
	/**
   * Initializes the error used to report analysis policy failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
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
	if(value !== null && (!Number.isSafeInteger(value) || value < 0))
	{
		fail("invalid-analysis-policy", `${name} must be a non-negative integer or null`);
	}
};

export const builtinAnalysisPolicy = Object.freeze({
	schemaVersion: 1
	, maxWarnings: null
	, maxUndocumentedExports: null
	, minimumExports: 1
	, requireCompiledExports: false
	, allowStaticallyInferredIr: true
	, requireSemanticVersion: false
});

/**
 * Validates analysis policy against its closed contract before it enters the non-mutating project analysis workflow.
 *
 * @param policy - Closed policy document that governs authorization and validation.
 */
export const validateAnalysisPolicy = policy => {
	if(policy === null || typeof policy !== "object" || Array.isArray(policy))
	{
		fail("invalid-analysis-policy", "analysis policy must be an object");
	}
	const unknown = Object.keys(policy).filter(key => !allowedPolicyKeys.has(key));
	if(unknown.length > 0) fail("invalid-analysis-policy", "analysis policy fields must be closed", { unknown });
	if(policy.schemaVersion !== 1) fail("invalid-analysis-policy", "analysis policy version must be 1");
	optionalLimit(policy.maxWarnings ?? null, "maxWarnings");
	optionalLimit(policy.maxUndocumentedExports ?? null, "maxUndocumentedExports");
	if(policy.minimumExports !== undefined && (!Number.isSafeInteger(policy.minimumExports) || policy.minimumExports < 1))
	{
		fail("invalid-analysis-policy", "minimumExports must be a positive integer");
	}
	for(const name of ["requireCompiledExports", "allowStaticallyInferredIr", "requireSemanticVersion"])
	{
		if(policy[name] !== undefined && typeof policy[name] !== "boolean")
		{
			fail("invalid-analysis-policy", `${name} must be boolean`);
		}
	}
	return true;
};

/**
 * Normalizes analysis policy into the canonical representation expected by the non-mutating project analysis workflow.
 *
 * @param policy - Closed policy document that governs authorization and validation.
 */
export const normalizeAnalysisPolicy = policy => {
	validateAnalysisPolicy(policy);
	return Object.freeze({
		schemaVersion: 1
		, maxWarnings: policy.maxWarnings ?? null
		, maxUndocumentedExports: policy.maxUndocumentedExports ?? null
		, minimumExports: policy.minimumExports ?? builtinAnalysisPolicy.minimumExports
		, requireCompiledExports: policy.requireCompiledExports ?? builtinAnalysisPolicy.requireCompiledExports
		, allowStaticallyInferredIr: policy.allowStaticallyInferredIr ?? builtinAnalysisPolicy.allowStaticallyInferredIr
		, requireSemanticVersion: policy.requireSemanticVersion ?? builtinAnalysisPolicy.requireSemanticVersion
	});
};

/**
 * Computes the SHA-256 identity of the normalized, canonically serialized analysis policy.
 *
 * @param policy - Closed policy document that governs authorization and validation.
 */
export const analysisPolicyIdentity = policy => sha256(canonicalJson(normalizeAnalysisPolicy(policy)));

/**
 * Loads analysis policy, verifies its structure and identity, and returns it to the non-mutating project analysis workflow.
 *
 * @param path - Logical or filesystem path used to locate the input and anchor precise validation diagnostics.
 */
export const readAnalysisPolicy = path => {
	let contents;
	try
	{
		contents = readFileSync(path, "utf8");
	} catch(error)
	{
		if(error.code === "ENOENT") fail("analysis-policy-not-found", `analysis policy does not exist: ${path}`);
		fail("analysis-policy-unreadable", `analysis policy cannot be read: ${path}`, { cause: error.message });
	}
	let document;
	try
	{
		document = JSON.parse(contents);
	} catch(error)
	{
		fail("invalid-analysis-policy-json", `analysis policy is not valid JSON: ${path}`, { cause: error.message });
	}
	const policy = normalizeAnalysisPolicy(document);
	return Object.freeze({ source: "file", path, sha256: sha256(canonicalJson(policy)), document: policy });
};

/**
 * Returns the immutable built-in policy with its canonical identity and provenance metadata.
 */
export const builtinAnalysisPolicyRecord = () => Object.freeze({
	source: "builtin"
	, path: null
	, sha256: analysisPolicyIdentity(builtinAnalysisPolicy)
	, document: builtinAnalysisPolicy
});

const stringValue = value => value === null ? "null" : typeof value === "string" ? value : JSON.stringify(value);

const violation = (code, message, expected, actual) => Object.freeze({
	code
	, message
	, expected: stringValue(expected)
	, actual: stringValue(actual)
});

const exportCandidate = (analysis, declaration) => analysis.exportCandidates.find(candidate =>
	candidate.declaration === declaration || `lean:${candidate.declaration}` === declaration
);

/**
 * Compares analysis diagnostics, export evidence, and Binding IR provenance with the selected policy and reports every violation.
 *
 * @param root0 - Project analysis and the identified policy record used to evaluate it.
 * @param root0.analysis - Completed Lean project analysis containing diagnostics, exports, and Binding IR evidence.
 * @param root0.policyRecord - Normalized policy document with source and SHA-256 identity.
 * @param root0.policyPath - Optional display path for diagnostics tied to an external policy file.
 */
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
		errors
		, warnings
		, requiredHints
		, proposedExports
		, undocumentedExports
		, compiledExports
		, semanticVersionPresent
		, bindingIrOrigin
	});
	const violations = [];
	if(analysis.bindingIr === null)
	{
		violations.push(violation("analysis-policy-binding-ir-required", "Analysis must produce a Binding IR", "present", "absent"));
	}
	if(requiredHints > 0)
	{
		violations.push(violation("analysis-policy-required-hints", "Analysis must resolve every required adapter hint", 0, requiredHints));
	}
	if(errors > 0)
	{
		violations.push(violation("analysis-policy-error-diagnostics", "Analysis must contain no error diagnostics", 0, errors));
	}
	if(proposedExports < policy.minimumExports)
	{
		violations.push(violation(
			"analysis-policy-minimum-exports",
			"Analysis produced fewer exports than policy requires",
			`>=${policy.minimumExports}`,
			proposedExports,
		));
	}
	if(policy.maxWarnings !== null && warnings > policy.maxWarnings)
	{
		violations.push(violation(
			"analysis-policy-warning-limit",
			"Analysis warning count exceeds policy",
			`<=${policy.maxWarnings}`,
			warnings,
		));
	}
	if(policy.maxUndocumentedExports !== null && undocumentedExports > policy.maxUndocumentedExports)
	{
		violations.push(violation(
			"analysis-policy-undocumented-export-limit",
			"Undocumented export count exceeds policy",
			`<=${policy.maxUndocumentedExports}`,
			undocumentedExports,
		));
	}
	if(policy.requireCompiledExports && compiledExports !== proposedExports)
	{
		violations.push(violation(
			"analysis-policy-compiled-exports-required",
			"Every proposed export must have compiled interface evidence",
			proposedExports,
			compiledExports,
		));
	}
	if(!policy.allowStaticallyInferredIr && bindingIrOrigin === "statically-inferred")
	{
		violations.push(violation(
			"analysis-policy-inferred-ir-forbidden",
			"Policy requires an existing validated Binding IR",
			"existing-validated",
			bindingIrOrigin,
		));
	}
	if(policy.requireSemanticVersion && !semanticVersionPresent)
	{
		violations.push(violation(
			"analysis-policy-semantic-version-required",
			"Policy requires a declared semantic package version",
			"declared semantic version",
			analysis.project.version,
		));
	}
	violations.sort((left, right) => left.code.localeCompare(right.code));
	return Object.freeze({
		schemaVersion: 1
		, analysisSha256: sha256(canonicalJson(analysis))
		, policy: Object.freeze({
			source: policyRecord.source
			, path: policyPath
			, sha256: policyRecord.sha256
			, document: policy
		})
		, passed: violations.length === 0
		, metrics
		, violations: Object.freeze(violations)
	});
};
