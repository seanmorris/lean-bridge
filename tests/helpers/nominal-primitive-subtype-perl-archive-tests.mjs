/**
 * Reject incomplete or substituted primitive-base Perl installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { checkNominalPrimitiveSubtypePerlArchive, nominalPrimitiveSubtypePerlArchive, nominalPrimitiveSubtypePerlArchiveSha256, nominalPrimitiveSubtypePerlArchiveSelections, nominalPrimitiveSubtypePerlProducers } from "./nominal-primitive-subtype-perl-archive.mjs";
import { checkNominalPrimitiveSubtypePerlControls } from "./nominal-primitive-subtype-perl-controls.mjs";

const abis = ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"];

test("primitive-base Perl archive reconciles four accepted selections, two frozen revisions and every preserved launch", async () => {
	const checked = await checkNominalPrimitiveSubtypePerlArchive();
	assert.deepEqual(checked.producerCommits, nominalPrimitiveSubtypePerlProducers);
	assert.deepEqual(checked.installedProfiles, ["perl"]);
	assert.equal(checked.supportPromoted, false); assert.equal(checked.hostedAcceptance, false);
	assert.deepEqual(checked.selections.map(run => [run.route, run.mode]), nominalPrimitiveSubtypePerlArchiveSelections);
	assert.deepEqual(checked.selections.map(run => run.loadCeiling), [6, 8, 8, 12]);
	assert.deepEqual(checked.selections.map(run => run.producerCommit), [nominalPrimitiveSubtypePerlProducers[0], ...Array(3).fill(nominalPrimitiveSubtypePerlProducers[1])]);
	for(const run of checked.selections)
	{
		assert.deepEqual(run.runtime, { platform: "linux", arch: "x64", glibc: "2.36" }); assert.equal(run.floor, "2.36");
		const full = run.mode === "full";
		assert.deepEqual(run.counts, { checks: full ? 1225 : 587, rejections: full ? 283 : 0, rounds: 256, snapshotControls: 9, wordBits: 64 });
		assert.deepEqual(run.configurations, abis); assert.deepEqual(run.deliveryModes, ["prebuilt-only", "build-xs"]);
		assert.equal(run.executions, 16); assert.equal(run.dispatchObserved, false);
		assert.equal(run.records, run.route === "ordinary" ? 131 : 133);
		assert.equal(run.recordControls, run.records * 2); assert.equal(run.packageControls, 48);
		assert.equal(run.handoffControls, 4); assert.equal(run.modelControls, full ? 43 : 24);
		assert.equal(Object.keys(run.handoff.archives).length, 2);
	}
	assert.deepEqual(checked.preserved.map(item => [item.label, item.code, item.counted]), [
		["ordinary-result-only-r1", 1, false]
		, ["reviewed-full-r1", 1, false]
		, ["reviewed-full-r2", 0, false]
		, ["reviewed-result-only-r1", 1, false]
	]);
	assert.equal(checked.files.filter(file => file.path.endsWith(".tar.gz")).length, 8);
	assert.deepEqual((await nativeArtifactPaths(nominalPrimitiveSubtypePerlArchive)).sort(), ["index.json", ...checked.files.map(file => file.path)].sort());
});

test("primitive-base Perl archive refuses missing or changed receipts, packages, runners and sources", async () => {
	const index = JSON.parse(await readFile(nominalPrimitiveSubtypePerlArchive + "/index.json"));
	const targets = [
		"index.json"
		, ...index.runnerVariants.flatMap(item => [`runners/${item.producer}`, `runners/${item.controls}`])
		, "checkers/report.mjs", "checkers/provenance.mjs"
		, `sources/${index.producerCommits[1]}/src/analyze/NativeExports.lean`
		, `sources/${index.producerCommits[0]}/tests/helpers/nominal-subtype-dotnet-resources.mjs`
		, ...index.runs.flatMap(({ label }) => [
			"producer/start.json", "producer/end.json", "producer/run.tap"
			, "controls/controls.start.json", "controls/controls.json"
			, "controls/controls.end.json", "controls/controls.log"
			, "records/report.json", "records/build-0/model.json"
			, "records/build-1/package-set-receipt.json"
			, "records/handoff/package-set-receipt.json"
			, "records/5.38.2-unthreaded/build-xs/repeated.json"
		].map(path => label + "/" + path))
		, ...index.preserved.flatMap(({ label }) => ["start.json", "end.json", "run.tap"].map(path => `preserved/${label}/${path}`))
		, ...index.files.filter(file => file.path.endsWith(".tar.gz")).map(file => file.path)
	];
	for(const path of targets) for(const missing of [true, false])
		await assert.rejects(checkNominalPrimitiveSubtypePerlArchive(async requested => {
			if(requested !== nominalPrimitiveSubtypePerlArchive + "/" + path) return readFile(requested);
			if(missing) throw new Error("Missing original: " + path);
			return Buffer.concat([await readFile(requested), Buffer.from("changed")]);
		}), undefined, path);
});

test("primitive-base Perl archive refuses substituted revisions, selections, ceilings, counts and preserved launches", async () => {
	const original = await readFile(nominalPrimitiveSubtypePerlArchive + "/index.json"), index = JSON.parse(original);
	assert.equal(sha256(original), nominalPrimitiveSubtypePerlArchiveSha256);
	const mutations = [
		value => { value.producerCommits = [value.producerCommits[1]]; }
		, value => { value.producerCommits.reverse(); }
		, value => { value.runs.pop(); }, value => { value.runs.reverse(); }
		, value => { value.runs.push(value.runs[0]); }
		, value => { value.runs[0].route = "reviewed"; }
		, value => { value.runs[0].mode = "result-only"; }
		, value => { value.runs[0].producerCommit = value.producerCommits[1]; }
		, value => { value.runs[0].loadCeiling = 8; }
		, value => { value.runs[1].loadCeiling = 12; }
		, value => { value.runs[0].attempt = "r2"; }
		, value => { value.runs[0].runner.producer = value.runs[1].runner.producer; }
		, value => { value.runs[0].runtime.glibc = "2.38"; }
		, value => { value.runs[0].floor = "2.38"; }
		, value => { value.runs[0].dispatchObserved = true; }
		, value => { value.runs[0].executions = 8; }
		, value => { value.runs[0].records = 133; }
		, value => { value.runs[0].counts.rejections = 0; }
		, value => { value.runs[1].counts.checks = 1225; }
		, value => { value.runs[0].controls.modelControls = 24; }
		, value => { value.runs[0].configurations.pop(); }
		, value => { value.runs[0].deliveryModes.pop(); }
		, value => { value.runs[0].tapSha256 = "0".repeat(64); }
		, value => { value.runs[0].reportSha256 = "0".repeat(64); }
		, value => { value.runs[0].started = value.runs[1].started; }
		, value => { value.preserved.pop(); }
		, value => { value.preserved[0].counted = true; }
		, value => { value.preserved[0].code = 0; }
		, value => { value.preserved[2].reason = "C# producer requires 2 GiB free disk"; }
		, value => { value.preserved[0].retained.push("controls.json"); }
		, value => { value.runnerVariants.pop(); }
		, value => { value.runnerVariants[0].loadCeiling = 8; }
		, value => { value.selectedSources.pop(); }
		, value => { value.sourceDifferences.pop(); }
		, value => { value.generatorClosure.pop(); }
		, value => { value.checkers.pop(); }
		, value => { value.files.pop(); }
		, value => { value.files.push(value.files[0]); }
		, value => { value.files[0].path = "../outside"; }
		, value => { value.files[0].sha256 = "0".repeat(64); }
		, value => { value.limitations = []; }
	];
	for(const mutate of mutations)
	{
		const value = structuredClone(index); mutate(value);
		await assert.rejects(checkNominalPrimitiveSubtypePerlArchive(async path => path.endsWith("/index.json") ? Buffer.from(canonicalJson(value)) : readFile(path)));
	}
	assert.deepEqual(await readFile(nominalPrimitiveSubtypePerlArchive + "/index.json"), original);
});

test("primitive-base Perl archived originals reject every coordinated package, archive and constructor mutation", async () => {
	const original = await readFile(nominalPrimitiveSubtypePerlArchive + "/index.json");
	assert.equal(sha256(original), nominalPrimitiveSubtypePerlArchiveSha256);
	const index = JSON.parse(original);
	for(const run of index.runs)
	{
		const options = { route: run.route, mode: run.mode, producerCommit: run.producerCommit, runtime: run.runtime, floor: run.floor };
		const checked = await checkNominalPrimitiveSubtypePerlControls(path => readFile(`${nominalPrimitiveSubtypePerlArchive}/${run.label}/records/${path}`), options);
		assert.deepEqual(checked, { ...options
			, configurations: run.configurations, deliveryModes: run.deliveryModes
			, executions: 16, records: run.records, counts: run.counts
			, handoff: run.handoff, dispatchObserved: false
			, recordControls: run.records * 2, packageControls: 48
			, handoffControls: 4, modelControls: run.mode === "full" ? 43 : 24 });
	}
});
