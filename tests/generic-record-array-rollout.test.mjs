/**
 * Bind native Array claims to immutable successful executions and existing support observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { beforeArrayRolloutSource } from "./helpers/generic-record-array-rollout-source-history.mjs";
import { arrayRolloutEvidence, arrayRolloutNote, arrayRolloutObservations, arrayRolloutReceipts, supplementArrayRolloutInventory } from "./helpers/generic-record-array-rollout.mjs";

const baseline = async () => JSON.parse(beforeArrayRolloutSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));

test("Array rollout binds thirteen successful selections to fifteen exact host observations", async () => {
	const { references, entries } = await arrayRolloutEvidence();
	assert.equal(references.length, 13); assert.equal(entries.length, 13);
	const expected = [
		["c", 2078], ["cpp", 2058], ["python", 2144], ["python", 2144]
		, ["rust", 2034], ["ruby", 2141], ["dotnet", 2088], ["java", 2105]
		, ["kotlin", 2067], ["php-native", 2124], ["wit-wasi", 2091]
		, ...Array.from({ length: 4 }, () => ["perl", 2145])];
	assert.deepEqual(references.flatMap(item => item.checks), expected);
	for(const version of ["311", "312"])
		assert.ok(references.find(item => item.name === `python${version}`).command.includes(`LEAN_BRIDGE_PYTHON=/app/.toolchains/python${version}/bin/`));
	for(const item of references.filter(item => item.name.startsWith("perl-")))
		assert.ok(item.command.includes(`LEAN_BRIDGE_CORPUS_PERL=/app/.toolchains/perl/${item.name.slice(5)}/bin/perl`));
	for(const entry of entries)
	{
		assert.ok(entry.command.includes("LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36"));
		assert.equal(entry.kind, "test"); assert.deepEqual(entry.artifacts, []);
		assert.match(entry.scope, /Local glibc 2.36 only/u);
		assert.match(entry.scope, /archive bytes are not retained here/u);
		assert.ok(entry.files.some(file => file.path.endsWith("receipt.json")));
	}
});

test("Array rollout changes only nine observations and preserves all prior evidence and support states", async () => {
	const previous = await baseline(), current = await supplementArrayRolloutInventory(previous);
	assert.deepEqual(current.evidence.slice(0, previous.evidence.length), previous.evidence);
	assert.equal(current.evidence.length, previous.evidence.length + 13);
	assert.equal(current.observations.length, previous.observations.length);
	assert.deepEqual(current.observations.filter((item, index) => JSON.stringify(item) !== JSON.stringify(previous.observations[index])).map(item => item.id).sort(), [...arrayRolloutObservations].sort());
	for(const [index, item] of current.observations.entries())
	{
		const old = previous.observations[index];
		assert.deepEqual([item.profiles, item.shapes, item.positions, item.path, item.limitations, item.hostTypes], [old.profiles, old.shapes, old.positions, old.path, old.limitations, old.hostTypes]);
		for(const [name, stage] of Object.entries(item.stages))
		{
			assert.equal(stage.state, old.stages[name].state);
			assert.equal(stage.note, old.stages[name].note);
			assert.deepEqual(stage.evidence.slice(0, old.stages[name].evidence.length), old.stages[name].evidence);
		}
		if(arrayRolloutObservations.includes(item.id)) assert.ok(item.scope.endsWith(arrayRolloutNote));
	}
	await assert.rejects(supplementArrayRolloutInventory(current), /already supplemented/u);
});

test("Array rollout refuses altered originals, receipts and broadened observation targets", async () => {
	for(const [path] of arrayRolloutReceipts)
		await assert.rejects(arrayRolloutEvidence(async name => name === path ? Buffer.from("{}\n") : readFile(name)));
	const { references } = await arrayRolloutEvidence();
	for(const item of references)
		await assert.rejects(arrayRolloutEvidence(async name => name === item.report ? Buffer.from("{}\n") : readFile(name)), item.report);
	const previous = await baseline();
	for(const mutation of [item => { item.path = "reviewed-ir"; }, item => { item.positions.push("field"); }, item => { item.profiles.push("browser-worker"); }, item => { item.stages.installedExecution.state = "not-audited"; }])
	{
		const changed = structuredClone(previous); mutation(changed.observations.find(item => item.id === arrayRolloutObservations[0]));
		await assert.rejects(supplementArrayRolloutInventory(changed));
	}
});

test("Array rollout guidance covers every native consumer and distinguishes local from hosted acceptance", async () => {
	const paths = ["docs/php.md"
		, ...["c", "cpp", "python", "rust", "ruby", "dotnet", "java", "kotlin", "perl", "wit-wasi"].map(name => `docs/consume/${name}.md`)
		, "docs/lean/existing-package.md", "docs/lean/export-decisions.md"];
	for(const path of paths) assert.ok((await readFile(path, "utf8")).includes("generic-record-array-rollout-20261009.md"), path);
	const evidence = await readFile("docs/evidence/generic-record-array-rollout-20261009.md", "utf8");
	assert.ok(evidence.includes("13 successful selections and\n15 language/runtime observations"));
	assert.ok(evidence.includes("first Perl attempt failed"));
	assert.ok(evidence.includes("Workflow configuration is not a hosted pass"));
});
