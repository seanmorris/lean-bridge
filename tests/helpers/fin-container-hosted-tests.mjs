/**
 * Keep hosted Fin observations tied to actual jobs, source revisions and complete original cases.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { finHostedJobs, finHostedRevision, finHostedSelections } from "./fin-container-hosted-selections.mjs";
import { assertFinHostedJob, assertFinHostedReports, authenticateFinHostedFile, readFinHostedArchive } from "./fin-container-hosted.mjs";
import { readFinHostedMembers } from "./fin-container-hosted-zip.mjs";

let original;
const originals = () => original ??= readFinHostedArchive();
const laneFiles = (files, lane) => new Map([...files].filter(([path]) => path.startsWith(lane + "/")).map(([path, bytes]) => [path.slice(lane.length + 1), bytes]));
const save = (files, path, value) => files.set(path, Buffer.from(canonicalJson(value)));
const json = (files, path) => JSON.parse(files.get(path));

test("hosted Fin archive authenticates eight successful jobs, nine selections and their exact producer sources", async t => {
	const { index, files, members } = await originals();
	const actual = [];
	for(const item of index.selections)
	{
		const observed = await assertFinHostedReports(members.get(item.lane), item.lane);
		assert.deepEqual({ lane: item.lane, ...observed }, item); actual.push(...observed.summaries);
	}
	assert.deepEqual(actual.map(({ lane, label, profiles, edge, python }) => ({ lane, label, profiles, edge, ...python ? { python } : {} })), finHostedSelections);
	assert.equal(new Set(actual.flatMap(item => item.profiles)).size, 10);
	assert.deepEqual(actual.filter(item => item.python).map(item => item.python), ["3.11", "3.12"]);
	const sources = index.files.filter(file => file.gitPath);
	assert.equal(sources.length, 156);
	for(const source of sources)
		assert.deepEqual(files.get(source.path), execFileSync("git", ["show", `${finHostedRevision}:${source.gitPath}`], { maxBuffer: 32 * 1024 * 1024 }));
	for(const path of [".github/workflows/consumer-matrix.yml"
		, "src/analyze/NativeExports.lean"
		, "tests/fixtures/onboarding/native-fin-containers/FinContainers.lean"
		, "tests/fixtures/fin-container-edges.lean"
		, "tests/fixtures/fin-container-foreign-carriers.c"
		, "tests/helpers/fin-container-late-installed-tests.mjs"
		, "tests/helpers/fin-container-late-wit-installed-tests.mjs"])
		assert.ok(sources.some(source => source.gitPath === path), path);
	t.diagnostic(`${index.files.length} originals, ${sources.length} Git source snapshots, ${index.selections.reduce((n, item) => n + item.requiredRecords.length, 0)} required ZIP records`);
});

test("hosted Fin archive rejects every missing or corrupted original without reading old installation paths", async t => {
	const { index, files } = await originals(); let controls = 0;
	for(const entry of index.files)
	{
		await assert.rejects(authenticateFinHostedFile(entry, async () => { throw new Error("missing original"); }));
		await assert.rejects(authenticateFinHostedFile(entry, async () => Buffer.concat([files.get(entry.path), Buffer.from("changed")])));
		controls += 2;
	}
	for(const value of [Buffer.from("changed index"), undefined])
		await assert.rejects(readFinHostedArchive(async () => { if(value) return value; throw new Error("missing index"); }));
	t.diagnostic(`${controls + 2} missing/corrupted file and index controls`);
});

test("hosted Fin checks require every original case record including both Python floors", async t => {
	const { index, members } = await originals(); let controls = 0;
	for(const selection of index.selections)
		for(const path of selection.requiredRecords)
		{
			const altered = new Map(members.get(selection.lane)); altered.delete(path);
			await assert.rejects(assertFinHostedReports(altered, selection.lane), undefined, path); controls++;
		}
	await assert.rejects(assertFinHostedReports(new Map(), "unknown"));
	t.diagnostic(`${controls} missing required record controls`);
});

test("hosted Fin jobs reject wrong revisions, unsuccessful gates, substituted artifacts and malformed ZIPs", async t => {
	const { files } = await originals(); let controls = 0;
	for(const job of finHostedJobs)
	{
		const baseline = laneFiles(files, job.lane);
		for(const [path, mutate] of [
			["job.json", value => { value.head_sha = "0".repeat(40); }]
			, ["job.json", value => { value.run_id++; }]
			, ["job.json", value => { value.id++; }]
			, ["job.json", value => { value.name = "Unrelated job"; }]
			, ["job.json", value => { value.conclusion = "failure"; }]
			, ["job.json", value => { value.steps.forEach(step => { if(step.name.startsWith("Compare")) step.conclusion = "skipped"; }); }]
			, ["artifact.json", value => { value.workflow_run.head_sha = "0".repeat(40); }]
			, ["artifact.json", value => { value.workflow_run.id++; }]
			, ["artifact.json", value => { value.id++; }]
			, ["artifact.json", value => { value.digest = "sha256:" + "0".repeat(64); }]
			, ["artifact.json", value => { value.size_in_bytes--; }]
			, ["members.json", value => { delete value[Object.keys(value)[0]]; }]
		]) {
			const altered = new Map(baseline), value = json(altered, path);
			mutate(value); save(altered, path, value);
			assert.throws(() => assertFinHostedJob(altered, job.lane)); controls++;
		}
		const noLog = new Map(baseline); noLog.set("job.log", Buffer.from("unrelated successful run"));
		assert.throws(() => assertFinHostedJob(noLog, job.lane)); controls++;
		const corrupt = Buffer.from(baseline.get("artifact.zip")); corrupt[100] ^= 1;
		for(const bytes of [Buffer.alloc(0), Buffer.concat([baseline.get("artifact.zip"), Buffer.from("extra")]), corrupt])
		{
			const metadata = { ...json(baseline, "artifact.json"), digest: "sha256:" + sha256(bytes), size_in_bytes: bytes.length };
			assert.throws(() => readFinHostedMembers(bytes, metadata)); controls++;
		}
	}
	t.diagnostic(`${controls} provenance and ZIP corruption controls`);
});

test("hosted Fin reports reject weakened public, raw, foreign and late-input observations", async t => {
	const { members } = await originals(); let controls = 0;
	for(const selection of finHostedSelections)
	{
		const baseline = members.get(selection.lane), edgePath = `native-fin-container-edges/edges-${selection.edge}.json`;
		for(const mutate of [report => { report.reports.pop(); }
			, report => { report.reproducible = false; }
			, report => { report.reports[0].sourceRemovedBeforeInstallation = false; }
			, report => { report.reports[0].consumerSha256 = "0".repeat(64); }
			, report => { report.reports[0].dispatch.publicHost.observations[1][3][0]++; }
			, report => { report.reports[0].dispatch.rawAdapter.observed[1][2][0]++; }
			, report => { report.reports[0].foreignCarriers.observations.pop(); }
			, report => { report.reports[0].foreignCarriers.missingInstrumentRefused = false; }]) {
			const altered = new Map(baseline), report = json(altered, edgePath); mutate(report); save(altered, edgePath, report);
			await assert.rejects(assertFinHostedReports(altered, selection.lane)); controls++;
			}
		const wit = selection.lane === "wit-wasi";
		const root = wit ? "fin-late-wit-ci/" : `fin-late-native-ci/${selection.label}/`;
		const path = root + (wit ? "records/report.json" : `edges-${selection.profiles.join("-")}.json`);
		for(const mutate of [report => { report.reproducible = false; }
			, report => { if(wit) report.inputTreesCompared.pop(); else report.reports[0].lateInputs.inputTreesCompared.pop(); }
			, report => { if(wit) report.snapshotNegativeControls--; else report.reports[0].lateInputs.snapshotMutationControls--; }
			, report => { if(wit) report.dispatch.observed = true; else report.reports[0].dispatch.observed = true; }]) {
			const altered = new Map(baseline), report = json(altered, path); mutate(report); save(altered, path, report);
			await assert.rejects(assertFinHostedReports(altered, selection.lane)); controls++;
			}
		const skipped = new Map(baseline), tap = root + "run.tap";
		skipped.set(tap, Buffer.from(skipped.get(tap).toString().replace("# skipped 0", "# skipped 1")));
		await assert.rejects(assertFinHostedReports(skipped, selection.lane)); controls++;
	}
	t.diagnostic(`${controls} coordinated report and TAP controls`);
});
