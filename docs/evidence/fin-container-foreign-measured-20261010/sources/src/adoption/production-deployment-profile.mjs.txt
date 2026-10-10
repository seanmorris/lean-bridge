/**
 * Validates and evaluates the versioned production deployment profile.
 *
 * @file
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const runtimeIds = Object.freeze(["browser-chromium", "native-abi", "node", "php-native", "php-wasm", "python"]);
const evidenceIds = Object.freeze([
	"full-ci-green"
	, "external-reconstruction"
	, "human-clean-room"
	, "npm-sandbox-publication"
	, "security-and-assurance-review"
]);
const reviewRoles = Object.freeze(["release-owner", "runtime-owner", "security-owner"]);

/** Reports deployment-profile contract failures with stable machine-readable codes. */
export class ProductionDeploymentProfileError extends Error
{
	/**
	 * Initializes a deployment-profile validation failure.
	 *
	 * @param code - Stable machine-readable error code.
	 * @param message - Human-readable failure explanation.
	 * @param details - Structured diagnostic context.
	 */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "ProductionDeploymentProfileError";
		this.code = code;
		this.details = details;
	}
}

const fail = (code, message, details = {}) => {
	throw new ProductionDeploymentProfileError(code, message, details);
};

const exactKeys = (value, keys, label) => {
	if(value === null || typeof value !== "object" || Array.isArray(value)) fail("invalid-deployment-profile", `${label} must be an object`);
	const actual = Object.keys(value).sort();
	const expected = [...keys].sort();
	if(JSON.stringify(actual) !== JSON.stringify(expected))
	{
		fail("invalid-deployment-profile", `${label} fields must be closed`, { actual, expected });
	}
};

const nonempty = (value, label) => {
	if(typeof value !== "string" || value === "") fail("invalid-deployment-profile", `${label} must be a nonempty string`);
};

const exactStringList = (value, expected, label) => {
	if(!Array.isArray(value) || value.some(item => typeof item !== "string" || item === "") || JSON.stringify(value) !== JSON.stringify(expected))
	{
		fail("deployment-profile-drift", `${label} must match the reviewed closed list`, { actual: value, expected });
	}
};

/**
 * Validates the closed deployment profile before CI or release policy consumes it.
 *
 * @param document - Candidate deployment profile document.
 */
export const validateProductionDeploymentProfile = document => {
	exactKeys(document, [
		"schemaVersion", "profileId", "revision", "status", "platform"
		, "runtimes", "exclusions", "enforcement", "review"
	], "deployment profile");
	if(document.schemaVersion !== 1 || document.profileId !== "production-linux-x64-gnu-v1" || document.revision !== "1.0.0")
	{
		fail("deployment-profile-identity-drift", "Deployment profile identity must match version 1");
	}
	if(!new Set(["candidate", "reviewed"]).has(document.status)) fail("invalid-deployment-profile", "Deployment profile status is invalid");
	exactKeys(document.platform, ["operatingSystem", "architecture", "libc", "minimumLibcVersion"], "platform");
	const platform = { operatingSystem: "linux", architecture: "x86-64", libc: "glibc", minimumLibcVersion: "2.38" };
	if(JSON.stringify(document.platform) !== JSON.stringify(platform)) fail("deployment-platform-drift", "Deployment platform differs from the supported native artifact profile");
	if(!Array.isArray(document.runtimes) || JSON.stringify(document.runtimes.map(item => item.id)) !== JSON.stringify(runtimeIds))
	{
		fail("deployment-runtime-coverage", "Deployment runtime coverage or order differs from version 1");
	}
	for(const runtime of document.runtimes)
	{
		exactKeys(runtime, ["id", "version", "transport", "concurrency", "filesystem", "network", "lifecycle", "preflightProfile"], `runtime ${runtime?.id ?? "unknown"}`);
		for(const field of ["id", "version", "transport", "concurrency", "filesystem", "network", "lifecycle", "preflightProfile"])
		{
			nonempty(runtime[field], `${runtime.id}.${field}`);
		}
	}
	if(!Array.isArray(document.exclusions) || document.exclusions.length === 0 || new Set(document.exclusions).size !== document.exclusions.length)
	{
		fail("invalid-deployment-profile", "Deployment exclusions must be a nonempty unique list");
	}
	document.exclusions.forEach((item, index) => nonempty(item, `exclusions[${index}]`));
	exactKeys(document.enforcement, ["preflightProfile", "ciWorkflow", "documentation", "releaseAuthorization", "requiredEvidence"], "enforcement");
	if(document.enforcement.preflightProfile !== "full" || document.enforcement.ciWorkflow !== ".github/workflows/quality.yml")
	{
		fail("deployment-enforcement-drift", "Deployment profile must bind the full preflight and required CI workflow");
	}
	exactStringList(document.enforcement.documentation, ["README.md", "docs/consumers.md", "docs/status.md"], "documentation bindings");
	exactStringList(document.enforcement.requiredEvidence, evidenceIds, "required evidence");
	nonempty(document.enforcement.releaseAuthorization, "release authorization policy");
	exactKeys(document.review, ["requiredRoles", "approvals"], "review");
	exactStringList(document.review.requiredRoles, reviewRoles, "required review roles");
	if(!Array.isArray(document.review.approvals)) fail("invalid-deployment-profile", "Review approvals must be an array");
	const approvedRoles = new Set();
	for(const approval of document.review.approvals)
	{
		exactKeys(approval, ["role", "reviewer", "approvedAt"], "approval");
		if(!reviewRoles.includes(approval.role) || approvedRoles.has(approval.role)) fail("invalid-deployment-profile", "Review approvals must use unique required roles");
		nonempty(approval.reviewer, `${approval.role} reviewer`);
		if(!Number.isFinite(Date.parse(approval.approvedAt))) fail("invalid-deployment-profile", `${approval.role} approval timestamp is invalid`);
		approvedRoles.add(approval.role);
	}
	if(document.status === "reviewed" && approvedRoles.size !== reviewRoles.length)
	{
		fail("deployment-review-incomplete", "A reviewed deployment profile requires every named approval role");
	}
	if(document.status === "candidate" && approvedRoles.size !== 0)
	{
		fail("deployment-review-inconsistent", "Candidate deployment profiles cannot retain partial production approvals");
	}
	return true;
};

/**
 * Loads and validates the repository deployment profile.
 *
 * @param path - Profile path, relative to the current working directory by default.
 */
export const loadProductionDeploymentProfile = async (path = "config/production-deployment-profile.v1.json") => {
	const document = JSON.parse(await readFile(resolve(path), "utf8"));
	validateProductionDeploymentProfile(document);
	return Object.freeze(document);
};

/**
 * Evaluates whether the profile itself is eligible to enter production authorization.
 *
 * @param document - Validated deployment profile.
 */
export const evaluateProductionDeploymentProfile = document => {
	validateProductionDeploymentProfile(document);
	const approved = new Set(document.review.approvals.map(item => item.role));
	const missingApprovals = reviewRoles.filter(role => !approved.has(role));
	return Object.freeze({
		eligible: document.status === "reviewed" && missingApprovals.length === 0
		, profileId: document.profileId
		, revision: document.revision
		, missingApprovals: Object.freeze(missingApprovals)
		, requiredEvidence: Object.freeze([...document.enforcement.requiredEvidence])
	});
};
