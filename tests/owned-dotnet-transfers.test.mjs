/**
 * Compiled .NET input transfers, pinned handoffs and explicit failure cleanup.
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
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { ownedRustTransferConfiguration, ownedRustTransferReviewedIr, ownedRustTransferSource } from "./helpers/owned-rust-transfer-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("C# consuming inputs require capability and preserve borrow-only APIs", () => {
	const ir = ownedRustTransferReviewedIr(), original = structuredClone(ir);
	assert.throws(() => generateOwnedDotnetCalls(ir), /call-scoped input borrows/u);
	const generated = generateOwnedDotnetCalls(ir, { transferredInputs: true });
	assert.deepEqual(ir, original);
	assert.equal(generated.functions.filter(fn => fn.transfers?.length).length, 20);
	assert.equal(generated.files["Api.cs"].split("Consumes resource leases in ").length - 1, 20);
	assert.match(generated.files["Api.cs"], /Consumes resource leases in arg0, arg2 at the Lean call boundary/u);
	assert.match(generated.files["Calls.cs"], /fixed \(nint\* inputOwner0 = &moves.Owners\[0\].Value\)/u);
	const reversed = structuredClone(ir); reversed.types.reverse();
	assert.deepEqual(generateOwnedDotnetCalls(reversed, { transferredInputs: true }).files, generated.files);
	for(const fixture of [ownedCppCompositionReviewedIr, ownedPythonScalarsReviewedIr])
		assert.deepEqual(generateOwnedDotnetCalls(fixture(), { transferredInputs: true }).files, generateOwnedDotnetCalls(fixture()).files);
});

for(const mode of ["ordinary", "reviewed"]) test(`C# leases follow the compiled Lean handoff (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_DOTNET_TRANSFER_TEST !== "1"
	, timeout: 900000
}, async t => {
	const compiled = await compileOwnedDotnetFixture(t, {
		...(mode === "ordinary" ? { configuration: await ownedRustTransferConfiguration() } : { reviewedIr: ownedRustTransferReviewedIr() })
		, transferredInputs: true, sourceSuffix: ownedRustTransferSource
		, evidenceName: `dotnet-transfers-${mode}-inputs.json`
	});
	const source = await readFile("tests/fixtures/structured-types/owned-dotnet-transfers.cs", "utf8");
	let observed;
	try
	{
		const execute = await compiled.compile({ "Program.cs": source });
		const result = await execute("transfers"); assert.equal(result.stderr, "");
		observed = JSON.parse(result.stdout);
	}
	catch(error)
	{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
	assert.ok(observed.checks > 500);
	for(const key of ["managedBefore", "managedAfter"
		, "nativeBefore", "nativeAfter", "multiManagedBefore", "multiManagedAfter"
		, "multiNativeBefore", "multiNativeAfter"])
		assert.ok(Number.isSafeInteger(observed[key]) && observed[key] > 0, key);
	assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
	t.diagnostic(JSON.stringify(observed));
	await saveLakeFile(resolve("build/owned-dotnet-transfers"), `${mode}.json`, canonicalJson({
		mode, actualLean: true, installedPackage: false, observed
		, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.model.c.native.model.component }
		, generated: Object.fromEntries(Object.entries(compiled.model.files).map(([path, text]) => [path, sha256(text)]))
		, nativeProbeSha256: sha256(compiled.implementation)
		, loaderSha256: sha256(compiled.loader), probeSha256: sha256(source)
	}));
});
