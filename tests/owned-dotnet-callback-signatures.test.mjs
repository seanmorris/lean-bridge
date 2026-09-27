/**
 * All scalar callback ABIs, incoming closures and asynchronous-delegate rejection.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedDotnetCalls } from "../src/backends/dotnet/owned-calls.mjs";
import { compileOwnedDotnetFixture } from "./helpers/owned-dotnet-native.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./helpers/owned-dotnet-callback-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("owned C# callback model preserves every scalar and directional higher-order signature", () => {
	const ir = ownedDotnetCallbacksReviewedIr(), original = structuredClone(ir);
	const model = generateOwnedDotnetCalls(ir);
	assert.deepEqual(ir, original); assert.equal(model.callbacks.length, 27);
	assert.equal(model.types.filter(node => node.kind === "primitive").length, 19);
	assert.deepEqual(model.files, generateOwnedDotnetCalls(ir).files);
	assert.match(model.files["Api.cs"], /void ViaUnit\(_V.ViaUnitArgument0ClosureCallback arg0, _V.Unit arg1\)/u);
	assert.match(model.files["Calls.cs"], /function.Equals\(closure.AsCallback\)/u);
	assert.match(model.files["Calls.cs"], /GetInvocationList/u);
	assert.doesNotMatch(model.files["Calls.cs"], /DynamicInvoke|Environment.ProcessId|GCHandle/u);
});

for(const reviewed of [false, true]) test(`owned C# scalar and higher-order callback signatures (${reviewed ? "reviewed" : "ordinary"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedDotnetFixture(t, {
		fixture: "owned-dotnet-callables"
		, ...reviewed ? { reviewedIr: ownedDotnetCallbacksReviewedIr() } : {}
	});
	const probe = await readFile("tests/fixtures/structured-types/owned-dotnet-callback-signatures.cs", "utf8");
	const execute = await compiled.compile({ "Program.cs": probe });
	const result = await execute(); assert.equal(result.stderr, "");
	const observation = JSON.parse(result.stdout);
	assert.equal(observation.primitives, 19); assert.equal(observation.calls, 20);
	assert.ok(observation.checks >= 35); assert.equal(observation.live, 0); assert.equal(observation.identities, 0);
	await saveLakeFile(resolve("build/owned-dotnet-callables"), `signatures-${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({
		observation, compiledLean: true, hostDelegates: true, installedPackage: false
		, bindingIr: compiled.model.c.native.model.bindingIr
		, sourceIdentitySha256: compiled.sourceIdentitySha256
		, generated: Object.fromEntries(Object.entries(compiled.model.files).map(([name, text]) => [name, sha256(text)]))
		, nativeProbeSha256: sha256(compiled.implementation)
		, managedProbeSha256: sha256(probe), loaderSha256: sha256(compiled.loader)
	}));
	t.diagnostic(JSON.stringify(observation));
});
