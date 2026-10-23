/**
 * Authenticate and independently replay the hosted value-index npm/browser
 * archive, including the original GitHub artifact and every frozen source.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkCheckedRecordValueIndexBrowserCiRecords
	, checkedRecordValueIndexBrowserControlContracts
} from "./checked-record-value-index-browser-ci-report.mjs";
import {
	checkedRecordValueIndexBrowserRoutes
	, checkedRecordValueIndexBrowserSelection
} from "./checked-record-value-index-browser-fixture.mjs";
import {
	checkedRecordValueIndexBrowserEvidenceSources
	, checkedRecordValueIndexHostedOriginal
} from "./checked-record-value-index-hosted-evidence-sources.mjs";
import {
	extractCheckedRecordValueIndexHostedArtifact
	, inspectCheckedRecordValueIndexHostedArtifact
} from "./checked-record-value-index-hosted-archive.mjs";

export const checkedRecordValueIndexBrowserEvidence
	= "docs/evidence/checked-record-value-index-browser-20261019";
export const checkedRecordValueIndexBrowserEvidenceSha256
	= "c776acf181b38744191bddbfbe515f14e515d59eaa94e4a942acddc8c76b34e0";

const revisions = Object.freeze({
	producer: "79359306d2e50a5893affe04cafed95d54166b88"
	, npmChecker: "79359306d2e50a5893affe04cafed95d54166b88"
	, consumer: "79359306d2e50a5893affe04cafed95d54166b88"
	, checker: "79359306d2e50a5893affe04cafed95d54166b88"
	, archiver: "42f841b82394cb71043bcfaf063be57542b5d0c9"
});
const cellFiles = Object.freeze([
	"acceptance.tap", "controls.tap", "runtime-after.json"
	, "runtime-before.json", "verification.json"
]);
const limitations = Object.freeze([
	"The fixture covers closed Bool, String and Nat value indices: both booleans, empty and Unicode strings, zero and a Nat wider than 64 bits."
	, "Ordinary Lean source and independently reviewed Binding IR are exercised through full and result-only npm APIs."
	, "Node JavaScript, strict TypeScript, Chromium, Firefox and WebKit execute source-free installed packages; browser contexts cover pages, React production and StrictMode, and dedicated workers."
	, "Complete component/runtime npm archives, receipts, reports, controls, TAP, browser observations, workflow logs, GitHub API records and a byte-exact split of the original artifact ZIP are retained."
	, "External browser, Node, compiler, Nix and operating-system distributions remain trusted inputs represented by recorded identities rather than copied toolchains."
	, "This lane establishes installed npm/browser acceptance only; aggregate support promotion and other value-index hosts require separate evidence."
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

/** Return the five immutable revisions bound by the hosted archive. */
export const checkedRecordValueIndexBrowserEvidenceRevisions = () => ({
	...revisions
});

/**
 * Verify every retained byte, reconstruct the original Actions ZIP, authenticate
 * its API records, and replay all four exact hosted checker inputs.
 *
 * @param read - Repository-relative evidence reader.
 */
export const checkCheckedRecordValueIndexBrowserEvidence = async (
	read = readFile
) => {
	if(read === readFile && cached) return cached;
	const checking = (async () => {
		const indexPath = `${checkedRecordValueIndexBrowserEvidence}/index.json`;
		const indexBytes = Buffer.from(await read(indexPath));
		assert.equal(sha256(indexBytes)
			, checkedRecordValueIndexBrowserEvidenceSha256, "index.json");
		const index = json(indexBytes, "index.json"), files = new Map();
		exactKeys(index, [
			"archiveCommit", "browserVersions", "checkerCommit", "consumerCommit"
			, "files", "hostedRun", "kind", "limitations", "loadCeiling"
			, "npmCheckerCommit", "producerCommit", "runs", "runtime"
			, "schemaVersion", "selectedSources"
		], "index keys");
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind
			, "checked-record-value-index-browser-installed-v1");
		assert.equal(index.producerCommit, revisions.producer);
		assert.equal(index.npmCheckerCommit, revisions.npmChecker);
		assert.equal(index.consumerCommit, revisions.consumer);
		assert.equal(index.checkerCommit, revisions.checker);
		assert.equal(index.archiveCommit, revisions.archiver);
		assert.equal(index.loadCeiling, 8);
		assert.deepEqual(index.limitations, limitations);
		exactKeys(index.runtime, ["arch", "node", "platform"], "runtime");
		exactKeys(index.browserVersions, [
			"chromium", "firefox", "webkit"
		], "browser versions");
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
				`${checkedRecordValueIndexBrowserEvidence}/${descriptor.path}`));
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
		const selectedSources = checkedRecordValueIndexBrowserEvidenceSources(
			revisions);
		assert.deepEqual(index.selectedSources, selectedSources);
		for(const source of selectedSources)
		{
			const path = `sources/${source.role}/${source.path}`;
			expectedPaths.push(path);
			assert.deepEqual(get(path), checkedRecordValueIndexHostedOriginal(
				source.revision, source.path), path);
		}

		assert.deepEqual(index.runs.map(run => run.route)
			, checkedRecordValueIndexBrowserRoutes);
		const accepted = [];
		for(const run of index.runs)
		{
			exactKeys(run, [
				"acceptanceTapSha256", "accepted", "controls"
				, "controlsTapSha256", "recordCount", "resultOnly", "reviewed"
				, "route", "verificationSha256"
			], `run ${run.route}`);
			const selection = checkedRecordValueIndexBrowserSelection(run.route);
			assert.equal(run.reviewed, selection.reviewed);
			assert.equal(run.resultOnly, selection.resultOnly);
			const prefix = `${run.route}/records/`, records = new Map();
			for(const [path, bytes] of files)
				if(path.startsWith(prefix))
					records.set(path.slice(prefix.length), bytes);
			const paths = [...records.keys()].sort();
			const cell = name => get(`${run.route}/${name}`);
			const before = cell("runtime-before.json");
			assert.deepEqual(cell("runtime-after.json"), before);
			assert.deepEqual(JSON.parse(before), index.runtime);
			const acceptanceTap = cell("acceptance.tap");
			const controlsTap = cell("controls.tap");
			assert.equal(run.acceptanceTapSha256, sha256(acceptanceTap));
			assert.equal(run.controlsTapSha256, sha256(controlsTap));
			const checked = await checkCheckedRecordValueIndexBrowserCiRecords({
				route: run.route, producer: revisions.producer
				, "npm-checker": revisions.npmChecker
				, consumer: revisions.consumer, checker: revisions.checker
				, directory: "records", "acceptance-tap": "acceptance.tap"
				, "controls-tap": "controls.tap", runtime: "runtime-before.json"
			}, {
				acceptanceTap: acceptanceTap.toString()
				, controlsTap: controlsTap.toString(), runtime: index.runtime, paths
				, read: path => {
					assert.ok(records.has(path), path); return records.get(path);
				}
			}, checkedRecordValueIndexBrowserControlContracts.archived20261019);
			assert.equal(run.recordCount, records.size);
			assert.deepEqual(run.accepted, checked);
			assert.deepEqual(run.controls, checked.controls);
			assert.deepEqual(checked.browserVersions, index.browserVersions);
			const verification = cell("verification.json");
			assert.equal(run.verificationSha256, sha256(verification));
			assert.equal(verification.toString(), canonicalJson(checked));
			expectedPaths.push(...paths.map(path => `${prefix}${path}`)
				, ...cellFiles.map(name => `${run.route}/${name}`));
			accepted.push(checked);
		}

		exactKeys(index.hostedRun, [
			"apiRecords", "artifact", "createdAt", "event", "job"
			, "repository", "runAttempt", "runId", "updatedAt", "url"
			, "workflow"
		], "hosted run");
		exactKeys(index.hostedRun.apiRecords, [
			"artifact", "job", "run"
		], "hosted API records");
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
		assert.deepEqual(index.hostedRun.apiRecords, apiRecords);
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
		for(const path of ["hosted/logs/engine.log", "hosted/logs/runtime.log"])
		{
			get(path); expectedPaths.push(path);
		}

		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-value-index-browser-evidence-"));
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
			const inspected = await inspectCheckedRecordValueIndexHostedArtifact(
				inputs, {
					workflow: ".github/workflows/checked-record-value-index-browser.yml"
					, jobName: "Four value-index routes in Node and three browsers"
					, artifactPrefix: "checked-record-value-index-browser"
				}
			);
			assert.equal(inspected.revision, revisions.producer);
			extracted = await extractCheckedRecordValueIndexHostedArtifact(
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
				["checked-record-value-index-browser-engine.log"
					, "hosted/logs/engine.log"]
				, ["checked-record-value-index-browser-runtime.log"
					, "hosted/logs/runtime.log"]
			]);
			for(const route of checkedRecordValueIndexBrowserRoutes)
			{
				for(const name of cellFiles) mappings.set(
					`checked-record-value-index-browser-ci/${route}/${name}`
					, `${route}/${name}`);
				const prefix = `${route}/records/`;
				for(const path of files.keys()) if(path.startsWith(prefix))
					mappings.set(
						`checked-record-value-index-browser-ci/records/${route}/${path.slice(prefix.length)}`
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
			, runtime: index.runtime, browserVersions: index.browserVersions
			, hostedRun: index.hostedRun, files: index.files
			, hostedAcceptance: true, supportPromoted: false
		});
	})();
	if(read === readFile) cached = checking;
	return checking;
};
