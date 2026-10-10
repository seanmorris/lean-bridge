/**
 * Registered acceptance/archive controls for the native Fin product and field reports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { hostedArrayDirectory } from "./generic-record-array-hosted-evidence.mjs";
import { assertFinHostedArchive, assertFinHostedExecution, assertFinHostedReport, finHostedDirectory, finHostedFamilies, finHostedFixture } from "./fin-native-hosted-evidence.mjs";

const json = async path => JSON.parse(await readFile(path));
const receipt = await json(`${finHostedDirectory}/receipt.json`);
const texts = new Map(await Promise.all(receipt.sources.map(async item => [item.path, await readFile(item.archivePath, "utf8")])));
const source = path => { assert.ok(texts.has(path)); return texts.get(path); };

test("native Fin archive authenticates 78 original reports and 90 observations across eleven profiles", async () => {
	assert.deepEqual(await assertFinHostedArchive(receipt), { reports: 78, observations: 90, sources: 75 });
});

test("native Fin archive rejects changed scope and references before reading files", async () => {
	for(const mutate of [value => { value.reports.pop(); }, value => { value.sources.pop(); }, value => { value.archive.sha256 = "0".repeat(64); }, value => { value.revision = "0".repeat(40); }, value => { value.scope.measuredDispatchProfiles.push("python"); }, value => { value.scope.closesPlanNodes = true; }])
	{
		const changed = structuredClone(receipt); mutate(changed); let reads = 0;
		await assert.rejects(assertFinHostedArchive(changed, async () => { reads++; return Buffer.alloc(0); }));
		assert.equal(reads, 0);
	}
	for(const path of [receipt.sources[0].archivePath, receipt.reports[0].path])
		await assert.rejects(assertFinHostedArchive(receipt, name => name === path ? Promise.resolve(Buffer.from("substituted original\n")) : readFile(name)));
});

test("native Fin reports require exact family, route, trees, public callers and package contents", async () => {
	for(const item of receipt.reports)
	{
		const original = await json(item.path);
		assertFinHostedReport(original, item.selection, source);
		for(const mutate of [value => { value.reproducible = false; }, value => { value.reports[0].checks--; }, value => { value.reports[0].sourceRemovedBeforeInstallation = false; }, value => { value.reports[0].path = "browser"; }, value => { value.reports[0].refinements = {}; }, value => { value.reports[0].sourceTreeSha256 = "0".repeat(64); }, value => { value.reports[0].consumerSha256 = "0".repeat(64); }, value => { value.reports[0].packages[0].requires.push({ name: "unrecorded" }); }, value => { value.reports[0].packages[0].artifacts[0].path += ".forged"; }, value => { value.archives["archives/invented.tar.gz"] = "0".repeat(64); }, value => { value.reports[0].dispatch = { observed: true }; }])
		{
			const changed = structuredClone(original); mutate(changed);
			assert.throws(() => assertFinHostedReport(changed, item.selection, source), item.path);
		}
		if(item.selection.route === "reviewed")
		{
			const changed = structuredClone(original); delete changed.reports[0].reviewedSourceSha256;
			assert.throws(() => assertFinHostedReport(changed, item.selection, source));
		}
	}
});

test("native Fin rebuilt source trees bind every fixture file and independently reviewed route", async () => {
	for(const family of Object.keys(finHostedFamilies))
	{
		const ordinary = receipt.reports.find(item => item.selection.family === family && item.selection.route === "ordinary");
		const reviewed = receipt.reports.find(item => item.selection.family === family && item.selection.route === "reviewed");
		assert.notEqual(finHostedFixture(ordinary.selection, source), finHostedFixture(reviewed.selection, source));
		for(const item of [ordinary, reviewed])
		{
			const original = await json(item.path);
			for(const path of [...texts.keys()].filter(path => path.startsWith(`tests/fixtures/onboarding/${finHostedFamilies[family].directory}/`)))
				assert.throws(() => assertFinHostedReport(original, item.selection, name => source(name) + (name === path ? "\nchanged\n" : "")), path);
		}
	}
});

test("native Fin measured C dispatch requires nonzero controls and unchanged source counts on rejection", async () => {
	for(const item of receipt.reports.filter(item => item.selection.group === "c-family"))
	{
		const original = await json(item.path);
		for(const mutate of [value => { value.columns[0] += "_wrong"; }, value => { value.observed[1][2][0] = 0; }, value => { value.observed[2][2][0]++; }, value => { value.observed.pop(); }, value => { value.positiveControl = "assumed"; }])
		{
			const changed = structuredClone(original); mutate(changed.reports[0].dispatch);
			assert.throws(() => assertFinHostedReport(changed, item.selection, source));
		}
	}
});

test("native Fin execution binds real compare commands, reports and both ordered Python runtimes", async () => {
	const groups = [...new Map(receipt.reports.map(item => [item.selection.group, item.jobId]))];
	for(const [group, jobId] of groups)
	{
		const log = await readFile(`${hostedArrayDirectory}/job-${jobId}.log`, "utf8");
		assertFinHostedExecution(group, log);
		for(const [from, to] of [["LEAN_BRIDGE_FIN_PRODUCT_PROFILES=", "WRONG_PROFILES="], ["test -s build/native-fin-records/", "echo build/native-fin-records/"], ["relocated source-free native packages check Fin inside products and the active Except branch", "relocated source-free native packages check Fin inside products and the active Except branch # SKIP"], ["# installing and checking ", "# assumed checking "], ["# fail 0", "# fail 1"], ["shell: /usr/bin/bash -e {0}", "shell: /usr/bin/bash {0}"]])
		{
			const changed = log.replaceAll(from, to); assert.notEqual(changed, log);
			assert.throws(() => assertFinHostedExecution(group, changed), `${group}: ${from}`);
		}
		if(group === "python")
		{
			for(const version of ["3.11.17", "3.12.15"])
				assert.throws(() => assertFinHostedExecution(group, log.replaceAll(`/Python/${version}/`, "/Python/wrong/")));
			// Swapping the required-file commands must not authenticate identical Python report bytes.
			const changed = log.replaceAll("test -s build/native-fin-products/python.json", "test -s build/native-fin-products/SWAP.json")
				.replaceAll("test -s build/native-fin-products/python312.json", "test -s build/native-fin-products/python.json")
				.replaceAll("test -s build/native-fin-products/SWAP.json", "test -s build/native-fin-products/python312.json");
			assert.throws(() => assertFinHostedExecution(group, changed));
		}
		if(group.startsWith("perl-"))
			assert.throws(() => assertFinHostedExecution(group, log.replaceAll(`CORPUS_PERL_CONFIGURATION: ${group.slice(5)}`, "CORPUS_PERL_CONFIGURATION: wrong")));
	}
});
