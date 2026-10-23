/**
 * Authenticate and independently replay the hosted dependent checked-record
 * npm/browser archive, including its original GitHub artifact and sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkDependentCheckedRecordBrowserCiRecords
} from "./dependent-checked-record-browser-ci-report.mjs";
import {
	dependentCheckedRecordRoutes
	, dependentCheckedRecordSelection
} from "./dependent-checked-record-browser-fixture.mjs";
import {
	dependentCheckedRecordBrowserEvidenceSources
	, dependentCheckedRecordHostedOriginal
} from "./dependent-checked-record-hosted-evidence-sources.mjs";
import {
	extractDependentCheckedRecordHostedArtifact
	, inspectDependentCheckedRecordHostedArtifact
} from "./dependent-checked-record-hosted-archive.mjs";

export const dependentCheckedRecordBrowserEvidence
	= "docs/evidence/dependent-checked-record-browser-20261021";
/** Replaced with the archived index digest before this verifier is committed. */
export const dependentCheckedRecordBrowserEvidenceSha256
	= "1575ac337535956d04054fe650ff7204cac9b8f05b06f1428fa788743e8ceca9";

const producerRevision = "733693e06a1461541d4d3d7a43d8496d26c2df45";
const archiveRevision = "60319e850a71614e1ca9e9e90e15d6ea3a51289b";
const revisions = Object.freeze({
	producer: producerRevision, consumer: producerRevision
	, checker: archiveRevision, archiver: archiveRevision
});
const limitations = Object.freeze([
	"The fixture carries a retained Nat bound beside a proof-erased Fin payload and rejects every below value that is not strictly less than its sibling bound."
	, "Ordinary Lean source and independently reviewed Binding IR are exercised through full and result-only npm APIs."
	, "Node JavaScript, strict TypeScript, Chromium, Firefox and WebKit execute source-free installed packages; browser contexts cover pages, React production and StrictMode, and dedicated workers."
	, "Complete component/runtime npm archives, receipts, reports, TAP, browser observations, workflow logs, GitHub API records and a byte-exact split of the original artifact ZIP are retained and independently replayed."
	, "External browser, Node, compiler, Nix and operating-system distributions remain trusted inputs represented by recorded identities rather than copied toolchains."
	, "This lane establishes installed npm/browser acceptance only; aggregate support promotion and other dependent checked-record hosts require separate evidence."
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

/** Return the four immutable revisions bound by the hosted archive. */
export const dependentCheckedRecordBrowserEvidenceRevisions = () => ({
	...revisions
});

/**
 * Verify every retained byte, reconstruct the original Actions ZIP,
 * authenticate the API records, and replay all four checker inputs.
 *
 * @param read - Repository-relative evidence reader.
 */
export const checkDependentCheckedRecordBrowserEvidence = async (
	read = readFile
) => {
	if(read === readFile && cached) return cached;
	const checking = (async () => {
		const indexPath = `${dependentCheckedRecordBrowserEvidence}/index.json`;
		const indexBytes = Buffer.from(await read(indexPath));
		assert.equal(sha256(indexBytes)
			, dependentCheckedRecordBrowserEvidenceSha256, "index.json");
		const index = json(indexBytes, "index.json"), files = new Map();
		exactKeys(index, [
			"archiveCommit", "browserVersions", "checkerCommit"
			, "consumerCommit", "files", "hostedRun", "kind", "limitations"
			, "producerCommit", "runs", "schemaVersion", "selectedSources"
		], "index keys");
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind
			, "dependent-checked-record-browser-installed-v1");
		assert.equal(index.producerCommit, revisions.producer);
		assert.equal(index.consumerCommit, revisions.consumer);
		assert.equal(index.checkerCommit, revisions.checker);
		assert.equal(index.archiveCommit, revisions.archiver);
		assert.deepEqual(index.limitations, limitations);
		exactKeys(index.browserVersions
			, ["chromium", "firefox", "webkit"], "browser versions");
		for(const [engine, version] of Object.entries(index.browserVersions))
			assert.ok(typeof version === "string" && version.length > 0, engine);
		let previousPath = "";
		for(const descriptor of index.files)
		{
			exactKeys(descriptor, ["bytes", "path", "sha256"], "file");
			assert.ok(safePath(descriptor.path) && !files.has(descriptor.path)
				, descriptor.path);
			assert.ok(previousPath === ""
				|| previousPath.localeCompare(descriptor.path) < 0
				, descriptor.path);
			previousPath = descriptor.path;
			assert.ok(Number.isSafeInteger(descriptor.bytes)
				&& descriptor.bytes >= 0, descriptor.path);
			assert.match(descriptor.sha256, /^[a-f0-9]{64}$/u);
			const bytes = Buffer.from(await read(
				`${dependentCheckedRecordBrowserEvidence}/${descriptor.path}`));
			assert.equal(bytes.length, descriptor.bytes, descriptor.path);
			assert.equal(sha256(bytes), descriptor.sha256, descriptor.path);
			files.set(descriptor.path, bytes);
		}
		const get = path => {
			const bytes = files.get(path);
			assert.ok(Buffer.isBuffer(bytes), path);
			return bytes;
		};
		const expectedPaths = [];
		const selectedSources = dependentCheckedRecordBrowserEvidenceSources(
			revisions);
		assert.deepEqual(index.selectedSources, selectedSources);
		for(const source of selectedSources)
		{
			const path = `sources/${source.role}/${source.path}`;
			expectedPaths.push(path);
			assert.deepEqual(get(path), dependentCheckedRecordHostedOriginal(
				source.revision, source.path), path);
		}

		assert.deepEqual(index.runs.map(run => run.route)
			, dependentCheckedRecordRoutes);
		const runTap = get("hosted/run.tap");
		expectedPaths.push("hosted/run.tap");
		const accepted = [];
		for(const run of index.runs)
		{
			exactKeys(run, [
				"accepted", "recordCount", "resultOnly", "reviewed", "route"
				, "tapSha256"
			], `run ${run.route}`);
			const selection = dependentCheckedRecordSelection(run.route);
			assert.equal(run.reviewed, selection.reviewed);
			assert.equal(run.resultOnly, selection.resultOnly);
			assert.equal(run.tapSha256, sha256(runTap));
			const prefix = `${run.route}/records/`, records = new Map();
			for(const [path, bytes] of files)
				if(path.startsWith(prefix))
					records.set(path.slice(prefix.length), bytes);
			const paths = [...records.keys()].sort();
			const checked = await checkDependentCheckedRecordBrowserCiRecords({
				route: run.route, producer: revisions.producer
				, checker: revisions.checker, directory: "records"
				, tap: "hosted/run.tap"
			}, {
				tap: runTap.toString(), paths
				, read: path => {
					assert.ok(records.has(path), path); return records.get(path);
				}
			});
			assert.equal(run.recordCount, records.size);
			assert.deepEqual(run.accepted, checked);
			assert.deepEqual(checked.browserVersions, index.browserVersions);
			expectedPaths.push(...paths.map(path => `${prefix}${path}`));
			accepted.push(checked);
		}

		exactKeys(index.hostedRun, [
			"apiRecords", "artifact", "createdAt", "event", "job"
			, "conclusions", "repository", "runAttempt", "runId", "updatedAt", "url"
			, "workflow"
		], "hosted run");
		assert.deepEqual(index.hostedRun.conclusions
			, { run: "failure", job: "failure" });
		exactKeys(index.hostedRun.apiRecords
			, ["artifact", "job", "run"], "hosted API records");
		const apiRecords = {};
		for(const name of ["artifact", "job", "run"])
		{
			const path = `hosted/api/${name}.json`, bytes = get(path);
			expectedPaths.push(path);
			exactKeys(index.hostedRun.apiRecords[name]
				, ["bytes", "sha256"], `${name} API record`);
			apiRecords[name] = {
				bytes: bytes.length, sha256: sha256(bytes)
			};
		}
		exactKeys(index.hostedRun.artifact, [
			"apiDigest", "bytes", "createdAt", "expiresAt", "id", "members"
			, "name", "parts", "sha256"
		], "hosted artifact");
		let offset = 0;
		const partBytes = [];
		for(const part of index.hostedRun.artifact.parts)
		{
			exactKeys(part, ["bytes", "offset", "path", "sha256"]
				, "artifact part");
			assert.equal(part.offset, offset);
			assert.ok(part.path.startsWith("hosted/artifact.zip.parts/")
				&& safePath(part.path), part.path);
			const bytes = get(part.path);
			assert.equal(bytes.length, part.bytes, part.path);
			assert.equal(sha256(bytes), part.sha256, part.path);
			partBytes.push(bytes); expectedPaths.push(part.path);
			offset += bytes.length;
		}
		const artifact = Buffer.concat(partBytes);
		assert.equal(artifact.length, index.hostedRun.artifact.bytes);
		assert.equal(sha256(artifact), index.hostedRun.artifact.sha256);
		for(const path of [
			"hosted/logs/engine.log", "hosted/logs/runtime.log"
		]) {
			assert.ok(get(path).length > 0, path); expectedPaths.push(path);
		}

		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-dependent-browser-evidence-"));
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
			const inspected = await inspectDependentCheckedRecordHostedArtifact(
				inputs, {
					workflow: ".github/workflows/dependent-checked-record-browser.yml"
					, jobName: "Four dependent-record routes in Node and three browsers"
					, artifactPrefix: "dependent-checked-record-browser"
					, conclusions: { run: "failure", job: "failure" }
				}
			);
			assert.equal(inspected.revision, revisions.producer);
			extracted = await extractDependentCheckedRecordHostedArtifact(
				inputs["artifact-zip"]);
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
			const zipFiles = extracted.entries.filter(path => !path.endsWith("/"));
			const mappings = new Map([
				["dependent-checked-record-browser-engine.log"
					, "hosted/logs/engine.log"]
				, ["dependent-checked-record-browser-runtime.log"
					, "hosted/logs/runtime.log"]
				, ["dependent-checked-record-browser-ci/run.tap"
					, "hosted/run.tap"]
			]);
			for(const route of dependentCheckedRecordRoutes)
			{
				const prefix = `${route}/records/`;
				for(const path of files.keys()) if(path.startsWith(prefix))
					mappings.set(
						`dependent-checked-record-browser-ci/records/${route}/${path.slice(prefix.length)}`
						, path);
			}
			assert.deepEqual([...mappings.keys()].sort(), zipFiles.sort());
			for(const [zipPath, evidencePath] of mappings)
				assert.deepEqual(await readFile(join(extracted.root, zipPath))
					, get(evidencePath), zipPath);
		}
		finally
		{
			if(extracted) await rm(extracted.root, { recursive: true });
			await rm(root, { recursive: true });
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return Object.freeze({
			...revisions, routes: Object.freeze(accepted)
			, browserVersions: index.browserVersions
			, hostedRun: index.hostedRun, files: index.files
			, hostedAcceptance: true, supportPromoted: false
		});
	})();
	if(read === readFile) cached = checking;
	return checking;
};
