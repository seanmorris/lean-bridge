/**
 * Real compiled ordinary/reviewed records installed in npm consumer contexts.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { compileComponentCopiedCodec } from "../src/release/component-copied-codec.mjs";
import { checkInstalledScalars } from "./helpers/component-scalar-install.mjs";
import { recordReviewedIr, recordSignatures } from "./helpers/record-fixture.mjs";

test("native record helpers reject malformed tables and clear partial nested output", async () => {
	const root = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
	const { default: createMain } = await import(pathToFileURL(join(root, "main.mjs")));
	const module = await createMain({ locateFile: path => join(root, path) });
	assert.equal(module._bridge_lean_runtime_init(), 1); assert.equal(module._bridge_record_abi(), 1);
	const pointers = [], allocate = size => { const pointer = module._malloc(Math.max(1, size)); pointers.push(pointer); return pointer; };
	const slot = allocate(16), result = allocate(32), budget = allocate(8);
	const view = () => new DataView(module.HEAP8.buffer);
	const type = { kind: "record", id: "lean:Raw", fields: [{ name: "text", type: { kind: "primitive", name: "string" } }] };
	try
	{
		module.HEAP8.fill(0, result, result + 32);
		view().setUint32(result, 5, true); view().setUint32(result + 4, 32, true);
		assert.equal(module._bridge_record_frame_validate(result, 0), 0);
		view().setUint32(result, 4, true); assert.equal(module._bridge_record_frame_validate(result, 0), 1);
		compileComponentCopiedCodec(type).write(module, slot, { text: "abc" }, allocate);
		const saved = module.HEAP8.slice(slot, slot + 16);
		const validate = (kind = 36, count = 1) => {
			view().setUint32(budget, 4096, true);
			return module._bridge_record_children_validate(slot, kind, count, budget);
		};
		assert.equal(validate(), 0); assert.notEqual(validate(32), 0); assert.notEqual(validate(36, 2), 0);
		for(const [offset, value] of [[0, 32], [4, 2], [8, 1], [8, 0], [12, 0xffffffff]])
		{
			module.HEAP8.set(saved, slot); view().setUint32(slot + offset, value, true); assert.notEqual(validate(), 0);
		}
		module.HEAP8.set(saved, slot);
		view().setUint32(budget, 15, true); assert.equal(module._bridge_record_children_validate(slot, 36, 1, budget), 4);
		const input = view().getUint32(slot + 8, true);
		for(let i = 0; i < 500; i++)
		{
			view().setUint32(budget, 1024, true);
			assert.equal(module._bridge_record_children_allocate(result, 36, 2, budget), 0);
			const fields = view().getUint32(result + 8, true);
			assert.equal(module._bridge_record_encode_leaf(fields, 14, module._bridge_copied_decode(input, 14, 0), budget), 0);
			assert.equal(module._bridge_record_children_allocate(fields + 16, 32, 2, budget), 0);
			const items = view().getUint32(fields + 24, true);
			assert.equal(module._bridge_record_encode_leaf(items, 14, module._bridge_copied_decode(input, 14, 0), budget), 0);
			view().setUint32(budget, 1, true);
			assert.equal(module._bridge_record_encode_leaf(items + 16, 14, module._bridge_copied_decode(input, 14, 0), budget), 4);
			module._bridge_record_slot_clear(result); module._bridge_record_slot_clear(result);
			assert.deepEqual([...module.HEAP8.slice(result, result + 16)], Array(16).fill(0));
		}
		view().setUint32(budget, 64, true);
		assert.equal(module._bridge_record_children_allocate(result, 36, 5, budget), 4);
		assert.equal(view().getUint32(result + 8, true), 0);
		assert.equal(module._bridge_record_children_allocate(result, 36, 0, budget), 0);
		assert.deepEqual(compileComponentCopiedCodec({ kind: "record", id: "lean:Empty", fields: [] }).read(module, result), {});
		module._bridge_record_slot_clear(result);
	}
	finally
	{ for(const pointer of pointers.reverse()) module._free(pointer); }
});

test("installed npm records preserve primitive fields and nested nominal values", { timeout: 600_000 }, async t => checkInstalledScalars(t, {
	name: "records", module: "Records", sourceDir: "npm-records"
	, consumer: "record-consumers/npm.mjs", signatures: recordSignatures
	, reviewedIr: recordReviewedIr, check: "checkRecords", reportDir: "records/npm"
	, requiredRuntimeSymbol: "bridge_record_abi", browserTimeout: 90_000
	, assertIr: ir => {
		const review = recordReviewedIr();
		const signatures = doc => doc.declarations.map(d => ({ name: d.source.declaration, parameters: d.parameters.map(p => p.type), result: d.result.type })).sort((a, b) => a.name.localeCompare(b.name));
		const records = doc => doc.types.map(type => ({ id: type.id, fields: type.fields.map(field => ({ name: field.name, type: field.type })) })).sort((a, b) => a.id.localeCompare(b.id));
		assert.deepEqual(signatures(ir), signatures(review)); assert.deepEqual(records(ir), records(review));
	}
	, assertResult: result => { assert.equal(result.primitives, 19); assert.equal(result.records, 7); assert.ok(result.checks > 3000); }
	, typescript: `import * as api from "records";
const pair: api.Pair = api.make();
const packet: api.Packet = { label: "typed", values: [], empty: {}, single: { value: 5n }, count: { value: 100n }, pair, reversed: { second: "r", first: 2 } };
const result: api.Packet = api.shuffle(packet);
const rows: ReadonlyArray<ReadonlyArray<api.Primitives>> = result.values; void rows;
const checkFields = (value: api.Primitives): { readonly unit: void; readonly flag: boolean; readonly u8: number; readonly u16: number; readonly u32: number; readonly u64: bigint; readonly i8: number; readonly i16: number; readonly i32: number; readonly i64: bigint; readonly natural: bigint; readonly integer: bigint; readonly f32: number; readonly f64: number; readonly text: string; readonly bytes: Uint8Array; readonly char: string; readonly usize: number; readonly isize: number } => value; void checkFields;
if (result.single.value !== 6n || result.count.value !== 107n || result.reversed.first !== 4) throw new Error("Record TypeScript execution mismatch");
// @ts-expect-error UInt64 fields require bigint.
const wrong: (value: { value: number }) => api.Single = api.single; void wrong;
// @ts-expect-error Required record fields cannot be omitted.
const missing: api.Pair = { first: 1 }; void missing;
`
}));
