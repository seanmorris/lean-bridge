/**
 * Keep primitive-base nominal browser evidence tied to all four original installed selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { nominalPrimitiveSubtypeBrowserArchive, nominalPrimitiveSubtypeBrowserArchiveSha256, nominalPrimitiveSubtypeBrowserProducer, nominalPrimitiveSubtypeBrowserSelections, checkNominalPrimitiveSubtypeBrowserArchive } from "./nominal-primitive-subtype-browser-archive.mjs";
import { checkNominalPrimitiveSubtypeBrowserControls } from "./nominal-primitive-subtype-browser-controls.mjs";

test("primitive-base browser archive reconciles four installed selections, complete packages and unchanged source epochs", async () => {
	const checked = await checkNominalPrimitiveSubtypeBrowserArchive();
	assert.equal(checked.producerCommit, nominalPrimitiveSubtypeBrowserProducer);
	assert.deepEqual(checked.installedProfiles, ["browser-javascript", "browser-react", "browser-worker"]);
	assert.equal(checked.supportPromoted, false); assert.equal(checked.requiredCiRegistered, true); assert.equal(checked.hostedAcceptance, false);
	assert.equal(checked.failedAttempts.length, 3);
	assert.equal(checked.failedAttempts[0].installedAcceptance, false);
	assert.equal(checked.failedAttempts[0].reason, "host-load-before-installation");
	assert.equal(checked.failedAttempts[1].installedAcceptance, false);
	assert.equal(checked.failedAttempts[1].reason, "host-load-before-second-author");
	assert.equal(checked.failedAttempts[2].installedAcceptance, false);
	assert.equal(checked.failedAttempts[2].mode, "result-only");
	assert.equal(checked.failedAttempts[2].reason, "host-load-before-second-author");
	assert.equal(checked.stoppedControls.length, 1);
	assert.equal(checked.stoppedControls[0].recordChecksStarted, false);
	assert.equal(checked.stoppedControls[0].installedAcceptance, false);
	assert.deepEqual(checked.selections.map(run => [run.route, run.mode]), nominalPrimitiveSubtypeBrowserSelections);
	let controls = 0, nodeExecutions = 0, browserExecutions = 0, observations = 0, checks = 0, rejections = 0;
	for(const run of checked.selections)
	{
		assert.deepEqual(run.runtime, { node: "v22.23.2", platform: "linux", arch: "x64" });
		assert.equal(run.checks, run.mode === "full" ? 1213 : 578);
		assert.equal(run.rejections, run.mode === "full" ? 283 : 0);
		assert.equal(run.rounds, 256); assert.equal(run.nodeExecutions, 2); assert.equal(run.browserExecutions, 12);
		assert.equal(run.lifecycleObservations, 51); assert.equal(run.wordBits, 32); assert.equal(run.dispatchObserved, false);
		assert.deepEqual(run.engines, ["chromium", "firefox", "webkit"]);
		assert.deepEqual(Object.keys(run.browserVersions).sort(), ["chromium", "firefox", "webkit"]);
		nodeExecutions += run.nodeExecutions; browserExecutions += run.browserExecutions; observations += run.lifecycleObservations;
		checks += run.checks * (run.nodeExecutions + run.lifecycleObservations);
		rejections += run.rejections * (run.nodeExecutions + run.lifecycleObservations);
		controls += run.recordControls + run.reportControls + run.adapterControls + run.browserControls;
	}
	assert.equal(controls, 1474);
	assert.deepEqual({ nodeExecutions, browserExecutions, observations, checks, rejections }, { nodeExecutions: 8, browserExecutions: 48, observations: 204, checks: 189846, rejections: 29998 });
	assert.deepEqual((await nativeArtifactPaths(nominalPrimitiveSubtypeBrowserArchive)).sort(), ["index.json", ...checked.files.map(file => file.path)].sort());
});

test("primitive-base browser archive refuses missing or changed producer, caller, package and runtime originals", async () => {
	const index = JSON.parse(await readFile(nominalPrimitiveSubtypeBrowserArchive + "/index.json"));
	const targets = [
		"index.json", "producer.mjs", "controls-runner.mjs"
		, "sources/src/analyze/NativeExports.lean", "runtime/main.wasm"
		, "sources/tests/fixtures/nominal-primitive-subtype-consumers/javascript.mjs"
		, ...index.files.filter(file => file.path.startsWith("failed/")).map(file => file.path)
		, ...index.files.filter(file => file.path.startsWith("stopped-controls/")).map(file => file.path)
		, ...index.runs.flatMap(({ route, mode }) => {
			const label = route + "/" + mode;
			return ["producer/start.json", "producer/complete.json", "producer/run.tap"
				, "controls/start.json", "controls/complete.json", "records/report.json"
				, "records/build-0/locks/compiler-adapters.json"
				, "records/installed/package-lock.json", "records/browser.json"
				, "records/browser-react/report.json"
				, "records/browser-worker/observations.json"
				, "records/browser-javascript/fixtures/nominal-primitive-subtype-consumers/browser.mjs"]
				.map(path => label + "/" + path);
		})
		, ...index.files.filter(file => file.path.endsWith(".tgz")).map(file => file.path)
	];
	for(const path of targets) for(const missing of [true, false])
		await assert.rejects(checkNominalPrimitiveSubtypeBrowserArchive(async requested => {
			if(requested !== nominalPrimitiveSubtypeBrowserArchive + "/" + path) return readFile(requested);
			if(missing) throw new Error("Missing original: " + path);
			return Buffer.concat([await readFile(requested), Buffer.from("changed")]);
		}), undefined, path);
});

test("primitive-base browser archive refuses substituted host, source, selection and coverage index claims", async () => {
	const original = await readFile(nominalPrimitiveSubtypeBrowserArchive + "/index.json"), index = JSON.parse(original);
	assert.equal(sha256(original), nominalPrimitiveSubtypeBrowserArchiveSha256);
	const mutations = [
		value => { value.producerCommit = "0".repeat(40); }
		, value => { value.runs.pop(); }, value => { value.runs.reverse(); }
		, value => { value.runs.push(value.runs[0]); }
		, value => { value.runs[0].route = "reviewed"; }
		, value => { value.runs[0].mode = "result-only"; }
		, value => { value.runs[2].attempt = "r1"; }
		, value => { value.runs[3].attempt = "r1"; }
		, value => { value.runs[3].controlAttempt = "r1"; }
		, value => { value.stoppedControls = []; }
		, value => { value.stoppedControls[0].installedAcceptance = true; }
		, value => { value.failedAttempts = []; }
		, value => { value.failedAttempts[0].installedAcceptance = true; }
		, value => { value.failedAttempts[0].reason = "accepted"; }
		, value => { value.runs[0].runtime.node = "v24.0.0"; }
		, value => { value.runs[0].counts.dispatchObserved = true; }
		, value => { value.runs[0].counts.browserExecutions = 1; }
		, value => { value.runs[0].tapSha256 = "0".repeat(64); }
		, value => { value.runs[0].reportSha256 = "0".repeat(64); }
		, value => { value.selectedSources.pop(); }
		, value => { value.files.pop(); }
		, value => { value.files.push(value.files[0]); }
		, value => { value.files[0].path = "../outside"; }
		, value => { value.files[0].sha256 = "0".repeat(64); }
		, value => { value.limitations = []; }
	];
	for(const mutate of mutations)
	{
		const value = structuredClone(index); mutate(value);
		await assert.rejects(checkNominalPrimitiveSubtypeBrowserArchive(async path => path.endsWith("/index.json") ? Buffer.from(canonicalJson(value)) : readFile(path)));
	}
	assert.deepEqual(await readFile(nominalPrimitiveSubtypeBrowserArchive + "/index.json"), original);
});

test("primitive-base browser archived originals reject all 1474 coordinated record, constructor and lifecycle controls", async () => {
	const index = JSON.parse(await readFile(nominalPrimitiveSubtypeBrowserArchive + "/index.json"));
	assert.equal(sha256(canonicalJson(index)), nominalPrimitiveSubtypeBrowserArchiveSha256);
	let controls = 0;
	for(const run of index.runs)
	{
		const prefix = run.route + "/" + run.mode + "/records/";
		const records = new Map();
		for(const file of index.files.filter(file => file.path.startsWith(prefix)))
			records.set(file.path.slice(prefix.length), await readFile(nominalPrimitiveSubtypeBrowserArchive + "/" + file.path));
		const checked = await checkNominalPrimitiveSubtypeBrowserControls(records, run);
		assert.deepEqual(checked, { recordControls: run.mode === "full" ? 176 : 174, reportControls: 23, adapterControls: run.mode === "full" ? 42 : 23, browserControls: 138 });
		controls += checked.recordControls + checked.reportControls + checked.adapterControls + checked.browserControls;
	}
	assert.equal(controls, 1474);
});
