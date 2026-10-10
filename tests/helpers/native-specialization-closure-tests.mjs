/**
 * Registered closure regressions for #1426 and #1455, shared with the native rollout CI root.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { hostedArrayDirectory } from "./generic-record-array-hosted-evidence.mjs";
import { assertHostedSpecializationReport } from "./hosted-specialization-evidence.mjs";
import { assertNativeSpecializationClosure, assertSpecializationClosureExecution, assertSpecializationClosureInventory, assertSpecializationClosureSources, specializationClosureDirectory } from "./native-specialization-closure.mjs";

const json = async path => JSON.parse(await readFile(path));
const receipt = await json(`${specializationClosureDirectory}/receipt.json`);
const texts = new Map(await Promise.all(receipt.sources.map(async item => [item.path, await readFile(item.archivePath, "utf8")])));
const source = path => { assert.ok(texts.has(path)); return texts.get(path); };

test("native specialization closure separates fourteen function observations from forty-five record observations", async () => {
	assert.deepEqual(await assertNativeSpecializationClosure(receipt), {
		functionReports: 12, functionObservations: 14, functionSources: 18
		, recordReports: 39, recordObservations: 45
	});
});

test("native specialization closure refuses forged references and missing or substituted original reports", async () => {
	for(const mutate of [value => { value.reports.pop(); }, value => { value.archives.pop(); }, value => { value.sources.pop(); }, value => { value.scope.supportPromotion = true; }, value => { value.scope.path = "reviewed-ir"; }])
	{
		const changed = structuredClone(receipt); mutate(changed); let reads = 0;
		await assert.rejects(assertNativeSpecializationClosure(changed, async () => { reads++; return Buffer.alloc(0); }));
		assert.equal(reads, 0);
	}
	for(const group of ["c-family", "python", "perl-5.38.2-unthreaded"])
	{
		const item = receipt.reports.find(item => item.group === group);
		await assert.rejects(assertNativeSpecializationClosure(receipt, path => path === item.path ? Promise.resolve(Buffer.from("{}\n")) : readFile(path)));
		await assert.rejects(assertNativeSpecializationClosure(receipt, async path => {
			if(path === item.path) throw new Error("missing common-function report");
			return readFile(path);
		}), /missing common-function report/u);
	}
});

test("closed record success cannot substitute for the ten-function fixture or its selected instance", async () => {
	for(const item of receipt.reports)
	{
		const report = await json(item.path);
		assertHostedSpecializationReport(report, item.group, item.member, source);
		const other = await json(`${hostedArrayDirectory}/${item.group}/${item.member.replace("native-specializations/", "generic-records/specialized-")}`);
		assert.throws(() => assertHostedSpecializationReport(other, item.group, item.member, source));
	}
	assertSpecializationClosureSources(source);
	for(const [path, from, to] of [
		["tests/fixtures/onboarding/native-specializations/Specialized.lean", "⟨37⟩", "⟨0⟩"]
		, ["tests/helpers/native-specialization-install.mjs", 'types: ["String", "UInt32"]', 'types: ["String", "String"]']
		, ["tests/fixtures/specialization-consumers/perl.pl", "for my $i (0 .. 999)", "for my $i (0 .. 9)"]
		, ["tests/native-specializations.test.mjs", "assert.deepEqual(entry.typeParameters, [], name)", "void entry"]
		, ["tests/native-specializations.test.mjs", "await rm(directory, { recursive: true, force: true })", "void directory"]
		, ["tests/helpers/copied-fixture-install.mjs", '"-Wall", "-Wextra", "-Werror", "-UNDEBUG"', '"-Wall"']
	]) {
		const changed = source(path).replace(from, to); assert.notEqual(changed, source(path));
		assert.throws(() => assertSpecializationClosureSources(name => name === path ? changed : source(name)));
	}
});

test("function closure rejects skipped execution, missing commands and wrong Python selection", async () => {
	const title = "relocated source-free native packages install concrete specializations without the generic declaration";
	for(const item of receipt.reports)
	{
		const original = await readFile(`${hostedArrayDirectory}/job-${item.jobId}.log`, "utf8");
		assertSpecializationClosureExecution(item, original);
		for(const changed of [original.replaceAll(title, `${title} # SKIP`)
			, original.replaceAll("LEAN_BRIDGE_SPECIALIZATION_PROFILES=", "WRONG_PROFILES=")
			, original.replaceAll(`test -s build/${item.member}`, `echo build/${item.member}`)])
			assert.throws(() => assertSpecializationClosureExecution(item, changed));
		if(item.group === "python") assert.throws(() => assertSpecializationClosureExecution(item, original.replaceAll("LEAN_BRIDGE_PYTHON: /opt/hostedtoolcache/Python/3.11.17/", "LEAN_BRIDGE_PYTHON: /opt/hostedtoolcache/Python/3.12.15/")));
	}
});

test("closure reconciles all nine native observations and 231 current evidence/source files without promotion", async () => {
	const inventory = await json("docs/type-surface.v1.json");
	assert.deepEqual(await assertSpecializationClosureInventory(inventory), { observations: 9, profiles: 11, currentFiles: 231 });
	const id = "native-specializations-python-ordinary-source";
	for(const mutate of [value => { value.path = "reviewed-ir"; }, value => { value.profiles.push("browser-javascript"); }, value => { value.stages.installedExecution.state = "not-audited"; }, value => { value.stages.installedExecution.evidence = []; }])
	{
		const changed = structuredClone(inventory); mutate(changed.observations.find(item => item.id === id));
		await assert.rejects(assertSpecializationClosureInventory(changed));
	}
	await assert.rejects(assertSpecializationClosureInventory(inventory, async () => Buffer.from("wrong current source")));
});

test("closure documentation preserves historical evidence and points current readers to the completed scope", async () => {
	const page = (await readFile("docs/evidence/native-specialization-closure-20261010.md", "utf8")).replace(/\s+/gu, " ");
	for(const label of ["37", "four Perl configurations", "3.11.17", "3.12.15", "Reviewed Binding IR", "#1426", "#1455"]) assert.ok(page.includes(label), label);
	const old = await readFile("docs/evidence/hosted-specializations-20261009.md", "utf8");
	assert.ok(old.includes("native-specialization-closure-20261010.md"));
	assert.ok(!old.includes("VO #1439 still requires"));
});
