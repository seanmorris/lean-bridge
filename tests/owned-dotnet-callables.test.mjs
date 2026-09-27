/**
 * Execute generated owned .NET callback bindings against real Lean calls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileOwnedDotnetFixture } from "./helpers/owned-dotnet-native.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

for(const reviewed of [false, true]) test(`owned C# host callbacks execute real Lean (${reviewed ? "reviewed" : "ordinary"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedDotnetFixture(t, {
		fixture: "owned-cpp-composition"
		, ...reviewed ? { reviewedIr: ownedCppCompositionReviewedIr() } : {}
	});
	const probe = await readFile("tests/fixtures/structured-types/owned-dotnet-callables.cs", "utf8");
	const execute = await compiled.compile({ "Program.cs": probe });
	const observations = [];
	for(const mode of ["callbacks", "retirement"])
	{
		const result = await execute(mode);
		assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
		assert.equal(observation.live, 0); assert.equal(observation.identities, 0);
		assert.ok(observation.checks > (mode === "callbacks" ? 100 : 1));
		if(mode === "callbacks") assert.ok(observation.managedFailures > 0 && observation.nativeFailures > 0);
		observations.push({ mode, ...observation }); t.diagnostic(JSON.stringify(observations.at(-1)));
	}
	await saveLakeFile(resolve("build/owned-dotnet-callables"), `${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({
		observations, compiledLean: true, hostDelegates: true, installedPackage: false
		, bindingIr: compiled.model.c.native.model.bindingIr
		, sourceIdentitySha256: compiled.sourceIdentitySha256
		, generated: Object.fromEntries(Object.entries(compiled.model.files).map(([name, text]) => [name, sha256(text)]))
		, nativeProbeSha256: sha256(compiled.implementation)
		, managedProbeSha256: sha256(probe), loaderSha256: sha256(compiled.loader)
	}));
});
