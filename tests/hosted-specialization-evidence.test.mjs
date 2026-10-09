/**
 * Keep hosted finite-specialization acceptance bound to original reports and producer sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertHostedSpecializationArchive, assertHostedSpecializationJob, assertHostedSpecializationReport, hostedSpecializationDirectory as root } from "./helpers/hosted-specialization-evidence.mjs";

const json = async path => JSON.parse(await readFile(`${root}/${path}`));
const capture = await json("capture.json"), receipt = await json("receipt.json");
const sources = new Map(await Promise.all(receipt.files.filter(file => file.originalPath.startsWith("git:")).map(async file => [file.path.slice(`${root}/sources/`.length, -4), await readFile(file.path, "utf8")])));
const source = path => { assert.ok(sources.has(path), path); return sources.get(path); };

test("hosted specialization archive authenticates 38 ZIP members, 44 observations and 58 producer source snapshots", async () => {
	assert.deepEqual(await assertHostedSpecializationArchive(receipt), { reports: 38, observations: 44, groups: 12, sources: 58 });
	assert.equal(receipt.scope.supportPromotion, false);
	assert.match(receipt.scope.jobConclusion, /C-family job was cancelled later/u);
	assert.match(receipt.scope.reproduction, /complete original model\/receipt documents are not retained/u);
});

test("hosted specialization reports refuse changed coverage, consumers, provenance and package identities", async () => {
	for(const group of capture.captures) for(const member of group.reports)
	{
		const original = await json(`${group.name}/${member.member}`);
		const check = value => assertHostedSpecializationReport(value, group.name, member.member, source);
		check(original);
		const mutations = [
			value => { value.reproducible = false; }
			, value => { value.reports.pop(); }
			, value => { value.reports[0].profile = "browser-javascript"; }
			, value => { value.reports[0].path = "reviewed-ir"; }
			, value => { value.reports[0].checks--; }
			, value => { value.reports[0].sourceRemovedBeforeInstallation = false; }
			, value => { value.reports[0].offlineInstall = false; }
			, value => { value.reports[0].compilerFreePath = false; }
			, value => { value.reports[0].consumerSha256 = "0".repeat(64); }
			, value => { value.reports[0].bindingIrSha256 = "invalid"; }
			, value => { value.reports[0].packages = []; }
			, value => { value.reports[0].packages[0].artifacts[0].sha256 = "0".repeat(64); }
			, value => { value.archives["archives/invented.tar.gz"] = "0".repeat(64); }
		];
		if(original.reports[0].exports) mutations.push(value => { value.reports[0].exports.pop(); });
		if(original.reports[0].instantiations) mutations.push(value => { value.reports[0].instantiations.MarkerTag.arguments[0].id = "NatBox"; });
		if(original.reports[0].specializations) mutations.push(value => { value.reports[0].specializations.pop(); });
		for(const mutate of mutations)
		{
			const changed = structuredClone(original); mutate(changed);
			assert.throws(() => check(changed), assert.AssertionError, `${group.name}/${member.member}`);
		}
		for(const [index, report] of original.reports.entries())
		{
			const key = report.rustTypes ? "rustTypes" : report.managedTypes ? "managedTypes" : null;
			if(!key) continue;
			for(const mutate of [
				value => { value.rejected.pop(); }
				, value => { value.rejected[0].case = "invented"; }
				, value => { value.rejected[0].diagnostics = ""; }
				, value => { value.rejected[0].diagnostics[0].file = "dependency.rs"; }
				, value => { value.repeatExecutionAfterTypeRejection = false; }
				, ...key === "managedTypes" ? [value => { value.artifactUnchanged = false; }, value => { value.positiveCompiles = false; }] : []
			]){
				const changed = structuredClone(original); mutate(changed.reports[index][key]);
				assert.throws(() => check(changed), assert.AssertionError);
			}
		}
	}
});

test("hosted specialization jobs distinguish passing selected tests from later cancellation and refuse skipped tests", async () => {
	for(const group of capture.captures)
	{
		const original = { job: await json(`${group.name}/job.json`), artifact: await json(`${group.name}/artifact.json`), log: await readFile(`${root}/${group.name}/job.log`, "utf8") };
		const check = value => assertHostedSpecializationJob(group, value.job, value.artifact, value.log);
		check(original);
		for(const mutate of [
			value => { value.job.id++; }
			, value => { value.job.head_sha = "0".repeat(40); }
			, value => { value.job.conclusion = group.name === "c-family" ? "success" : "cancelled"; }
			, value => { value.job.labels = ["local"]; }
			, value => { value.artifact.id++; }
			, value => { value.artifact.digest = "sha256:" + "0".repeat(64); }
			, value => { value.log = value.log.replace(/Z ok (\d+) - relocated source-free native packages install concrete specializations/u, "Z not ok $1 - relocated source-free native packages install concrete specializations"); }
			, value => { value.log = value.log.replace(/(Z ok \d+ - relocated source-free native packages install concrete specializations[^\n]*)/u, "$1 # SKIP"); }
		]){
			const changed = structuredClone(original); mutate(changed); assert.notDeepEqual(changed, original);
			assert.throws(() => check(changed), assert.AssertionError);
		}
	}
});

test("Python report names remain bound to each selected interpreter, not setup order or pass counts", async () => {
	const group = capture.captures.find(item => item.name === "python");
	const job = await json("python/job.json"), artifact = await json("python/artifact.json");
	const original = await readFile(`${root}/python/job.log`, "utf8");
	assertHostedSpecializationJob(group, job, artifact, original);
	for(const [before, after, diagnostic] of [
		["  LEAN_BRIDGE_PYTHON: /opt/hostedtoolcache/Python/3.11.17/x64/bin/python", "  LEAN_BRIDGE_PYTHON: /opt/hostedtoolcache/Python/3.12.15/x64/bin/python", /Python 3.11 compare-step environment/u]
		, ["  LEAN_BRIDGE_PYTHON: /opt/hostedtoolcache/Python/3.11.17/x64/bin/python", "  OTHER_INTERPRETER: /opt/hostedtoolcache/Python/3.11.17/x64/bin/python", /Python 3.11 compare-step environment/u]
		, ['LEAN_BRIDGE_PYTHON="/opt/hostedtoolcache/Python/3.12.15/x64/bin/python" LEAN_BRIDGE_GENERIC_RECORD_REPORT=build/generic-records/python312.json', 'LEAN_BRIDGE_PYTHON="/opt/hostedtoolcache/Python/3.11.17/x64/bin/python" LEAN_BRIDGE_GENERIC_RECORD_REPORT=build/generic-records/python312.json', /Python 3.12 command/u]
		, ["LEAN_BRIDGE_GENERIC_RECORD_SPECIALIZED_REPORT=build/generic-records/specialized-python312.json", "LEAN_BRIDGE_GENERIC_RECORD_SPECIALIZED_REPORT=build/generic-records/specialized-python.json", /Python 3.12 command/u]
	]) {
		const changed = original.replaceAll(before, after); assert.notEqual(changed, original);
		assert.throws(() => assertHostedSpecializationJob(group, job, artifact, changed), diagnostic);
	}
});

test("hosted specialization receipt rejects redirected paths and widened scope before opening files", async () => {
	for(const mutate of [
		value => { value.files[0].path = "../../foreign.json"; }
		, value => { value.files[0].path = "/tmp/foreign.json"; }
		, value => { value.files.pop(); }
		, value => { value.files.push(value.files[0]); }
		, value => { value.files.reverse(); }
		, value => { value.scope.supportPromotion = true; }
		, value => { value.scope.path = "reviewed-ir"; }
		, value => { value.scope.profiles.push("php-wasm"); }
		, value => { value.revision = "0".repeat(40); }
	]){
		const changed = structuredClone(receipt); mutate(changed); let reads = 0;
		await assert.rejects(() => assertHostedSpecializationArchive(changed, async path => { reads++; return readFile(path); }));
		assert.equal(reads, 0);
	}
});

test("hosted specialization archive rejects replaced ZIP, member, job log and source bytes, including rehashed substitutions", async () => {
	for(const suffix of ["capture.json", "c-family/artifact.zip", "python/job.log", "rust/generic-records/specialized-rust.json", "sources/tests/fixtures/generic-record-specializations.lean.txt"])
	{
		const path = `${root}/${suffix}`, changed = Buffer.from(await readFile(path)); changed[0] ^= 1;
		const read = selected => selected === path ? Promise.resolve(changed) : readFile(selected);
		await assert.rejects(() => assertHostedSpecializationArchive(receipt, read));
		const forged = structuredClone(receipt); forged.files.find(file => file.path === path).sha256 = sha256(changed);
		await assert.rejects(() => assertHostedSpecializationArchive(forged, read));
	}
});
