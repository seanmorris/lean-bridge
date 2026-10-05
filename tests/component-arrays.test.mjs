/**
 * Both producer paths compiled and installed in all five npm consumer profiles.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { arrayPrimitives, arrayReviewedIr, arraySignatures } from "./helpers/array-fixture.mjs";
import { checkInstalledScalars } from "./helpers/component-scalar-install.mjs";
import { compileComponentCopiedCodec } from "../src/release/component-copied-codec.mjs";

test("real wasm array validation rejects malformed trees and cleans partially encoded output", async () => {
	const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
	const { default: createMain } = await import(pathToFileURL(join(runtimeRoot, "main.mjs")));
	const module = await createMain({ locateFile: path => join(runtimeRoot, path) });
	assert.equal(module._bridge_lean_runtime_init(), 1);
	assert.equal(module._bridge_copied_abi(), 1);
	// Lean's bounds-checked array reads import boxed Init defaults via GOT.mem.
	assert.ok(Number.isInteger(module._l_instInhabitedUInt16) && module._l_instInhabitedUInt16 > 0);
	const pointers = [], allocate = bytes => { const pointer = module._malloc(Math.max(1, bytes)); pointers.push(pointer); return pointer; };
	const frame = allocate(32), slot = allocate(16), budget = allocate(8);
	const view = () => new DataView(module.HEAP8.buffer);
	const type = { kind: "apply", constructor: "array", arguments: [{ kind: "primitive", name: "string" }] };
	const codec = compileComponentCopiedCodec(type);
	try
	{
		module.HEAP8.fill(0, frame, frame + 32);
		view().setUint32(frame, 4, true); view().setUint32(frame + 4, 32, true);
		assert.equal(module._bridge_copied_frame_validate(frame, 0), 0);
		view().setUint32(frame, 2, true); assert.equal(module._bridge_copied_frame_validate(frame, 0), 1);
		codec.write(module, slot, ["first", "second"], allocate);
		const children = view().getUint32(slot + 8, true), payload = view().getUint32(children + 8, true);
		const original = [[slot, 16], [children, 32], [payload, 5]].map(([pointer, size]) => [pointer, module.HEAP8.slice(pointer, pointer + size)]);
		const restore = () => { for(const [pointer, bytes] of original) module.HEAP8.set(bytes, pointer); };
		const validate = (kind = 14, depth = 1) => {
			view().setUint32(budget, 16 * 1024 * 1024, true);
			return module._bridge_copied_validate(slot, kind, depth, budget);
		};
		assert.equal(validate(), 0);
		for(const mutate of [
			() => view().setUint32(slot, 33, true)
			, () => view().setUint32(slot + 4, 2, true)
			, () => view().setUint32(slot + 8, 0, true)
			, () => view().setUint32(slot + 8, children + 1, true)
			, () => view().setUint32(slot + 12, 0xffffffff, true)
			, () => view().setUint32(children + 4, 2, true)
			, () => view().setUint32(children + 8, 0, true)
			, () => { module.HEAP8[payload] = 0xc0; }
			, () => { module.HEAP8.set([0xed, 0xa0, 0x80], payload); }
			, () => { module.HEAP8.set([0xf4, 0x90, 0x80, 0x80], payload); }
			, () => { module.HEAP8[payload + 4] = 0xc2; }
		]){
			restore(); mutate(); assert.notEqual(validate(), 0);
		}
		restore();
		assert.notEqual(validate(14, 33), 0);
		assert.notEqual(validate(19, 1), 0);
		view().setUint32(budget, 16, true);
		assert.equal(module._bridge_copied_validate(slot, 14, 1, budget), 4);
		// Fail after the parent table and first child's UTF-8 allocation exist.
		for(let i = 0; i < 500; i++)
		{
			const value = module._bridge_copied_decode(slot, 14, 1);
			view().setUint32(budget, 55, true);
			assert.equal(module._bridge_copied_encode(frame + 16, 14, 1, value, budget), 4);
			assert.deepEqual([...module.HEAP8.slice(frame + 16, frame + 32)], Array(16).fill(0));
			module._bridge_copied_frame_clear(frame);
		}
		const value = module._bridge_copied_decode(slot, 14, 1);
		view().setUint32(budget, 4096, true);
		assert.equal(module._bridge_copied_encode(frame + 16, 14, 1, value, budget), 0);
		assert.deepEqual(codec.read(module, frame + 16), ["first", "second"]);
		module._bridge_copied_frame_clear(frame);
		module._bridge_copied_frame_clear(frame);
	}
	finally
	{ for(const pointer of pointers.reverse()) module._free(pointer); }
});

const typed = arrayPrimitives.map(([name, type]) => {
	const host = type === "unit" ? "void" : type === "bool" ? "boolean" : ["string", "char"].includes(type) ? "string"
		: type === "bytes" ? "Uint8Array" : ["uint64", "int64", "nat", "int"].includes(type) ? "bigint" : "number";
	return `const ${name}: ReadonlyArray<ReadonlyArray<${host}>> = api.reverse${name}([]); void ${name};`;
}).join("\n");

test("installed npm arrays preserve nineteen primitives and nested copies in every JS context", { timeout: 600_000 }, async t => checkInstalledScalars(t, {
	name: "arrays"
	, module: "Arrays"
	, sourceDir: "npm-arrays"
	, consumer: "array-consumers/npm.mjs"
	, signatures: arraySignatures, reviewedIr: arrayReviewedIr
	, check: "checkArrays", reportDir: "arrays/npm", browserTimeout: 90_000
	, requiredRuntimeSymbol: "bridge_copied_decode"
	, assertIr: ir => {
		const shape = type => type.kind === "primitive" ? type.name : { array: shape(type.arguments[0]) };
		assert.deepEqual(ir.declarations.map(d => ({ name: d.source.declaration, parameters: d.parameters.map(p => shape(p.type)), result: shape(d.result.type) })).sort((a, b) => a.name.localeCompare(b.name)), arraySignatures.toSorted((a, b) => a.name.localeCompare(b.name)));
	}
	, assertResult: result => { assert.equal(result.primitives, 19); assert.ok(result.checks > 1000); }
	, typescript: `import * as api from "arrays";
${typed}
// @ts-expect-error Nested Nat values require bigint, not number.
const wrong: (values: number[][]) => ReadonlyArray<ReadonlyArray<bigint>> = api.reverseNat;
// @ts-expect-error ByteArray is Uint8Array, not an ordinary number array.
const wrongBytes: (values: number[][][]) => unknown = api.reverseBytes;
void wrong; void wrongBytes;
if (api.total([[1n << 100n], [2n]]) !== (1n << 100n) + 2n) throw new Error("Nested TypeScript execution mismatch");
`
}));
