/**
 * Keep the archived checked-record C/C++ and npm runs tied to their own immutable execution evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { checkedRecordDispatchExpected } from "./checked-record-dispatch.mjs";
import { assertCheckedRecordEvidenceExecution, assertCheckedRecordEvidenceReport, checkedRecordEvidenceDirectory, checkedRecordEvidenceHosts, checkedRecordEvidenceRevision, checkedRecordEvidenceRoutes, checkedRecordEvidenceSelections, checkedRecordEvidenceSourcePaths } from "./checked-record-evidence.mjs";

const receipt = async () => {
	const bytes = await readFile(`${checkedRecordEvidenceDirectory}/receipt.json`);
	assert.equal(sha256(bytes), "ddbd22ea869ab7f82c40ed6fa4c158a68f262449a865e12dae900a227dec736f");
	return JSON.parse(bytes);
};
const readOriginal = async reference => {
	const bytes = await readFile(reference.path);
	assert.equal(bytes.length, reference.bytes);
	assert.equal(sha256(bytes), reference.sha256, reference.path);
	return bytes;
};
const hostTaps = async host => Object.fromEntries(await Promise.all(Object.entries(host.taps)
	.map(async ([route, reference]) => [route, (await readOriginal(reference)).toString()])));

test("checked-record evidence authenticates six original reports, two queues and six TAP logs", async () => {
	const record = await receipt();
	assert.equal(record.schemaVersion, 1); assert.deepEqual(record.planNodes, [1446]);
	assert.equal(record.execution, "local"); assert.equal(record.revision, checkedRecordEvidenceRevision);
	assert.deepEqual([record.scope.hosts, record.scope.routes, record.scope.sourcePaths]
		, [["c", "cpp", "npm"], checkedRecordEvidenceRoutes, ["ordinary-source", "reviewed-source"]]);
	assert.deepEqual([record.scope.hostedCi, record.scope.binaryArchivesRetained], [false, false]);
	assert.match(record.scope.slice, /^First checked-record slice only/u);
	assert.deepEqual(record.scope.dispatch.unmeasured, ["C++ (it calls the same C entries)", "result-only C and C++", "npm", "resident memory"]);
	// The override was unset, so the packages declare 2.38 even though the measured host is 2.36.
	assert.deepEqual(record.producerEnvironment.nativeGlibcFloor, {
		override: "unset", declaredMinimum: "2.38"
		, source: "default in src/build/native-c-projection.mjs at the producer revision; the C/C++ packages declare it in README.md and package metadata"
		, measuredHostGlibc: "2.36" });
	assert.equal(record.producerEnvironment.measured.node, "v22.23.3");
	assert.match(record.producerEnvironment.measured.lean, /version 4\.32\.2,.*commit f3b06c705e6c85f5314019d5d3baab0fec5b580c/u);
	assert.match(record.runner, /no separate runner file/u);
	assert.match(record.sourceIdentityScope, /not a complete dependency closure/u);
	assert.deepEqual(record.sourceFiles.map(file => file.path), checkedRecordEvidenceSourcePaths);
	for(const source of record.sourceFiles)
		assert.equal(sha256(beforeFinRefinementSource(source.path, await readFile(source.path, "utf8"), source.sha256)), source.sha256, source.path);
	assert.deepEqual(record.hosts.map(host => host.id), Object.keys(checkedRecordEvidenceHosts));
	assert.deepEqual(record.runs.map(run => run.id), checkedRecordEvidenceSelections.map(selection => selection.id));
	const expected = [];
	for(const host of record.hosts)
	{
		const pinned = checkedRecordEvidenceHosts[host.id];
		assert.equal(host.queue.sha256, pinned.queue);
		assert.equal(host.queue.path, `${checkedRecordEvidenceDirectory}/${host.id}.queue`);
		expected.push(host.queue);
		for(const route of checkedRecordEvidenceRoutes)
		{
			assert.equal(host.taps[route].sha256, pinned.taps[route]);
			expected.push(host.taps[route]);
		}
		assertCheckedRecordEvidenceExecution(host.id, (await readOriginal(host.queue)).toString(), await hostTaps(host));
		for(const route of checkedRecordEvidenceRoutes)
		{
			const run = record.runs.find(item => item.id === `${route}-${host.id}`);
			assert.deepEqual([run.host, run.route], [host.id, route]);
			assert.equal(run.report.sha256, pinned.reports[route]);
			assert.equal(run.report.originalPath, `build/vo1446-checked-records-${run.id}-78a4d3d.json`);
			assertCheckedRecordEvidenceReport(JSON.parse(await readOriginal(run.report)), run);
			expected.push(run.report);
		}
	}
	assert.deepEqual(record.artifacts, expected);
	assert.equal(new Set(record.artifacts.map(file => file.path)).size, 14);
});

test("checked-record archive validation refuses changed counts, routes, identities, flags and dispatch", async () => {
	const record = await receipt();
	const native = [
		["fewer C checks", report => { report.reports[0].checks--; }]
		, ["C++ caller bytes", report => { report.reports[1].consumerSha256 = "f".repeat(64); }]
		, ["model identity", report => { report.reports[0].modelSha256 = report.reports[0].modelBindingIrSha256 = "f".repeat(64); }]
		, ["receipt identity", report => { for(const item of report.reports) item.receiptSha256 = "f".repeat(64); }]
		, ["online install", report => { report.reports[1].offlineInstall = false; }]
		, ["compiler on path", report => { report.reports[0].compilerFreePath = false; }]
		, ["source present", report => { report.reports[0].sourceRemovedBeforeInstallation = false; }]
		, ["tamper accepted", report => { report.reports[1].receiptTamperRefused = false; }]
		, ["missing C++", report => { report.reports.pop(); }]
		, ["one build", report => { report.independentBuilds = 1; }]
		, ["not reproducible", report => { report.reproducible = false; }]
		, ["archive mismatch", report => { report.archives[Object.keys(report.archives)[0]] = "f".repeat(64); }]
		, ["changed route", report => { report.route = report.route === "ordinary" ? "result-only" : "ordinary"; }]
	];
	const measured = [
		["changed dispatch row", report => { report.dispatch.observed[1][2][0] = 2; }]
		, ["dropped dispatch", report => { delete report.dispatch; }]
		, ["claimed C++ dispatch", report => { report.dispatch.unmeasured = ["resident memory"]; }]
	];
	const npm = [
		["fewer checks", report => { report.checks--; }]
		, ["changed rejections", report => { report.rejections++; }]
		, ["loose TypeScript", report => { report.typescript = { ...report.typescript, strict: false }; }]
		, ["skipped library checks", report => { report.typescript = { ...report.typescript, skipLibCheck: true }; }]
		, ["changed TypeScript caller", report => { report.typescript = { ...report.typescript, sourceSha256: "f".repeat(64) }; }]
		, ["changed declarations", report => { report.typescript = { ...report.typescript, declarationsSha256: "f".repeat(64) }; }]
		, ["online install", report => { report.offlineInstall = false; }]
		, ["compiler on path", report => { report.compilerFreePath = false; }]
		, ["source present", report => { report.sourceRemovedBeforeInstallation = false; }]
		, ["tamper accepted", report => { report.receiptTamperRefused = false; }]
		, ["claimed dispatch", report => { report.dispatch = { observed: checkedRecordDispatchExpected }; }]
		, ["package archive", report => { report.archiveSha256 = "f".repeat(64); }]
		, ["Binding IR file", report => { report.bindingIrFileSha256 = "f".repeat(64); }]
		, ["changed route", report => { report.route = report.route === "ordinary" ? "result-only" : "ordinary"; }]
	];
	for(const run of record.runs)
	{
		const original = JSON.parse(await readOriginal(run.report));
		const invented = [["invented dispatch", report => { report.dispatch = { interposer: "LD_PRELOAD" }; }]];
		const dispatch = run.route === "result-only" ? invented : measured;
		const mutations = run.host === "npm" ? npm : [...native, ...dispatch];
		for(const [label, edit] of mutations)
		{
			const changed = structuredClone(original); edit(changed);
			assert.throws(() => assertCheckedRecordEvidenceReport(changed, run), assert.AssertionError, `${run.id}: ${label}`);
		}
	}
});

test("checked-record execution checks reject changed tools, floor, selections, summaries and failures", async () => {
	const record = await receipt();
	for(const host of record.hosts)
	{
		const queue = (await readOriginal(host.queue)).toString(), taps = await hostTaps(host);
		assertCheckedRecordEvidenceExecution(host.id, queue, taps);
		const changes = [
			["wrong producer", queue.replace(checkedRecordEvidenceRevision, "a".repeat(40)), taps]
			, ["wrong Node", queue.replace("node v22.23.3", "node v22.23.2"), taps]
			, ["wrong Lean", queue.replace("version 4.32.2", "version 4.32.1"), taps]
			, ["wrong host glibc", queue.replace("GLIBC 2.36-9+deb12u14) 2.36", "GLIBC 2.38-1) 2.38"), taps]
			, ["wrong CPU", queue.replace("cpu 3 concurrency 1", "cpu 0 concurrency 1"), taps]
			, ["low free space", queue.replace(/free_mib_after_setup \d+/u, "free_mib_after_setup 2047"), taps]
			, ["failed selection", queue.replace(/^(reviewed end \S+) exit 0/mu, "$1 exit 1"), taps]
			, ["skipped selection", queue.replace(/^(ordinary end \S+ exit 0) # pass 1 # fail 0 # skipped 0/mu, "$1 # pass 0 # fail 0 # skipped 1"), taps]
			, ["missing selection", queue.split("\n").filter(line => !line.startsWith("result-only ")).join("\n"), taps]
			, ["wrong report variable", queue.replace(host.id === "npm" ? "LEAN_BRIDGE_CHECKED_RECORD_REVIEWED_NPM_REPORT=" : "LEAN_BRIDGE_CHECKED_RECORD_REVIEWED_REPORT=", "LEAN_BRIDGE_UNUSED_REPORT="), taps]
			, ["other CPU", queue.replace(/taskset -c 3/u, "taskset -c 0"), taps]
			, ["stopped queue", queue.replace(/^queue complete /mu, "queue stopped "), taps]
			, ["skipped test", queue, { ...taps, reviewed: taps.reviewed.replace("# skipped 0", "# skipped 1") }]
			, ["cancelled test", queue, { ...taps, ordinary: taps.ordinary.replace("# cancelled 0", "# cancelled 1") }]
			, ["contradictory summary", queue, { ...taps, ordinary: taps.ordinary.replace("# fail 0", "# fail 0\n# fail 1") }]
			, ["wrong test", queue, { ...taps, "result-only": taps.reviewed }]
			, ["failed test", queue, { ...taps, ordinary: taps.ordinary.replace(/^ok 1 - /mu, "not ok 1 - ") }]
		];
		const cpp = taps.ordinary.replace("# ordinary: installing and checking cpp\n", "");
		if(host.id === "c-cpp") changes.push(
			["changed floor fact", queue.replace("effective default 2.38", "effective default 2.36"), taps]
			, ["missing C++ install", queue, { ...taps, ordinary: cpp }]);
		else changes.push(
			["changed TypeScript", queue.replace("typescript Version 5.9.3", "typescript Version 5.8.0"), taps]
			, ["historical engine", queue.replace("LEAN_BRIDGE_LAKE_ENGINE unset", "LEAN_BRIDGE_LAKE_ENGINE=/locked/engine"), taps]);
		for(const [label, changedQueue, changedTaps] of changes)
		{
			assert.ok(changedQueue !== queue || changedTaps !== taps, `${host.id}: ${label} changes the input`);
			assert.throws(() => assertCheckedRecordEvidenceExecution(host.id, changedQueue, changedTaps), assert.AssertionError, `${host.id}: ${label}`);
		}
	}
});
