import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rename, rm, stat, writeFile } from "node:fs/promises";
import { arch, platform } from "node:os";
import { dirname, join, resolve, sep } from "node:path";

import { canonicalJson } from "../capsule/node.mjs";

const predicateType = "urn:lean-bridge:attestation:independent-confirmation:v1";
const sha256 = value => createHash("sha256").update(value).digest("hex");

/**
 * Reports independent confirmation failures with stable machine-readable codes and structured diagnostic context.
 */
export class IndependentConfirmationError extends Error
{
	/**
   * Initializes the error used to report independent confirmation failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "IndependentConfirmationError";
		this.code = code;
		this.details = details;
	}
}

const fail = (code, message, details) => {
	throw new IndependentConfirmationError(code, message, details);
};

/**
 * Confirms the rebuilt candidate matches the published identity and records verifier, environment, report, and authorization provenance.
 *
 * @param root0 - Named inputs and dependency overrides used to create independent confirmation.
 * @param root0.published - Published release locator and identity used for download or independent comparison.
 * @param root0.rebuilt - Independent rebuild identity compared with the published release identity.
 * @param root0.verifierIdentity - Independent verifier identity recorded as confirmation provenance.
 * @param root0.reportUrl - Stable URL where reviewers can inspect the independent verification report.
 * @param root0.environment - Environment variables used to resolve tools and policy.
 * @param root0.confirmedAt - RFC 3339 timestamp recording when the independent verifier completed confirmation.
 */
export const createIndependentConfirmation = ({
	published
	, rebuilt
	, verifierIdentity = null
	, reportUrl = null
	, environment
	, confirmedAt = new Date().toISOString()
}) => {
	if(published.candidate.id !== rebuilt.candidate.id)
	{
		fail("independent-candidate-drift", "The independent rebuild produced a different candidate identity", {
			published: published.candidate.id
			, rebuilt: rebuilt.candidate.id
		});
	}
	if(verifierIdentity !== null && (typeof verifierIdentity !== "string" || verifierIdentity === ""))
	{
		fail("invalid-verifier-identity", "Verifier identity must be a non-empty string or null");
	}
	if(reportUrl !== null && (typeof reportUrl !== "string" || reportUrl === ""))
	{
		fail("invalid-report-url", "Report URL must be a non-empty string or null");
	}
	const environmentSha256 = sha256(canonicalJson(environment));
	return Object.freeze({
		schemaVersion: 1
		, predicateType
		, status: "confirmed"
		, candidate: Object.freeze({
			id: published.candidate.id
			, sourceRevision: published.candidate.sourceRevision
			, sourceTree: published.candidate.sourceTree
			, artifactInventorySha256: published.candidate.artifactInventorySha256
		})
		, verifier: Object.freeze({
			identity: verifierIdentity
			, platform: `${platform()}/${arch()}`
			, environmentSha256
		})
		, evidence: Object.freeze({
			publishedAuthorizationSha256: published.authorizationSha256
			, rebuiltAuthorizationSha256: rebuilt.authorizationSha256
			, rebuiltReportSha256: rebuilt.reportSha256
			, reportUrl
		})
		, confirmedAt
	});
};

const assertOutputAbsent = async outputRoot => {
	const output = resolve(outputRoot);
	try
	{
		await stat(output);
		fail("confirmation-output-exists", `Independent confirmation output already exists: ${output}`);
	} catch(error)
	{
		if(error instanceof IndependentConfirmationError) throw error;
		if(error.code !== "ENOENT") throw error;
	}
	return output;
};

/**
 * Writes independent confirmation in deterministic form with the metadata required by the deterministic release and independent-verification pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to write independent confirmation.
 * @param root0.outputRoot - Filesystem root containing the output.
 * @param root0.confirmation - Validated independent confirmation document to write with canonical formatting.
 */
export const writeIndependentConfirmation = async ({ outputRoot, confirmation }) => {
	const output = await assertOutputAbsent(outputRoot);
	const parent = dirname(output);
	if(output === parent || parent.startsWith(`${output}${sep}`)) fail("unsafe-confirmation-output", "Confirmation output path is unsafe");
	await mkdir(parent, { recursive: true });
	const staging = await mkdtemp(join(parent, ".lean-bridge-confirmation-"));
	try
	{
		const source = canonicalJson(confirmation);
		const identity = sha256(source);
		await Promise.all([
			writeFile(join(staging, "independent-confirmation.json"), source)
			, writeFile(join(staging, "independent-confirmation.sha256"), `${identity}  independent-confirmation.json\n`)
		]);
		await rename(staging, output);
		return Object.freeze({
			output
			, confirmation: join(output, "independent-confirmation.json")
			, confirmationSha256: identity
		});
	} catch(error)
	{
		await rm(staging, { recursive: true, force: true });
		throw error;
	}
};
