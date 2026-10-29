/**
 * Authenticate and independently replay the hosted HostNull JavaScript and
 * browser archive, including original GitHub bytes and complete npm handoffs.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	copyFile, mkdir, mkdtemp, readFile, rm, writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import {
	checkHostNullJavaScriptHostedReport
} from "./host-null-javascript-hosted-report.mjs";
import {
	hostNullJavaScriptHostedEvidenceSources
	, hostNullJavaScriptHostedOriginal
} from "./host-null-javascript-hosted-evidence-sources.mjs";
import {
	extractCheckedRecordValueIndexHostedArtifact as extractArtifact
	, inspectCheckedRecordValueIndexHostedArtifact as inspectArtifact
} from "./checked-record-value-index-hosted-archive.mjs";

export const hostNullJavaScriptBrowserEvidence
	= "docs/evidence/host-null-javascript-browser-20261029";
/** Replaced with the archived index digest in the evidence commit. */
export const hostNullJavaScriptBrowserEvidenceSha256
	= "PENDING_HOST_NULL_JAVASCRIPT_BROWSER_INDEX";

const producerRevision = "1d13d30f174d0f4750061cd601a6aebde3f3d69b";
const archiveRevision = "PENDING_HOST_NULL_ARCHIVE_COMMIT";
const revisions = Object.freeze({
	producer: producerRevision, consumer: producerRevision
	, checker: archiveRevision, archiver: archiveRevision
});
const limitations = Object.freeze([
	"The explicit compiler-authenticated HostNull wrapper maps its null branch to host null and its payload branch directly to T; it remains distinct from Option and omitted parameters."
	, "Ordinary Lean source and independently reviewed Binding IR are exercised through source-free installed npm packages."
	, "Node JavaScript, strict TypeScript, Chromium, Firefox and WebKit cover parameters, results, record fields, callback parameters and callback results in pages, React StrictMode and dedicated workers."
	, "Complete component/runtime npm archives, receipts, verifiers, report, GitHub API records and a byte-exact split of the original artifact ZIP are retained and independently replayed."
	, "External browser, Node, compiler, Nix and operating-system distributions remain trusted inputs represented by recorded identities rather than copied toolchains."
	, "This archive establishes JavaScript/browser HostNull acceptance only; other downstream hosts and aggregate support promotion require separate evidence."
]);
const exactKeys = (value, keys, label) => assert.deepEqual(
	Object.keys(value).sort(), [...keys].sort(), label);
const safePath = path => typeof path === "string"
	&& /^[A-Za-z0-9_@.+/-]+$/u.test(path) && !path.startsWith("/")
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, label) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), label);
	return value;
};
let cached;

/** Return the four revisions bound by the hosted archive. */
export const hostNullJavaScriptBrowserEvidenceRevisions = () => ({
	...revisions
});

/**
 * Verify every retained byte, replay its report and receipts, reconstruct the
 * original Actions ZIP, and authenticate the selected source closure.
 *
 * @param read - Repository-relative evidence reader.
 */
export const checkHostNullJavaScriptBrowserEvidence = async (
	read = readFile
) => {
	if(read === readFile && cached) return cached;
	const checking = (async () => {
		const indexPath = `${hostNullJavaScriptBrowserEvidence}/index.json`;
		const indexBytes = Buffer.from(await read(indexPath));
		assert.equal(sha256(indexBytes)
			, hostNullJavaScriptBrowserEvidenceSha256, "index.json");
		const index = json(indexBytes, "index.json"), files = new Map();
		exactKeys(index, [
			"accepted", "archiveCommit", "checkerCommit", "consumerCommit"
			, "files", "hostedRun", "kind", "limitations", "producerCommit"
			, "schemaVersion", "selectedSources"
		], "index keys");
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind
			, "host-null-javascript-browser-installed-v1");
		assert.equal(index.producerCommit, revisions.producer);
		assert.equal(index.consumerCommit, revisions.consumer);
		assert.equal(index.checkerCommit, revisions.checker);
		assert.equal(index.archiveCommit, revisions.archiver);
		assert.deepEqual(index.limitations, limitations);
		let previous = "";
		for(const descriptor of index.files)
		{
			exactKeys(descriptor, ["bytes", "path", "sha256"], "file");
			assert.ok(safePath(descriptor.path) && !files.has(descriptor.path));
			assert.ok(previous === ""
				|| previous.localeCompare(descriptor.path) < 0);
			previous = descriptor.path;
			assert.ok(Number.isSafeInteger(descriptor.bytes)
				&& descriptor.bytes >= 0);
			assert.match(descriptor.sha256, /^[a-f0-9]{64}$/u);
			const bytes = Buffer.from(await read(
				`${hostNullJavaScriptBrowserEvidence}/${descriptor.path}`));
			assert.equal(bytes.length, descriptor.bytes, descriptor.path);
			assert.equal(sha256(bytes), descriptor.sha256, descriptor.path);
			files.set(descriptor.path, bytes);
		}
		const get = path => {
			const bytes = files.get(path); assert.ok(Buffer.isBuffer(bytes), path);
			return bytes;
		};
		const expectedPaths = [];
		const selectedSources = hostNullJavaScriptHostedEvidenceSources(
			revisions);
		assert.deepEqual(index.selectedSources, selectedSources);
		for(const source of selectedSources)
		{
			const path = `sources/${source.role}/${source.path}`;
			expectedPaths.push(path);
			assert.deepEqual(get(path), hostNullJavaScriptHostedOriginal(
				source.revision, source.path), path);
		}
		const report = json(get("artifact/report.json"), "report.json");
		expectedPaths.push("artifact/report.json");
		const accepted = checkHostNullJavaScriptHostedReport(report);
		assert.deepEqual(index.accepted, accepted);

		exactKeys(index.hostedRun, [
			"apiRecords", "artifact", "conclusions", "createdAt", "event"
			, "job", "repository", "runAttempt", "runId", "updatedAt", "url"
			, "workflow"
		], "hosted run");
		exactKeys(index.hostedRun.apiRecords
			, ["artifact", "job", "run"], "API records");
		const apiRecords = {};
		for(const name of ["artifact", "job", "run"])
		{
			const path = `hosted/api/${name}.json`, bytes = get(path);
			expectedPaths.push(path);
			apiRecords[name] = { bytes: bytes.length, sha256: sha256(bytes) };
			assert.deepEqual(index.hostedRun.apiRecords[name], apiRecords[name]);
		}
		let offset = 0;
		const parts = [];
		for(const part of index.hostedRun.artifact.parts)
		{
			exactKeys(part, ["bytes", "offset", "path", "sha256"], "part");
			assert.equal(part.offset, offset);
			const bytes = get(part.path);
			assert.equal(bytes.length, part.bytes);
			assert.equal(sha256(bytes), part.sha256);
			parts.push(bytes); expectedPaths.push(part.path); offset += bytes.length;
		}
		const artifact = Buffer.concat(parts);
		assert.equal(artifact.length, index.hostedRun.artifact.bytes);
		assert.equal(sha256(artifact), index.hostedRun.artifact.sha256);

		const root = await mkdtemp(join(tmpdir(), "lean-host-null-evidence-"));
		let extracted;
		try
		{
			const inputs = {
				"artifact-zip": join(root, "artifact.zip")
				, "artifact-json": join(root, "artifact.json")
				, "job-json": join(root, "job.json")
				, "run-json": join(root, "run.json")
			};
			await writeFile(inputs["artifact-zip"], artifact, { flag: "wx" });
			for(const name of ["artifact", "job", "run"])
				await writeFile(inputs[`${name}-json`]
					, get(`hosted/api/${name}.json`), { flag: "wx" });
			const inspected = await inspectArtifact(inputs, {
				workflow: ".github/workflows/consumer-matrix.yml"
				, jobName: "Node and browser npm consumers"
				, artifactPrefix: "host-null-node-browser"
				, conclusions: index.hostedRun.conclusions
			});
			assert.equal(inspected.revision, revisions.producer);
			extracted = await extractArtifact(inputs["artifact-zip"]);
			assert.deepEqual(extracted.entries
				, index.hostedRun.artifact.members);
			assert.deepEqual(index.hostedRun, {
				...inspected.hostedRun, apiRecords
				, artifact: {
					...inspected.hostedRun.artifact
					, members: extracted.entries
					, parts: index.hostedRun.artifact.parts
				}
			});
			for(const path of extracted.entries.filter(path => !path.endsWith("/")))
			{
				const evidencePath = `artifact/${path}`;
				expectedPaths.push(evidencePath);
				assert.deepEqual(await readFile(join(extracted.root, path))
					, get(evidencePath), path);
			}
			for(const run of report.runs)
			{
				const handoff = join(root, run.path); await mkdir(handoff);
				for(const path of [
					"component-package-receipt.json", run.receipt.package.archive
					, run.receipt.runtime.archive
				]) await copyFile(join(extracted.root, run.path, path)
					, join(handoff, path));
				const checked = await verifyComponentPackageReceipt({
					receiptPath: join(handoff, "component-package-receipt.json")
				});
				assert.equal(checked.verified, true);
			}
		}
		finally
		{
			if(extracted) await rm(extracted.root, { recursive: true });
			await rm(root, { recursive: true });
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return Object.freeze({
			...revisions, accepted, hostedRun: index.hostedRun
			, files: index.files, hostedAcceptance: true
			, supportPromoted: false
		});
	})();
	if(read === readFile) cached = checking;
	return checking;
};
