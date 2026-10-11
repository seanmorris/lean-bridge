/**
 * Jvm author selections and strict caller-result controls. Installed tests are separate.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { structuralSubtypeConfiguration } from "./structural-subtype-installed-fixture.mjs";
import { structuralSubtypeJvmConfiguration, structuralSubtypeJvmCaller, structuralSubtypeJvmCounts, parseStructuralSubtypeJvmResult } from "./structural-subtype-jvm-fixture.mjs";
import "./structural-subtype-jvm-caller-tests.mjs";
import "./structural-subtype-jvm-evidence-tests.mjs";

test("structural Jvm author routes preserve independent contracts and caller identities", async () => {
	for(const route of ["ordinary", "reviewed"])
	{
		const configured = structuralSubtypeJvmConfiguration(route), common = structuralSubtypeConfiguration(route, ["c"]);
		assert.deepEqual({ ...configured, targets: common.targets }, common);
		assert.deepEqual(configured.targets, { maven: { name: "org.leanbridge:structuralsubtypes", version: "1.0.0" } });
	}
	for(const profile of ["java", "kotlin"])
		assert.equal(await structuralSubtypeJvmCaller(profile, "reviewed"), (await structuralSubtypeJvmCaller(profile, "ordinary")).replaceAll(/arg([01])/gu, "value$1"));
	assert.throws(() => structuralSubtypeJvmConfiguration("unknown"));
	await assert.rejects(structuralSubtypeJvmCaller("unknown", "ordinary"));
	await assert.rejects(structuralSubtypeJvmCaller("java", "unknown"));
});

test("structural Jvm caller output must retain every check, refusal and snapshot control", () => {
	assert.deepEqual(parseStructuralSubtypeJvmResult(JSON.stringify(structuralSubtypeJvmCounts)), structuralSubtypeJvmCounts);
	for(const key of Object.keys(structuralSubtypeJvmCounts))
	{
		assert.throws(() => parseStructuralSubtypeJvmResult(JSON.stringify({ ...structuralSubtypeJvmCounts, [key]: 0 })));
		const missing = { ...structuralSubtypeJvmCounts }; delete missing[key];
		assert.throws(() => parseStructuralSubtypeJvmResult(JSON.stringify(missing)));
	}
	assert.throws(() => parseStructuralSubtypeJvmResult(JSON.stringify({ ...structuralSubtypeJvmCounts, dispatchObserved: true })));
	assert.throws(() => parseStructuralSubtypeJvmResult("jvm-ok"));
});
