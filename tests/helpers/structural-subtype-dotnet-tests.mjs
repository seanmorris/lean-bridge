/**
 * Dotnet author selections and strict caller-result controls. Installed tests are separate.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { structuralSubtypeConfiguration } from "./structural-subtype-installed-fixture.mjs";
import { structuralSubtypeDotnetConfiguration, structuralSubtypeDotnetCaller, structuralSubtypeDotnetCounts, parseStructuralSubtypeDotnetResult } from "./structural-subtype-dotnet-fixture.mjs";
import "./structural-subtype-dotnet-evidence-tests.mjs";

test("structural Dotnet author routes preserve independent contracts and caller identities", async () => {
	for(const route of ["ordinary", "reviewed"])
	{
		const configured = structuralSubtypeDotnetConfiguration(route), common = structuralSubtypeConfiguration(route, ["c"]);
		assert.deepEqual({ ...configured, targets: common.targets }, common);
		assert.deepEqual(configured.targets, { nuget: { name: "StructuralSubtypes.Api", version: "1.0.0" } });
	}
	assert.equal(await structuralSubtypeDotnetCaller("reviewed"), (await structuralSubtypeDotnetCaller("ordinary")).replaceAll(/arg([01])/gu, "value$1"));
	assert.throws(() => structuralSubtypeDotnetConfiguration("unknown"));
	await assert.rejects(structuralSubtypeDotnetCaller("unknown"));
});

test("structural Dotnet caller output must retain every check, refusal and snapshot control", () => {
	assert.deepEqual(parseStructuralSubtypeDotnetResult(JSON.stringify(structuralSubtypeDotnetCounts)), structuralSubtypeDotnetCounts);
	for(const key of Object.keys(structuralSubtypeDotnetCounts))
	{
		assert.throws(() => parseStructuralSubtypeDotnetResult(JSON.stringify({ ...structuralSubtypeDotnetCounts, [key]: 0 })));
		const missing = { ...structuralSubtypeDotnetCounts }; delete missing[key];
		assert.throws(() => parseStructuralSubtypeDotnetResult(JSON.stringify(missing)));
	}
	assert.throws(() => parseStructuralSubtypeDotnetResult(JSON.stringify({ ...structuralSubtypeDotnetCounts, dispatchObserved: true })));
	assert.throws(() => parseStructuralSubtypeDotnetResult("dotnet-ok"));
});
