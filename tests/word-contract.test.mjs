/**
 * Preserve platform integer identity while binding ranges to compiled targets.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { componentScalarTypes, fixedPlatformInteger, validateComponentScalar } from "../src/abi/component-scalars.mjs";
import { validateBindingIr } from "../src/binding-ir/contract.mjs";
import { validateNativeType } from "../src/analyze/native-types.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { reconcileReviewedSource } from "../src/analyze/reviewed-source.mjs";
import { callComponentScalar } from "../src/release/component-runtime.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { generateComponentScalarAdapters } from "../src/build/component-scalar-adapters.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { copiedPhpPublicSource } from "../src/backends/php/copied-values.mjs";
import { compileCopiedRustModel } from "../src/backends/rust/copied-model.mjs";
import { compileCopiedJvmModel } from "../src/backends/jvm/copied-model.mjs";
import { compileCopiedDotnetModel } from "../src/backends/dotnet/copied-model.mjs";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";
import { wordNativeSignatures, wordReviewedIr } from "./helpers/word-fixture.mjs";

const scalar = name => ({ kind: "primitive", name });
const compiled = wordReviewedIr(wordNativeSignatures);

test("platform integers retain distinct semantic names and append wire tags without renumbering", async () => {
	validateBindingIr(compiled); await assertJsonSchema("binding-ir", compiled);
	assert.equal(componentScalarTypes.indexOf("char"), 16);
	assert.equal(componentScalarTypes.indexOf("usize"), 17);
	assert.equal(componentScalarTypes.indexOf("isize"), 18);
	assert.equal(componentScalarTypes.length, 19);
	for(const [name, lean] of [["usize", "USize"], ["isize", "ISize"]])
	{
		const type = { ...scalar(name), lean, abi: { cType: "size_t", box: "lean_box_usize", unbox: "lean_unbox_usize", heap: false } };
		validateNativeType(type); await assertJsonSchema("native-metadata-type", type);
		assert.throws(() => validateNativeType({ ...type, abi: { cType: "uint64_t", box: "lean_box_uint64", unbox: "lean_unbox_uint64", heap: false } }), /size_t/);
		assert.throws(() => validateNativeType({ ...type, lean: name === "usize" ? "UInt64" : "Int64" }), /spelling/);
		assert.throws(() => validateNativeType({ ...type, name: "uint64", lean: "UInt64" }), /size_t/);
		assert.throws(() => fixedPlatformInteger(name), /compiled target/);
		assert.throws(() => fixedPlatformInteger(name, 16), /compiled target/);
	}
});

test("a reviewed fixed-width substitute is rejected in scalar, array and record positions", () => {
	const configuration = canonicalJson({ schemaVersion: 1, modules: ["Words"] });
	const identity = { exportConfigurationSource: configuration
		, exportConfigurationSha256: sha256(configuration)
		, request: { exportModules: ["Words"], exports: compiled.declarations.map(item => item.source.declaration), resources: [], arities: [] } };
	for(const width of [32, 64]) for(const [name, prefix, index] of [["usize", "uint", 0], ["isize", "int", 1]])
		for(const change of [
			ir => { ir.declarations[index].parameters[0].type.name = `${prefix}${width}`; }
			, ir => { ir.declarations[index].result.type.name = `${prefix}${width}`; }
			, ir => { ir.declarations[7 + index].parameters[0].type.arguments[0].name = `${prefix}${width}`; }
			, ir => { ir.types[0].fields[index].type.name = `${prefix}${width}`; }
		]){
			const ir = structuredClone(compiled); change(ir);
			assert.equal(compiled.declarations[index].result.type.name, name);
			const source = canonicalJson(ir);
			const review = { schemaVersion: 1, path: "reviewed.binding-ir.json", source, sourceSha256: sha256(source), semanticSha256: hashBindingIr(ir) };
			assert.throws(() => reconcileReviewedSource(review, compiled, identity), { code: "reviewed-ir-source-mismatch" });
		}
});

test("copied transports use stable carriers and explicit compiled-target ranges", () => {
	for(const wordBits of [32, 64])
	{
		const surface = compilePrimitiveCSurface(compiled, { wordBits });
		const u = surface.copy(scalar("usize")), s = surface.copy(scalar("isize"));
		assert.equal(u.ref.name, "usize"); assert.equal(s.ref.name, "isize");
		assert.equal(u.scalarName, `uint${wordBits}`); assert.equal(s.scalarName, `int${wordBits}`);
		assert.equal(u.name, "uint64_t"); assert.equal(s.name, "int64_t");
		const php = compileCopiedPhpModel(compiled, { integerBits: wordBits, wordBits });
		assert.equal(php.surface.copy(scalar("usize")).publicType, "\\Brick\\Math\\BigInteger");
		assert.equal(php.surface.copy(scalar("isize")).publicType, "int");
	}
	const rust = compileCopiedRustModel(compiled);
	assert.equal(rust.surface.copy(scalar("usize")).publicType, "u64");
	assert.equal(rust.surface.copy(scalar("isize")).publicType, "i64");
	const dotnet = compileCopiedDotnetModel(compiled), jvm = compileCopiedJvmModel(compiled);
	assert.equal(dotnet.publicType(dotnet.surface.copy(scalar("usize"))), "ulong");
	assert.equal(dotnet.publicType(dotnet.surface.copy(scalar("isize"))), "long");
	assert.equal(jvm.publicType(jvm.surface.copy(scalar("usize"))), "java.math.BigInteger");
	assert.equal(jvm.publicType(jvm.surface.copy(scalar("isize"))), "long");
	const wit = compileCopiedWitModel(compiled);
	assert.match(wit.wit, /keep-unsigned: func\([^)]*: u64\) -> u64/);
	assert.match(wit.wit, /keep-signed: func\([^)]*: s64\) -> s64/);
});

test("installed PHP Word callers use source record fields and projected function names", async () => {
	const source = await readFile("tests/fixtures/word-consumers/php-native.php", "utf8");
	const fields = ["natural", "integer", "unsignedValues", "signedValues"];
	const constructors = [...source.matchAll(/new Sample\(([^)]*)\)/gu)];
	assert.equal(constructors.length, 5);
	for(const [, args] of constructors)
		assert.deepEqual([...args.matchAll(/\b([A-Za-z]\w*):/gu)].map(match => match[1]), fields);
	assert.deepEqual([...source.matchAll(/\$sample->([A-Za-z]\w*)/gu)].map(match => match[1]), fields);
	for(const wordBits of [32, 64])
	{
		const model = compileCopiedPhpModel(compiled, { integerBits: wordBits, wordBits });
		const record = model.surface.copies.find(copy => copy.record?.name === "Sample");
		assert.deepEqual(record.fields.map(field => field.publicName), fields);
		const generated = copiedPhpPublicSource(model);
		assert.match(generated, /function __construct\(mixed \$natural, mixed \$integer, mixed \$unsignedValues, mixed \$signedValues\)/u);
		for(const name of ["keep_unsigned_values", "keep_signed_values"])
		{
			assert.ok(generated.includes(`function ${name}(`));
			assert.ok(source.includes(`${name}(`));
		}
	}
});

test("npm word validation uses exact wasm32 number ranges without coercion", async () => {
	const files = generateJavaScriptPackage(wordReviewedIr());
	assert.match(files["index.d.ts"], /keepUnsigned\(value0: number\): number/);
	const source = Object.entries(files).find(([path]) => path.endsWith("validators.mjs"))[1];
	const validators = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
	for(const [name, check, valid, invalid] of [
		["usize", validators.assertUsize, [0, 0x80000000, 0xffffffff], [-1, 0x100000000]]
		, ["isize", validators.assertIsize, [-0x80000000, -1, 0, 0x7fffffff], [-0x80000001, 0x80000000]]
	]){
		for(const value of valid)
		{ assert.equal(check(value), value); assert.equal(validateComponentScalar(name, value), value); }
		for(const value of [...invalid, "1", 1n, true, null, undefined, 0.5, NaN, Infinity])
		{
			assert.throws(() => check(value)); assert.throws(() => validateComponentScalar(name, value));
		}
	}
});

const wireFixture = () => {
	const live = new Set(); let next = 64, calls = 0, clears = 0, poisoned = false;
	const module = { HEAP8: new Uint8Array(32768)
		, _malloc: bytes => { const p = next; next += (bytes + 7) & ~7; live.add(p); return p; }
		, _free: p => assert.equal(live.delete(p), true)
		, _bridge_scalar_frame_clear: () => { clears++; } };
	const lifecycle = { assertOpen: () => { if(poisoned) throw new Error("Word runtime is poisoned"); }
		, poison: () => { poisoned = true; } };
	const run = (name, value, bits, flags = 0, status = 0) => callComponentScalar(module, frame => {
		calls++;
		const view = new DataView(module.HEAP8.buffer), tag = componentScalarTypes.indexOf(name);
		assert.equal(view.getUint32(frame + 32, true), tag);
		assert.equal(view.getBigUint64(frame + 40, true), BigInt.asUintN(64, BigInt(value)));
		view.setUint32(frame + 8, status, true);
		view.setUint32(frame + 16, tag, true); view.setUint32(frame + 20, flags, true);
		view.setBigUint64(frame + 24, BigInt.asUintN(64, bits), true); return status;
	}, { parameters: [scalar(name)], result: scalar(name), resultMode: "value" }, [value], lifecycle);
	return { run, state: () => ({ live: live.size, calls, clears, poisoned }) };
};

test("word wire results clean valid replies and reject host inputs without retiring the runtime", () => {
	const { run, state } = wireFixture();
	for(const value of [0, 0x80000000, 0xffffffff]) assert.equal(run("usize", value, BigInt(value)), value);
	for(const value of [-0x80000000, -1, 0, 0x7fffffff]) assert.equal(run("isize", value, BigInt(value)), value);
	assert.throws(() => run("usize", -1, 0n));
	assert.deepEqual(state(), { live: 0, calls: 7, clears: 8, poisoned: false });
	assert.equal(run("usize", 1, 1n), 1);
	assert.deepEqual(state(), { live: 0, calls: 8, clears: 9, poisoned: false });
});

test("word wire results quarantine malformed widths and flags before unsafe cleanup", () => {
	const malformed = [["usize", -1n, 0], ["usize", 0x100000000n, 0]
		, ["isize", 0x80000000n, 0], ["isize", 0xffffffffn, 0]
		, ["isize", -0x80000001n, 0]
		, ["usize", 0n, 1], ["isize", 0n, 1]];
	for(const status of [0, 5]) for(const [name, bits, flags] of malformed)
	{
		const { run, state } = wireFixture();
		assert.throws(() => run(name, 0, bits, flags, status), flags ? /Invalid component [ui]size flags/ : /32 is out of range/);
		assert.deepEqual(state(), { live: 1, calls: 1, clears: 0, poisoned: true });
		assert.throws(() => run(name, 0, 0n), /poisoned/);
		assert.deepEqual(state(), { live: 1, calls: 1, clears: 0, poisoned: true }, "Retired heaps must not allocate, dispatch or clean up");
	}
});

test("word adapters validate the frame and enforce the compiled width", () => {
	const source = generateComponentScalarAdapters({ exports: [{ symbol: "word", parameters: [scalar("usize"), scalar("isize")], result: scalar("isize"), resultMode: "value" }] });
	assert.match(source, /sizeof\(size_t\) == 4/); assert.match(source, /extern size_t word_lean\(size_t, size_t\)/);
	assert.match(source, /bridge_scalar_word_bits\(\) != 32/);
	assert.ok(source.indexOf("bridge_scalar_slot_validate") < source.indexOf("size_t result = word_lean"));
	assert.match(source, /int32_t signed_result; memcpy/);
});

test("checked heap refinements retain inputs for validation and clean rejected calls", () => {
	const abi = { exports: [{
		bindingId: "lean:Library.echoText"
		, symbol: "refined_text"
		, parameters: [scalar("string"), scalar("string")]
		, result: scalar("string")
		, resultMode: "value" }] };
	const exports = [{ bindingId: "lean:Library.echoText"
	, refinements: {
		parameters: [{ kind: "subtype", constructor: "Library.checkedText" }, null]
		, result: null
	} }];
	const source = generateComponentScalarAdapters(abi, exports);
	assert.match(source, /lean_inc\(a0\);\n {2}if \(!refined_text_refinement_0\(a0\)\) \{ lean_dec\(a0\); lean_dec\(a1\); return 6; \}/u);
	assert.ok(source.indexOf("lean_inc(a0)") < source.indexOf("refined_text_refinement_0(a0)"));
	assert.ok(source.indexOf("refined_text_refinement_0(a0)") < source.indexOf("refined_text_lean(a0, a1)"));
});
