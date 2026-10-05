/**
 * Independent array and record shapes retain their typed C# public surface.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileCopiedDotnetModel } from "../src/backends/dotnet/copied-model.mjs";
import { generateCopiedDotnetPackage } from "../src/backends/dotnet/copied-values.mjs";
import { generateDotnetBindingPackage } from "../src/backends/dotnet/generate.mjs";
import { collectionReviewedIr } from "./helpers/collection-fixture.mjs";
import { dotnetCollectionProbe } from "./helpers/dotnet-collection-probes.mjs";
import { assertDotnetVariantSourceHash } from "./helpers/dotnet-source-history.mjs";

test("C# collections admit all 35 exports and seven nominal records", () => {
	const ir = collectionReviewedIr(), model = compileCopiedDotnetModel(ir), files = generateCopiedDotnetPackage(ir);
	assert.equal(model.surface.functions.length, 35);
	assert.deepEqual(files, generateCopiedDotnetPackage(structuredClone(ir)));
	assert.deepEqual(files, generateDotnetBindingPackage(ir));
	const records = model.surface.copies.filter(copy => copy.record);
	assert.deepEqual(records.map(copy => copy.publicName), ["Primitives", "Empty", "Single", "Count", "Pair", "Reversed", "Packet"]);
	const source = files["src/LeanBridge.Collections/Api.cs"];
	assert.match(source, /Primitives\(Unit Unit, bool Flag, byte U8/);
	assert.match(source, /Pair\(uint First, string Second\)/);
	assert.match(source, /Reversed\(string Second, uint First\)/);
	assert.match(source, /Primitives\[\]\[\] Values, Empty Empty, Single Single, Count Count, Pair Pair, Reversed Reversed/);
	for(const [name, type] of Object.entries({ Unit: "Unit", Bool: "bool", Uint8: "byte", Uint16: "ushort", Uint32: "uint", Uint64: "ulong", Int8: "sbyte", Int16: "short", Int32: "int", Int64: "long", Nat: "global::System.Numerics.BigInteger", Int: "global::System.Numerics.BigInteger", Float32: "float", Float64: "double", String: "string", Bytes: "byte[]", Char: "global::System.Text.Rune", Usize: "ulong", Isize: "long" }))
		assert.ok(source.includes(`public static ${type}[][] ArrayReverse${name}(${type}[][] @value0)`), name);
	assert.doesNotMatch(source, /unsafe|DllImport|nint|nuint|System.Text.Json/);
});

test("C# record properties may share type names but not synthesized member names", () => {
	for(const name of ["api", "unit", "leanBridgeException", "leanClosure", "interop"])
	{
		const ir = collectionReviewedIr();
		ir.types.find(type => type.name === "Pair").fields[0].name = name;
		assert.doesNotThrow(() => compileCopiedDotnetModel(ir), name);
	}
	for(const name of ["equals", "getHashCode", "memberwiseClone", "clone", "deconstruct", "pair", "Second"])
	{
		const ir = collectionReviewedIr();
		ir.types.find(type => type.name === "Pair").fields[0].name = name;
		assert.throws(() => compileCopiedDotnetModel(ir), /(?:C# record field name collides|C\/C\+\+ record field is reserved or duplicated)/, name);
	}
});

test("C# deep array inputs and results keep 24 explicit levels", () => {
	const model = compileCopiedDotnetModel(collectionReviewedIr());
	const fn = model.surface.functions.find(fn => fn.field === "deep");
	assert.equal(model.publicType(model.surface.copy(fn.declaration.result.type)), "uint" + "[]".repeat(24));
});

test("C# native scalar results use bounded buffers and canonical markers", () => {
	const runtime = generateCopiedDotnetPackage(collectionReviewedIr())["src/LeanBridge.Collections/Runtime.cs"];
	assert.match(runtime, /if \(length == 0\) return ReadOnlySpan<T>\.Empty/);
	assert.match(runtime, /data == 0 \|\| \(nuint\)data % \(nuint\)alignment != 0/);
	assert.match(runtime, /CheckedBuffer<uint>\(value.Data, value.Length, 4\)/);
	assert.match(runtime, /CheckedBuffer<byte>\(value.Data, value.Length, 1\)/);
	for(const message of ["Invalid native Unit marker", "Invalid native Bool value", "Invalid native Int sign", "Invalid native integer magnitude", "Invalid native negative zero"])
		assert.ok(runtime.includes(message), message);
});

test("C# collection callers use every public export without private transport access", async () => {
	const source = await readFile("tests/fixtures/collection-consumers/dotnet.cs", "utf8");
	const calls = new Set([...source.matchAll(/Api\.(\w+)/g)].map(match => match[1]));
	assert.equal(calls.size, 35);
	assert.doesNotMatch(source, /Interop|DllImport|Marshal|\bunsafe\b|BindingFlags\.NonPublic|JsonSerializer/);
	const invalid = JSON.parse(await readFile("tests/fixtures/collection-consumers/dotnet-invalid.json"));
	assert.equal(invalid.length, 16); assert.equal(new Set(invalid.map(item => item.name)).size, 16);
	for(const item of invalid) assert.match(item.code, /^CS\d{4}$/);
});

test("C# collection failure instrumentation never modifies the original sources", async () => {
	const files = generateCopiedDotnetPackage(collectionReviewedIr()), original = structuredClone(files);
	const sources = { api: files["src/LeanBridge.Collections/Api.cs"], runtime: files["src/LeanBridge.Collections/Runtime.cs"] };
	const probe = await dotnetCollectionProbe(sources);
	assert.deepEqual(files, original); assert.equal(sources.runtime, files["src/LeanBridge.Collections/Runtime.cs"]);
	assert.doesNotMatch(sources.runtime, /CollectionProbe/);
	assert.match(probe.runtime, /CollectionProbe\.Check\(\)/);
	assert.equal(probe.replacements[4], 35); assert.equal(probe.replacements[5], 32);
	assert.match(probe.program, /if \(!native\) Check\(Probe.Calls == 0 && Probe.Clears == 0\)/);
});

test("C# historical verifier upgrades preserve recorded hashes and reject other edits", async () => {
	const record = JSON.parse(await readFile("docs/evidence/dotnet-variants-20260921.json"));
	for(const path of ["tests/dotnet-variant-contract.test.mjs", "tests/dotnet-variant-evidence.test.mjs"])
	{
		const source = await readFile(path);
		assert.doesNotThrow(() => assertDotnetVariantSourceHash(path, source, record.sourceHashes[path]));
		assert.throws(() => assertDotnetVariantSourceHash(path, source + "\n", record.sourceHashes[path]));
		assert.throws(() => assertDotnetVariantSourceHash("unapproved.mjs", source, record.sourceHashes[path]), /Unreviewed historical/);
	}
});
