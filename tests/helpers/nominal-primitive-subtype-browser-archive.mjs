/**
 * Authenticate four original primitive-base browser selections and their complete npm handoffs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNominalPrimitiveSubtypeBrowserReport, nominalPrimitiveSubtypeBrowserRecords } from "./nominal-primitive-subtype-browser-report.mjs";
import { assertNominalPrimitiveSubtypeBrowserTap } from "./nominal-primitive-subtype-browser-ci-report.mjs";
import { nominalPrimitiveSubtypeNpmArchiveSources } from "./nominal-primitive-subtype-npm-archive.mjs";
import { nominalPrimitiveSubtypeBrowserOriginal, nominalPrimitiveSubtypeBrowserSnapshot, nominalPrimitiveSubtypeBrowserGeneratorClosure } from "./nominal-primitive-subtype-browser-sources.mjs";

export const nominalPrimitiveSubtypeBrowserArchive = "docs/evidence/nominal-primitive-subtype-browser-20261014";
export const nominalPrimitiveSubtypeBrowserArchiveSha256 = "77930a36d318c8716ffc9081d64d00667e1142d676125f244e5c0c709b9a78a5";
export const nominalPrimitiveSubtypeBrowserProducer = "310f653c2bbc14178809eae23c4ae0bfea70cba1";
export const nominalPrimitiveSubtypeBrowserSelections = [["ordinary", "full"], ["ordinary", "result-only"], ["reviewed", "full"], ["reviewed", "result-only"]];
export const nominalPrimitiveSubtypeBrowserAttempts = {
	"ordinary/full": "r1", "ordinary/result-only": "r1"
	, "reviewed/full": "r3", "reviewed/result-only": "r2"
};
export const nominalPrimitiveSubtypeBrowserControlAttempts = {
	"ordinary/full": "r1", "ordinary/result-only": "r1"
	, "reviewed/full": "r1", "reviewed/result-only": "r2"
};
export const nominalPrimitiveSubtypeBrowserFailures = [
	{ route: "reviewed", mode: "full", attempt: "r1"
		, builds: 2, files: 21, waits: 20, line: 114, column: 2
		, reason: "host-load-before-installation"
		, tapSha256: "5e7a20f755312f99866eb843f3563807651e95cb80a689c0424e1e3fe2c3477e" }
	, { route: "reviewed", mode: "full", attempt: "r2"
		, builds: 1, files: 11, waits: 21, line: 68, column: 3
		, reason: "host-load-before-second-author"
		, tapSha256: "1263f1d67bdaa7540a38b56aaf6daa44e904aa2fb568486d10b55571f259033d" }
	, { route: "reviewed", mode: "result-only", attempt: "r1"
		, builds: 1, files: 11, waits: 20, line: 68, column: 3
		, reason: "host-load-before-second-author"
		, tapSha256: "616fd29b6259cea6f49a7d57e2d018a2e362521ad42bb56823663b1383370191" }
];
export const nominalPrimitiveSubtypeBrowserArchiveSources = [...new Set([
	...nominalPrimitiveSubtypeNpmArchiveSources
	, ...["browser", "browser-fixture", "browser-report", "browser-ci-report"
		, "browser-ci-workflow", "browser-controls", "caller-model", "npm-controls"
	].map(name => "tests/helpers/nominal-primitive-subtype-" + name + ".mjs")
	, "tests/fixtures/nominal-primitive-subtype-consumers/browser.mjs"
	, "tests/helpers/type-corpus-browser.mjs", "tests/helpers/type-corpus.mjs"
	, ...["plain", "react", "worker", "worker-main"].map(name => "tests/fixtures/type-corpus/consumers/browser/" + name + ".mjs")
	, "scripts/check-nominal-primitive-subtype-browser-ci.mjs"
	, "scripts/run-nominal-primitive-subtype-browser-ci.sh"
	, ".github/workflows/nominal-primitive-subtype-browser.yml"
	, "scripts/verify-playwright-browsers.mjs", "site/serve.mjs"
	, "package.json", "package-lock.json"
])].sort();
const runtime = { node: "v22.23.2", platform: "linux", arch: "x64" };
const producerFiles = ["start.json", "outcome.json", "complete.json", "run.tap"];
const safePath = path => typeof path === "string" && /^[A-Za-z0-9_@.+/-]+$/u.test(path)
	&& !path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== "..");
const json = bytes => {
	const value = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(value)); return value;
};
const resources = value => {
	assert.equal(value.observations.length, value.waits + 1);
	assert.ok(Number.isInteger(value.waits) && value.waits >= 0 && value.waits <= 20);
	for(const sample of value.observations)
	{
		assert.ok(sample.freeBytes >= 2 * 1024 ** 3 && sample.availableBytes >= 2 * 1024 ** 3);
		assert.ok(Number.isFinite(sample.load) && sample.load >= 0);
	}
	assert.ok(value.observations.at(-1).load < 6);
};

const failedAttempt = (index, files, snapshot, runtimeFiles, expected, previousFinish) => {
	const { route, mode, attempt } = expected, selection = route + "/" + mode;
	const failed = index.failedAttempts.find(item => item.route === route && item.mode === mode && item.attempt === attempt);
	const label = `failed/${selection}/${attempt}/`;
	const get = path => {
		const bytes = files.get(label + path); assert.ok(Buffer.isBuffer(bytes), path); return bytes;
	};
	const start = json(get("start.json")), end = json(get("outcome.json")), tap = get("run.tap");
	assert.deepEqual(failed, {
		route, mode, attempt
		, producerCommit: index.producerCommit, runtime
		, originalDirectory: `/app/build/vo1469-browser-installed-${route}-${mode}-${attempt}`
		, started: start.started, finished: end.finished
		, tapSha256: expected.tapSha256
		, status: "failed", installedAcceptance: false
		, reason: expected.reason
	});
	const accepted = index.runs.find(run => run.route === route && run.mode === mode);
	const retry = json(files.get(selection + "/producer/start.json"));
	assert.ok(Date.parse(start.started) > previousFinish);
	assert.ok(Date.parse(end.finished) > Date.parse(start.started) && Date.parse(end.finished) < Date.parse(accepted.started));
	for(const value of [start, end])
	{
		assert.equal(value.head, index.producerCommit); assert.equal(value.route, route); assert.equal(value.mode, mode);
	}
	assert.deepEqual(start.sources, snapshot); assert.deepEqual(start.runtime, runtimeFiles);
	assert.deepEqual(start.hostRuntime, runtime); assert.equal(start.runnerSha256, sha256(files.get("producer.mjs")));
	for(const key of ["args", "nodeExecutable", "browserProbe", "runtimeRoot"])
		assert.deepEqual(start[key], retry[key], key);
	assert.deepEqual(start.selectedEnvironment, { ...retry.selectedEnvironment
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_OUTPUT: failed.originalDirectory + "/selections" });
	resources(start.resources);
	assert.deepEqual([end.code, end.signal], [1, null]);
	assert.deepEqual(end.tests, { tests: 1, pass: 0, fail: 1, cancelled: 0, skipped: 0, todo: 0 });
	assert.deepEqual(end.changed, []); assert.deepEqual(end.runtimeChanged, []);
	for(const key of ["pathsUnchanged", "headUnchanged", "runnerUnchanged", "runtimePathsUnchanged", "nodeExecutableUnchanged"]) assert.equal(end[key], true);
	assert.equal(end.bytes, tap.length); assert.equal(end.tapSha256, sha256(tap)); assert.equal(end.tapSha256, failed.tapSha256);
	assert.ok(tap.toString().includes(`not ok 1 - installed npm primitive-base nominal Subtypes reproduce and relocate ${route} ${mode}\n`));
	assert.match(tap.toString(), /error: 'C# producer host load remained at or above 6 for five minutes'/u);
	assert.ok(tap.toString().includes(`nominal-primitive-subtype-npm-installed-tests.mjs:${expected.line}:${expected.column}`));
	assert.match(tap.toString(), /# tests 1\n# suites 0\n# pass 0\n# fail 1\n# cancelled 0\n# skipped 0\n/u);
	const waits = [...tap.toString().matchAll(/^# Waiting for host load below 6 before the next primitive npm phase: ([0-9.]+)$/gmu)];
	assert.equal(waits.length, expected.waits); assert.ok(waits.every(match => Number(match[1]) >= 6));
	const receipt = json(files.get(selection + "/records/handoff/component-package-receipt.json"));
	const records = ["configuration.json", "expected.binding-ir.json"
		, ...Array.from({ length: expected.builds }, (_, attempt) => attempt).flatMap(attempt => [
			"NominalPrimitiveSubtypes.lean", "binding/binding-ir.json"
			, "component-package-receipt.json", "locks/compiler-adapters.json"
			, "locks/component-build-plan.json"
			, "metadata/provenance.json"].map(path => `build-${attempt}/${path}`))
		, ...expected.builds === 2 ? ["component-package-receipt.json", "verify-component-package-receipt.mjs", receipt.package.archive, receipt.runtime.archive].map(path => "handoff/" + path) : []];
	for(const path of records)
		assert.deepEqual(get("selections/" + selection + "/" + path), files.get(selection + "/records/" + path), path);
	const paths = ["start.json", "outcome.json", "run.tap", ...records.map(path => "selections/" + selection + "/" + path)].map(path => label + path);
	assert.equal(paths.length, expected.files); return paths;
};

const stoppedControls = (index, files) => {
	const label = "stopped-controls/reviewed/result-only/r1/";
	const paths = ["resource-stop.json", "run.log"].map(path => label + path);
	const record = JSON.parse(files.get(paths[0])), log = files.get(paths[1]);
	assert.deepEqual(index.stoppedControls, [record]);
	assert.deepEqual(record, {
		schemaVersion: 1, kind: "browser-controls-resource-stop"
		, head: index.producerCommit, route: "reviewed", mode: "result-only"
		, attempt: "r1"
		, sourceRoot: "build/vo1469-browser-installed-reviewed-result-only-r2"
		, exitCode: 1
		, reason: "host-load-at-or-above-6-for-five-minutes-before-record-checks"
		, recordChecksStarted: false, installedAcceptance: false, compiledAgain: false
		, logSha256: "5290020b2acac9fb761c09a91438da09c1f7dc721536e8afd13f45c5303a8859"
		, logBytes: 1730
		, logProvenance: "Original combined stdout/stderr retained from exec_command/write_stdin response chunks"
		, sourcesUnchanged: index.sourceSnapshotCount, runtimeFilesUnchanged: 12
		, recorded: "2026-10-14T18:00:18.430Z"
	});
	assert.equal(log.length, record.logBytes); assert.equal(sha256(log), record.logSha256);
	const waits = [...log.toString().matchAll(/^Waiting for host load below 6 before the next C# phase: ([0-9.]+)$/gmu)];
	assert.equal(waits.length, 20); assert.ok(waits.every(match => Number(match[1]) >= 6));
	assert.match(log.toString(), /AssertionError \[ERR_ASSERTION\]: C# producer host load remained at or above 6 for five minutes/u);
	const producer = json(files.get("reviewed/result-only/producer/complete.json"));
	const retry = json(files.get("reviewed/result-only/controls/start.json"));
	assert.ok(Date.parse(record.recorded) > Date.parse(producer.finished));
	assert.ok(Date.parse(record.recorded) < Date.parse(retry.started));
	return paths;
};

/**
 * Reconcile immutable run metadata, selected Git sources, runtime files and original records.
 *
 * @param read - Reader of repository-relative original archive bytes.
 */
export const checkNominalPrimitiveSubtypeBrowserArchive = async (read = readFile) => {
	const bytes = await read(nominalPrimitiveSubtypeBrowserArchive + "/index.json");
	assert.equal(sha256(bytes), nominalPrimitiveSubtypeBrowserArchiveSha256);
	const index = json(bytes), files = new Map();
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-primitive-subtype-browser-installed-v1");
	assert.equal(index.producerCommit, nominalPrimitiveSubtypeBrowserProducer);
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalPrimitiveSubtypeBrowserSelections);
	assert.deepEqual(index.generatorClosure, nominalPrimitiveSubtypeBrowserGeneratorClosure(index.producerCommit));
	assert.deepEqual(index.selectedSources, [...new Set([...nominalPrimitiveSubtypeBrowserArchiveSources, ...index.generatorClosure])].sort());
	const snapshot = nominalPrimitiveSubtypeBrowserSnapshot(index.producerCommit);
	assert.equal(index.sourceSnapshotCount, Object.keys(snapshot).length);
	for(const entry of index.files)
	{
		assert.ok(safePath(entry.path) && !files.has(entry.path));
		const value = await read(nominalPrimitiveSubtypeBrowserArchive + "/" + entry.path);
		assert.equal(value.length, entry.bytes, entry.path); assert.equal(sha256(value), entry.sha256, entry.path);
		files.set(entry.path, value);
	}
	for(const path of index.selectedSources)
		assert.deepEqual(files.get("sources/" + path), nominalPrimitiveSubtypeBrowserOriginal(index.producerCommit, path));
	const expectedPaths = [
		"producer.mjs", "controls-runner.mjs"
		, ...index.selectedSources.map(path => "sources/" + path)];
	const checked = []; let previousFinish = 0, sources, runtimeFiles, browserVersions, nodeExecutable;
	for(const run of index.runs)
	{
		const { route, mode } = run, label = route + "/" + mode;
		const attempt = nominalPrimitiveSubtypeBrowserAttempts[label];
		assert.equal(run.attempt, attempt);
		assert.equal(run.controlAttempt, nominalPrimitiveSubtypeBrowserControlAttempts[label]);
		assert.equal(run.originalDirectory, `/app/build/vo1469-browser-installed-${route}-${mode}-${attempt}`);
		assert.equal(run.producerCommit, index.producerCommit); assert.deepEqual(run.runtime, runtime);
		const get = path => {
			const value = files.get(label + "/" + path); assert.ok(Buffer.isBuffer(value), path); return value;
		};
		const start = json(get("producer/start.json")), end = json(get("producer/complete.json"));
		assert.deepEqual(get("producer/outcome.json"), get("producer/complete.json"));
		for(const value of [start, end])
		{
			assert.equal(value.head, index.producerCommit); assert.equal(value.route, route); assert.equal(value.mode, mode);
		}
		assert.equal(start.runnerSha256, sha256(files.get("producer.mjs")));
		assert.deepEqual(start.args, ["--max-old-space-size=3072", "--test", "--test-concurrency=1", "--test-reporter=tap", "tests/helpers/nominal-primitive-subtype-npm-installed-tests.mjs"]);
		assert.equal(start.selectedEnvironment.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_TEST, "1");
		assert.equal(start.selectedEnvironment.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_BROWSER_TEST, "1");
		assert.equal(start.selectedEnvironment.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS, "chromium,firefox,webkit");
		assert.deepEqual(start.hostRuntime, runtime);
		assert.equal(typeof start.browserProbe, "string");
		assert.match(start.nodeExecutable.sha256, /^[a-f0-9]{64}$/u);
		assert.deepEqual(start.nodeExecutable, nodeExecutable ??= start.nodeExecutable);
		assert.deepEqual(start.browserProbe.trimEnd().split("\n").map(line => line.split(": ")[0]), ["chromium", "firefox", "webkit"]);
		assert.equal(start.selectedEnvironment.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_ROUTES, route);
		assert.equal(start.selectedEnvironment.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_MODES, mode);
		assert.equal(start.selectedEnvironment.LEAN_BRIDGE_LAKE_RUNTIME_ROOT, start.runtimeRoot);
		assert.equal(start.selectedEnvironment.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_OUTPUT, run.originalDirectory + "/selections");
		resources(start.resources);
		assert.deepEqual(Object.keys(start.sources).sort(), Object.keys(sources ?? start.sources).sort());
		assert.deepEqual(start.sources, snapshot); assert.equal(Object.keys(start.runtime).length, 12);
		assert.deepEqual(start.sources, sources ??= start.sources); assert.deepEqual(start.runtime, runtimeFiles ??= start.runtime);
		for(const path of index.selectedSources) assert.equal(start.sources[path], sha256(files.get("sources/" + path)), path);
		for(const [path, hash] of Object.entries(start.runtime))
		{
			assert.ok(safePath(path)); assert.equal(sha256(files.get("runtime/" + path)), hash, path);
		}
		assert.deepEqual([end.code, end.signal], [0, null]); assert.deepEqual(end.changed, []); assert.deepEqual(end.runtimeChanged, []);
		for(const key of ["pathsUnchanged", "headUnchanged", "runnerUnchanged", "runtimePathsUnchanged", "nodeExecutableUnchanged"]) assert.equal(end[key], true);
		assert.deepEqual(end.tests, { tests: 1, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 });
		const tap = get("producer/run.tap");
		assert.equal(end.bytes, tap.length); assert.equal(end.tapSha256, sha256(tap)); assert.equal(run.tapSha256, end.tapSha256);
		assertNominalPrimitiveSubtypeBrowserTap(tap.toString(), route, mode);
		assert.match(tap.toString(), /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
		assert.ok(tap.toString().includes(`ok 1 - installed npm primitive-base nominal Subtypes reproduce and relocate ${route} ${mode}\n`));
		assert.equal(run.started, start.started); assert.equal(run.finished, end.finished);
		assert.ok(Date.parse(start.started) >= previousFinish && Date.parse(end.finished) > Date.parse(start.started));
		const report = json(get("records/report.json")); assert.equal(run.reportSha256, sha256(get("records/report.json")));
		const recordPaths = nominalPrimitiveSubtypeBrowserRecords(mode, report.receipt);
		const counts = await checkNominalPrimitiveSubtypeBrowserReport(async path => get("records/" + path), run);
		assert.deepEqual(run.counts, counts);
		assert.deepEqual(counts.browserVersions, browserVersions ??= counts.browserVersions);
		const controlStart = json(get("controls/start.json")), control = json(get("controls/complete.json"));
		for(const value of [controlStart, control])
		{
			assert.equal(value.head, index.producerCommit); assert.equal(value.route, route); assert.equal(value.mode, mode);
			assert.equal(value.sourceRoot, run.originalDirectory); assert.equal(value.compiledAgain, false); assert.equal(value.installedAcceptance, true);
		}
		assert.ok(Date.parse(controlStart.started) >= Date.parse(end.finished) && Date.parse(control.finished) >= Date.parse(controlStart.started));
		resources(controlStart.resources);
		assert.deepEqual(controlStart.sources, { ...start.sources
			, "/app/build/vo1469-browser-installed-controls.mjs": sha256(files.get("controls-runner.mjs")) });
		const originals = Object.fromEntries([...producerFiles.map(path => [path, sha256(get("producer/" + path))])
			, ...recordPaths.map(path => ["selections/" + label + "/" + path, sha256(get("records/" + path))])].sort(([a], [b]) => a.localeCompare(b)));
		assert.deepEqual(controlStart.originals, originals);
		assert.deepEqual(control.accepted, counts);
		assert.deepEqual(control.checked, { recordControls: recordPaths.length * 2, reportControls: 23, adapterControls: mode === "full" ? 42 : 23, browserControls: 138 });
		assert.equal(control.originalsUnchanged, Object.keys(originals).length);
		assert.equal(control.sourcesUnchanged, Object.keys(snapshot).length + 1); assert.equal(control.runtimeFilesUnchanged, 12);
		previousFinish = Date.parse(control.finished);
		expectedPaths.push(...producerFiles.map(path => label + "/producer/" + path)
			, ...["start.json", "complete.json"].map(path => label + "/controls/" + path)
			, ...recordPaths.map(path => label + "/records/" + path));
		checked.push({ ...counts, recordControls: control.checked.recordControls, reportControls: control.checked.reportControls, adapterControls: control.checked.adapterControls, browserControls: control.checked.browserControls });
	}
	expectedPaths.push(...Object.keys(runtimeFiles).map(path => "runtime/" + path));
	const failureIdentity = item => [item.route, item.mode, item.attempt];
	assert.deepEqual(index.failedAttempts.map(failureIdentity), nominalPrimitiveSubtypeBrowserFailures.map(failureIdentity));
	let previousFailure = Date.parse(json(files.get("ordinary/result-only/controls/complete.json")).finished);
	for(const expected of nominalPrimitiveSubtypeBrowserFailures)
	{
		const preceding = nominalPrimitiveSubtypeBrowserSelections.findIndex(([route, mode]) => route === expected.route && mode === expected.mode) - 1;
		assert.ok(preceding >= 0);
		const prefix = nominalPrimitiveSubtypeBrowserSelections[preceding].join("/");
		previousFailure = Math.max(previousFailure, Date.parse(json(files.get(prefix + "/controls/complete.json")).finished));
		expectedPaths.push(...failedAttempt(index, files, snapshot, runtimeFiles, expected, previousFailure));
		previousFailure = Date.parse(index.failedAttempts.find(item => item.route === expected.route && item.mode === expected.mode && item.attempt === expected.attempt).finished);
	}
	expectedPaths.push(...stoppedControls(index, files));
	assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
	return {
		producerCommit: index.producerCommit, selections: checked
		, files: index.files, selectedSources: index.selectedSources
		, installedProfiles: ["browser-javascript", "browser-react", "browser-worker"]
		, supportPromoted: false, requiredCiRegistered: true
		, hostedAcceptance: false
		, failedAttempts: index.failedAttempts
		, stoppedControls: index.stoppedControls
	};
};
