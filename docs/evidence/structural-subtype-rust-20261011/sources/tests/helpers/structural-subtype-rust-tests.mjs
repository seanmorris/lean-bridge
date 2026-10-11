/**
 * Rust author selections and strict caller-result controls. Installed tests are separate.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { structuralSubtypeConfiguration } from "./structural-subtype-installed-fixture.mjs";
import { structuralSubtypeRustConfiguration, structuralSubtypeRustCaller, structuralSubtypeRustCounts, parseStructuralSubtypeRustResult } from "./structural-subtype-rust-fixture.mjs";

test("structural Rust author routes preserve independent contracts and caller identities", async () => {
	for(const route of ["ordinary", "reviewed"])
	{
		const configured = structuralSubtypeRustConfiguration(route), common = structuralSubtypeConfiguration(route, ["c"]);
		assert.deepEqual({ ...configured, targets: common.targets }, common);
		assert.deepEqual(configured.targets, { cargo: { name: "structuralsubtypes", version: "1.0.0" } });
	}
	assert.equal(await structuralSubtypeRustCaller("reviewed"), (await structuralSubtypeRustCaller("ordinary")).replaceAll(/arg([01])/gu, "value$1"));
	assert.throws(() => structuralSubtypeRustConfiguration("unknown"));
	await assert.rejects(structuralSubtypeRustCaller("unknown"));
});

test("structural Rust caller output must retain every check, refusal and snapshot control", () => {
	assert.deepEqual(parseStructuralSubtypeRustResult(JSON.stringify(structuralSubtypeRustCounts)), structuralSubtypeRustCounts);
	for(const key of Object.keys(structuralSubtypeRustCounts))
	{
		assert.throws(() => parseStructuralSubtypeRustResult(JSON.stringify({ ...structuralSubtypeRustCounts, [key]: 0 })));
		const missing = { ...structuralSubtypeRustCounts }; delete missing[key];
		assert.throws(() => parseStructuralSubtypeRustResult(JSON.stringify(missing)));
	}
	assert.throws(() => parseStructuralSubtypeRustResult(JSON.stringify({ ...structuralSubtypeRustCounts, dispatchObserved: true })));
	assert.throws(() => parseStructuralSubtypeRustResult("rust-ok"));
});
