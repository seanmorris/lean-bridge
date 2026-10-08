/**
 * Keep the archived Rust structural Fin runs tied to their own immutable execution evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { assertFinRustExecution, assertFinRustReport, finRustDirectory, finRustFixture, finRustMeasured, finRustRevision, finRustRuntime, finRustSourcePaths, finRustSteps } from "./fin-rust-evidence.mjs";

const receipt = async () => {
	const bytes = await readFile(`${finRustDirectory}/receipt-v2.json`);
	assert.equal(sha256(bytes), "d9cbfdde08a69d7c6e77e9ebb16cfd42b5322ff38a96efaa694f8d1e31471b7a");
	return JSON.parse(bytes);
};
/**
 * Read current source bytes only after proving they are the receipt's original 78a4d3d bytes.
 *
 * @param record - Authenticated receipt.
 */
const pinnedReader = record => async path => {
	const source = record.sourceFiles.find(file => file.path === path);
	assert.ok(source, `${path} is not a pinned source`);
	const bytes = beforeFinRefinementSource(path, await readFile(path), source.sha256);
	assert.equal(sha256(bytes), source.sha256, path);
	return bytes;
};
const readOriginal = async reference => {
	const bytes = await readFile(reference.path);
	assert.equal(bytes.length, reference.bytes);
	assert.equal(sha256(bytes), reference.sha256, reference.path);
	return bytes;
};

test("Rust Fin evidence authenticates all six original reports and their execution artifacts", async () => {
	const record = await receipt();
	assert.equal(record.schemaVersion, 2); assert.deepEqual(record.planNodes, [1441, 1442]);
	// The first receipt stays unchanged; this version only adds source-tree reconstruction and its pins.
	const previous = await readFile(record.priorReceipt.path);
	assert.equal(record.priorReceipt.path, `${finRustDirectory}/receipt.json`);
	assert.equal(sha256(previous), "9a50368ec2676347dc3744ce5b2c33a41e627fb9f2bf04a95d64c6b65eac3421");
	assert.equal(record.priorReceipt.sha256, sha256(previous));
	const first = JSON.parse(previous);
	for(const key of ["revision", "scope", "producerEnvironment", "compilerFreePath", "sourceIdentityScope", "runtime", "runs", "artifacts"])
		assert.deepEqual(record[key], first[key], key);
	assert.deepEqual(first.sourceFiles.filter(file => !record.sourceFiles.some(item => item.path === file.path)), []);
	for(const file of first.sourceFiles) assert.deepEqual(record.sourceFiles.find(item => item.path === file.path), file);
	assert.match(record.sourceTreeCheck, /src\/analyze\/lean-project\.mjs/u);
	assert.equal(record.execution, "local"); assert.equal(record.revision, finRustRevision);
	assert.deepEqual(record.scope, { profiles: ["rust"]
		, sourcePaths: ["ordinary-source", "reviewed-ir"]
		, families: ["product", "product-array", "record"]
		, dispatchObserved: false, hostedCi: false, binaryArchivesRetained: false });
	assert.deepEqual(record.producerEnvironment.measured, finRustMeasured);
	assert.match(record.producerEnvironment.measurementSource, /--version of the configured cargo, rustc, Lean, ldd and cc/u);
	assert.equal(record.producerEnvironment.nativeGlibcFloor, "2.36");
	assert.equal(record.producerEnvironment.nativeGlibcFloorSource, "configured LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR");
	// compilerFreePath excludes Lean and producer tools only; the Rust consumer still compiles.
	assert.match(record.compilerFreePath, /cargo build --offline/u);
	assert.match(record.sourceIdentityScope, /not a complete dependency closure/u);
	assert.deepEqual(record.sourceFiles.map(file => file.path), finRustSourcePaths);
	for(const source of record.sourceFiles)
		assert.equal(sha256(beforeFinRefinementSource(source.path, await readFile(source.path), source.sha256)), source.sha256, source.path);
	assert.deepEqual(record.runs.map(run => run.id), finRustSteps.map(step => `${finRustRuntime.id}-${step.id}`));
	const expected = [record.runtime.tap, record.runtime.queue, record.runtime.runner];
	for(const [index, step] of finRustSteps.entries())
	{
		const run = record.runs[index];
		assert.deepEqual([run.profile, run.family, run.route], ["rust", step.family, step.route]);
		assert.equal(run.report.path, `${finRustDirectory}/${run.id}.json`);
		assert.equal(run.report.originalPath, `build/vo1441-rust-${step.id}-78a4d3d.json`);
		assert.equal(run.report.sha256, finRustRuntime.reports[index]);
		await assertFinRustReport(JSON.parse(await readOriginal(run.report)), run, pinnedReader(record));
		expected.push(run.report);
	}
	assert.deepEqual(record.artifacts, expected);
	assert.equal(new Set(record.artifacts.map(file => file.path)).size, 9);
});

test("the Rust runner log, TAP and runner source retain the measured tools and six terminal selections", async () => {
	const record = await receipt(), runtime = record.runtime;
	assert.deepEqual([runtime.id, runtime.profile], [finRustRuntime.id, "rust"]);
	for(const kind of ["tap", "queue", "runner"])
	{
		assert.equal(runtime[kind].sha256, finRustRuntime[kind]);
		assert.equal(runtime[kind].path, `${finRustDirectory}/${finRustRuntime.id}.${kind === "runner" ? "runner.mjs.txt" : kind}`);
	}
	assertFinRustExecution((await readOriginal(runtime.queue)).toString(), (await readOriginal(runtime.tap)).toString());
	const runner = (await readOriginal(runtime.runner)).toString();
	for(const fragment of [`const revision = "${finRustRevision}"`
		, 'LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36"'
		, "LEAN_BRIDGE_CARGO: `${rust}/cargo`"
		, '!key.startsWith("LEAN_BRIDGE_")', "assert.ok(free >= 2048"
		, 'assert.equal(git(["status", "--porcelain", "--untracked-files=no"]), "")'
		, 'assert.deepEqual([count("pass"), count("fail"), count("skipped")], [1, 0, 0]'])
		assert.ok(runner.includes(fragment), fragment);
});

test("Rust archive validation refuses wrong bounds, routes, identities, flags and invented dispatch", async () => {
	const record = await receipt();
	const mutations = [
		["zero checks", report => { report.reports[0].checks = 0; }]
		, ["wrong count", report => { report.reports[0].checks++; }]
		, ["wrong host", report => { report.reports[0].profile = "python"; }]
		, ["wrong route", report => { report.reports[0].path = report.reports[0].path === "reviewed-ir" ? "ordinary-source" : "reviewed-ir"; }]
		, ["missing export", report => { delete report.reports[0].refinements[Object.keys(report.reports[0].refinements)[0]]; }]
		, ["changed bound", report => { report.reports[0].refinements = JSON.parse(JSON.stringify(report.reports[0].refinements).replace(/"bound":"\d+"/u, '"bound":"987654321"')); }]
		, ["no reproduction", report => { report.reproducible = false; }]
		, ...["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"].map(flag => [`false ${flag}`, report => { report.reports[0][flag] = false; }])
		, ...["consumerSha256", "modelSha256", "bindingIrSha256", "sourceTreeSha256", "receiptSha256"].map(key => [key, report => { report.reports[0][key] = "f".repeat(64); }])
		, ["invented dispatch", report => { report.reports[0].dispatch = { observed: true }; }]
		, ["top-level dispatch", report => { report.dispatch = {}; }]
		, ["missing selection", report => { report.reports = []; }]
		, ["duplicated profile", report => { report.reports.push(structuredClone(report.reports[0])); }]
		, ["extra archive", report => { report.archives["archives/extra.crate"] = "a".repeat(64); }]
		, ["archive mismatch", report => { report.archives[Object.keys(report.archives)[0]] = "a".repeat(64); }]
		, ["wrong package format", report => { report.reports[0].packages[0].artifacts[0].path = report.reports[0].packages[0].artifacts[0].path.replace(".crate", ".tar.gz"); }]
		, ["wrong ecosystem", report => { report.reports[0].packages[0].ecosystem = "pypi"; }]
		, ["wrong artifact size", report => { report.reports[0].packages[0].artifacts[0].bytes++; }]
		, ["wrong runtime bytes", report => { report.reports[0].packages[0].runtimeIdentity = "a".repeat(64); }]
		, ["invented or wrong review", report => { report.reports[0].reviewedSourceSha256 = "a".repeat(64); }]
		, ["changed source tree", report => { report.reports[0].sourceTreeSha256 = "a".repeat(64); }]
	];
	for(const run of record.runs)
	{
		const original = JSON.parse(await readOriginal(run.report));
		for(const [label, edit] of mutations)
		{
			const changed = structuredClone(original); edit(changed);
			await assert.rejects(() => assertFinRustReport(changed, run, pinnedReader(record)), assert.AssertionError, `${run.id}: ${label}`);
		}
	}
});

test("Rust execution checks reject changed tools, floors, steps, summaries and a failed producer", async () => {
	const record = await receipt();
	const queue = (await readOriginal(record.runtime.queue)).toString(), tap = (await readOriginal(record.runtime.tap)).toString();
	assertFinRustExecution(queue, tap);
	const changes = [
		["wrong cargo", queue.replace("cargo 1.90.0", "cargo 1.89.0"), tap]
		, ["wrong rustc", queue.replace("rustc 1.90.0", "rustc 1.91.0"), tap]
		, ["wrong Lean", queue.replace("version 4.32.2", "version 4.32.1"), tap]
		, ["wrong host glibc", queue.replace("GLIBC 2.36-9+deb12u14) 2.36", "GLIBC 2.38-1) 2.38"), tap]
		, ["wrong Node", queue.replace("node=v22.23.3", "node=v22.23.2"), tap]
		, ["wrong floor", queue.replace("LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36", "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38"), tap]
		, ["wrong producer", queue.replace(finRustRevision, "a".repeat(40)), tap]
		, ["low free space", queue.replace(/freeMiB=4086/u, "freeMiB=2047"), tap]
		, ["missing selection", queue.split("\n").filter(line => !line.startsWith("report record-reviewed")).join("\n"), tap]
		, ["mismatched hash", queue.replace(finRustRuntime.reports[0], "a".repeat(64)), tap]
		, ["claimed dispatch", queue.replace("checks=2039 dispatch=null", "checks=2039 dispatch={}"), tap]
		, ["missing completion", queue.replace(/^all steps passed .+$/mu, ""), tap]
		, ["failed step", queue.replace("exit=0 pass=1", "exit=1 pass=1"), tap]
		, ["skipped selection", queue.replace("pass=1 fail=0 skipped=0", "pass=0 fail=0 skipped=1"), tap]
		, ["skipped test", queue, tap.replace("# skipped 0", "# skipped 1")]
		, ["cancelled test", queue, tap.replace("# cancelled 0", "# cancelled 1")]
		, ["contradictory summary", queue, tap.replace("# fail 0", "# fail 0\n# fail 1")]
		, ["wrong selection", queue, tap.replace("# step product-reviewed", "# step product-ordinary")]
		, ["wrong consumer", queue, tap.replace("# installing and checking rust", "# installing and checking python")]
		, ["wrong exit", queue, tap.replace("exit=0", "exit=1")]
	];
	for(const [label, changedQueue, changedTap] of changes)
	{
		assert.ok(changedQueue !== queue || changedTap !== tap, label);
		assert.throws(() => assertFinRustExecution(changedQueue, changedTap), assert.AssertionError, label);
	}
});

test("Rust source trees are rebuilt from original fixture inputs and refuse changed inputs, configs and reviews", async () => {
	const record = await receipt(), read = pinnedReader(record);
	for(const run of record.runs)
	{
		const report = JSON.parse(await readOriginal(run.report));
		const tree = await finRustFixture(run.family, run.route, read);
		assert.equal(tree.sha256, report.reports[0].sourceTreeSha256, run.id);
		const generated = run.route === "reviewed" ? ["api.binding-ir.json", "lean-bridge.exports.json"] : ["lean-bridge.exports.json"];
		const tracked = ["LICENSE", "lakefile.toml", "lean-toolchain", "package.json"];
		const paths = tree.inputs.map(input => input.path);
		assert.deepEqual(paths.filter(path => !path.endsWith(".lean")).sort(), [...generated, ...tracked].sort());
		assert.equal(paths.filter(path => path.endsWith(".lean")).length, 1);
		const other = run.route === "reviewed" ? "ordinary" : "reviewed";
		assert.notEqual((await finRustFixture(run.family, other, read)).sha256, tree.sha256, `${run.id} route`);
		for(const name of ["LICENSE", "lakefile.toml", "lean-toolchain", "package.json", ".lean"])
		{
			const changed = async path => path.endsWith(name) ? Buffer.concat([await read(path), Buffer.from("\n")]) : read(path);
			assert.notEqual((await finRustFixture(run.family, run.route, changed)).sha256, tree.sha256, `${run.id}: ${name}`);
		}
		await assert.rejects(() => read("tests/fixtures/onboarding/native-fin-records/README.md"), assert.AssertionError);
	}
	// A changed generated config or review cannot reproduce a recorded tree.
	const run = record.runs.find(item => item.route === "reviewed"), report = JSON.parse(await readOriginal(run.report));
	const tree = await finRustFixture(run.family, run.route, read);
	const config = tree.inputs.find(input => input.path === "lean-bridge.exports.json");
	const review = tree.inputs.find(input => input.path === "api.binding-ir.json");
	for(const [label, input, bytes] of [["changed config", config, canonicalJson({ schemaVersion: 1, modules: ["FinProducts"] })], ["changed review", review, "{}"]])
	{
		const inputs = tree.inputs.map(item => item === input ? { ...item, sha256: sha256(bytes) } : item);
		assert.notEqual(sha256(inputs.map(item => `${item.sha256}  ${item.path}\n`).join("")), report.reports[0].sourceTreeSha256, label);
	}
});
