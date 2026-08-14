/**
 * Implements the independent verifier module in the release subsystem.
 *
 * @file
 */

import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import { processBuildRunner } from "../build/canonical-build.mjs";
import {
	createIndependentConfirmation,
	writeIndependentConfirmation,
} from "./independent-confirmation.mjs";
import {
	runReproducibilityGate,
	verifyReleaseAuthorization,
} from "./reproducibility-gate.mjs";

/**
 * Reports independent verifier failures with stable machine-readable codes and structured diagnostic context.
 */
export class IndependentVerifierError extends Error
{
	/**
   * Initializes the error used to report independent verifier failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "IndependentVerifierError";
		this.code = code;
		this.details = details;
	}
}

const fail = (code, message, details) => {
	throw new IndependentVerifierError(code, message, details);
};

const capture = (runner, request) => runner.capture({ timeoutMs: 30 * 60 * 1000, ...request });
const maximumArchiveBytes = 1024 * 1024 * 1024;

/**
 * Validates archive entries against its closed contract before it enters the deterministic release and independent-verification pipeline.
 *
 * @param source - Serialized source text parsed into the domain document or archive-entry inventory.
 * @param verboseSource - Archive listing text parsed to validate every extracted entry and link target.
 */
export const validateArchiveEntries = (source, verboseSource = null) => {
	const entries = source.split("\n").filter(Boolean);
	if(entries.length === 0) fail("empty-release-archive", "Published release archive is empty");
	for(const entry of entries)
	{
		if(entry.includes("\\") || isAbsolute(entry) || entry.split("/").includes(".."))
		{
			fail("unsafe-release-archive", `Published release archive contains an unsafe path: ${entry}`);
		}
	}
	if(verboseSource !== null)
	{
		const verbose = verboseSource.split("\n").filter(Boolean);
		if(verbose.length !== entries.length || verbose.some(line => !new Set(["-", "d"]).has(line[0])))
		{
			fail("unsafe-release-archive-entry", "Published release archive may contain only regular files and directories");
		}
	}
	return Object.freeze(entries);
};

const downloadArchive = async ({ url, path, fetchImpl }) => {
	const parsed = new URL(url);
	if(parsed.protocol !== "https:") fail("unsupported-release-url", "Published release archives must use HTTPS");
	const response = await fetchImpl(url, { redirect: "follow" });
	if(!response.ok || response.body === null)
	{
		fail("release-download-failed", `Published release download returned HTTP ${response.status}`);
	}
	if(new URL(response.url).protocol !== "https:")
	{
		fail("unsupported-release-redirect", "Published release redirects must remain on HTTPS");
	}
	const declared = Number(response.headers.get("content-length"));
	if(Number.isFinite(declared) && declared > maximumArchiveBytes) fail("release-download-too-large", "Published release archive exceeds 1 GiB");
	let bytes = 0;
	const limiter = new Transform({
		transform:
			/**
       * Counts downloaded bytes, rejects archives over one GiB, and otherwise forwards each chunk unchanged.
       *
       * @param chunk - Input chunk supplied by the stream implementation.
       * @param encoding - Text encoding associated with the input chunk.
       * @param callback - Stream continuation receiving either the size error or the unchanged chunk.
       */
			function(chunk, encoding, callback) {
				bytes += chunk.length;
				if(bytes > maximumArchiveBytes) callback(new IndependentVerifierError("release-download-too-large", "Published release archive exceeds 1 GiB"));
				else callback(null, chunk);
			}
	});
	await pipeline(Readable.fromWeb(response.body), limiter, createWriteStream(path, { flags: "wx", mode: 0o600 }));
};

const locateAuthorizationRoot = async extracted => {
	const direct = join(extracted, "release-authorization.json");
	try
	{
		await readFile(direct);
		return extracted;
	} catch(error)
	{
		if(error.code !== "ENOENT") throw error;
	}
	const entries = await readdir(extracted, { withFileTypes: true });
	const candidates = [];
	for(const entry of entries)
	{
		if(!entry.isDirectory()) continue;
		try
		{
			await readFile(join(extracted, entry.name, "release-authorization.json"));
			candidates.push(join(extracted, entry.name));
		} catch(error)
		{
			if(error.code !== "ENOENT") throw error;
		}
	}
	if(candidates.length !== 1) fail("release-authorization-root-ambiguous", "Archive must contain one release authorization root");
	return candidates[0];
};

/**
 * Prepares published release in an isolated, deterministic form for the deterministic release and independent-verification pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to prepare published release.
 * @param root0.published - Published release locator and identity used for download or independent comparison.
 * @param root0.scratchRoot - Filesystem root containing the scratch.
 * @param root0.runner - Process runner used for isolated external commands.
 * @param root0.fetchImpl - Injected Fetch-compatible implementation used to retrieve published release bytes over HTTPS.
 */
export const preparePublishedRelease = async ({ published, scratchRoot, runner = processBuildRunner, fetchImpl = fetch }) => {
	if(typeof published !== "string" || published === "") fail("published-release-required", "Published release path or HTTPS URL is required");
	let archive;
	if(!/^https?:\/\//.test(published))
	{
		const local = resolve(published);
		const facts = await stat(local);
		if(facts.isDirectory()) return local;
		if(!facts.isFile()) fail("unsupported-published-release", "Published release must be a directory or tar archive");
		if(facts.size > maximumArchiveBytes) fail("release-archive-too-large", "Published release archive exceeds 1 GiB");
		archive = local;
	} else
	{
		archive = join(scratchRoot, "published-release.tar");
		await downloadArchive({ url: published, path: archive, fetchImpl });
	}
	const extracted = join(scratchRoot, "published-release");
	const [listing, verbose] = await Promise.all([
		capture(runner, { command: "tar", args: ["-tf", archive], cwd: scratchRoot })
		, capture(runner, { command: "tar", args: ["-tvf", archive], cwd: scratchRoot })
	]);
	validateArchiveEntries(listing.stdout, verbose.stdout);
	await mkdir(extracted);
	await capture(runner, {
		command: "tar"
		, args: ["--no-same-owner", "--same-permissions", "-xf", archive, "-C", extracted]
		, cwd: scratchRoot
	});
	return locateAuthorizationRoot(extracted);
};

/**
 * Checks out independent source and returns structured evidence instead of relying on prose diagnostics in the deterministic release and independent-verification pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to checkout independent source.
 * @param root0.repository - Source repository cloned into an isolated directory for independent rebuilding.
 * @param root0.revision - Exact source revision checked out, rebuilt, or recorded in the release bundle.
 * @param root0.scratchRoot - Filesystem root containing the scratch.
 * @param root0.runner - Process runner used for isolated external commands.
 */
export const checkoutIndependentSource = async ({ repository, revision, scratchRoot, runner = processBuildRunner }) => {
	if(typeof repository !== "string" || repository === "") fail("repository-required", "Source repository is required");
	if(typeof revision !== "string" || !/^[0-9a-f]{40}$/.test(revision)) fail("revision-required", "Source revision must be a 40-character Git commit");
	const source = join(scratchRoot, "source");
	await capture(runner, {
		command: "git"
		, args: ["clone", "--quiet", "--no-checkout", repository, source]
		, cwd: scratchRoot
	});
	await capture(runner, {
		command: "git"
		, args: ["-C", source, "checkout", "--quiet", "--detach", revision]
		, cwd: scratchRoot
	});
	return source;
};

/**
 * Verifies independent release against recorded identities and rejects any drift before the deterministic release and independent-verification pipeline proceeds.
 *
 * @param root0 - Named inputs and dependency overrides used to verify independent release.
 * @param root0.repository - Source repository cloned into an isolated directory for independent rebuilding.
 * @param root0.revision - Exact source revision checked out, rebuilt, or recorded in the release bundle.
 * @param root0.published - Published release locator and identity used for download or independent comparison.
 * @param root0.outputRoot - Filesystem root containing the output.
 * @param root0.verifierIdentity - Independent verifier identity recorded as confirmation provenance.
 * @param root0.reportUrl - Stable URL where reviewers can inspect the independent verification report.
 * @param root0.environment - Environment variables used to resolve tools and policy.
 * @param root0.runner - Process runner used for isolated external commands.
 * @param root0.fetchImpl - Injected Fetch-compatible implementation used to retrieve published release bytes over HTTPS.
 * @param root0.preparePublished - Injected function that downloads, bounds, and extracts the published release closure.
 * @param root0.checkoutSource - Injected checkout function that materializes the requested repository revision in isolation.
 * @param root0.gate - Injected reproducibility gate used to compare independently produced artifacts.
 * @param root0.verifyAuthorization - Injected verifier that checks release authorization before independent comparison.
 * @param root0.now - Injected clock returning the current timestamp for deterministic lifecycle records.
 */
export const verifyIndependentRelease = async ({
	repository
	, revision = null
	, published
	, outputRoot
	, verifierIdentity = null
	, reportUrl = null
	, environment = process.env
	, runner = processBuildRunner
	, fetchImpl = fetch
	, preparePublished = preparePublishedRelease
	, checkoutSource = checkoutIndependentSource
	, gate = runReproducibilityGate
	, verifyAuthorization = verifyReleaseAuthorization
	, now = () => new Date().toISOString()
} = {}) => {
	const output = resolve(outputRoot ?? join(process.cwd(), "build", "independent-confirmation"));
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-independent-verifier-"));
	try
	{
		const publishedRoot = await preparePublished({ published, scratchRoot: scratch, runner, fetchImpl });
		const publishedVerification = await verifyAuthorization({
			authorizationRoot: publishedRoot
			, candidateRoot: join(publishedRoot, "release")
		});
		const selectedRevision = revision ?? publishedVerification.candidate.sourceRevision;
		if(selectedRevision !== publishedVerification.candidate.sourceRevision)
		{
			fail("published-revision-drift", "Requested source revision differs from the published authorization", {
				requested: selectedRevision
				, published: publishedVerification.candidate.sourceRevision
			});
		}
		const source = await checkoutSource({ repository, revision: selectedRevision, scratchRoot: scratch, runner });
		const rebuiltRoot = join(scratch, "rebuilt-gate");
		const rebuiltGate = await gate({ projectRoot: source, outputRoot: rebuiltRoot, environment });
		const rebuiltVerification = await verifyAuthorization({
			authorizationRoot: rebuiltRoot
			, candidateRoot: join(rebuiltRoot, "release")
		});
		const rebuiltReport = JSON.parse(await readFile(rebuiltGate.report, "utf8"));
		const confirmation = createIndependentConfirmation({
			published: publishedVerification
			, rebuilt: {
				candidate: rebuiltVerification.candidate
				, authorizationSha256: rebuiltVerification.authorizationSha256
				, reportSha256: rebuiltGate.reportSha256
			}
			, verifierIdentity
			, reportUrl
			, environment: {
				source: rebuiltReport.source
				, builds: rebuiltReport.builds.map(item => ({
					backend: item.backend
					, backendVersion: item.backendVersion
					, builderDefinitionSha256: item.builderDefinitionSha256
					, platform: item.platform
					, runtimeProfile: item.runtimeProfile
				}))
			}
			, confirmedAt: now()
		});
		const written = await writeIndependentConfirmation({ outputRoot: output, confirmation });
		return Object.freeze({
			status: "confirmed"
			, candidate: publishedVerification.candidate
			, publishedAuthorizationSha256: publishedVerification.authorizationSha256
			, rebuiltAuthorizationSha256: rebuiltVerification.authorizationSha256,
			...written
		});
	} finally
	{
		await rm(scratch, { recursive: true, force: true });
	}
};
