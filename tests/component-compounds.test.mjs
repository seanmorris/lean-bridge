/**
 * Install compiler-authenticated Option, Except and nested product packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { compileComponentCopiedCodec } from "../src/release/component-copied-codec.mjs";
import { compoundReviewedIr, compoundSignatures } from "./helpers/compound-source-fixture.mjs";
import { corpusReviewedIr } from "./helpers/type-corpus-reviewed-ir.mjs";
import { checkInstalledScalars } from "./helpers/component-scalar-install.mjs";

test("native compound helpers reject bad branches and clear partial nested output", async () => {
	const root = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
	const { default: createMain } = await import(pathToFileURL(join(root, "main.mjs")));
	const module = await createMain({ locateFile: path => join(root, path) });
	assert.equal(module._bridge_lean_runtime_init(), 1); assert.equal(module._bridge_compound_abi(), 1);
	const pointers = [], allocate = size => { const pointer = module._malloc(Math.max(1, size)); pointers.push(pointer); return pointer; };
	const slot = allocate(16), result = allocate(32), budget = allocate(8);
	const view = () => new DataView(module.HEAP8.buffer);
	try
	{
		module.HEAP8.fill(0, result, result + 32);
		view().setUint32(result + 4, 32, true);
		for(const version of [4, 5, 6])
		{ view().setUint32(result, version, true); assert.equal(module._bridge_compound_frame_validate(result, 0), version === 6 ? 0 : 1); }
		module.HEAP8.fill(0, result, result + 32);
		const apply = (constructor, ...args) => ({ kind: "apply", constructor, arguments: args });
		const unit = { kind: "primitive", name: "unit" }, string = { kind: "primitive", name: "string" };
		const cases = [[apply("option", unit), { tag: "none" }, 34, 0]
			, [apply("option", unit), { tag: "some", value: undefined }, 34, 1]
			, [apply("result", unit, string), { ok: undefined }, 35, 1]
			, [apply("result", unit, string), { error: "🌱" }, 35, 1]
			, [apply("tuple", unit, string), [undefined, "x"], 33, 2]];
		for(const [type, value, kind, count] of cases)
		{
			compileComponentCopiedCodec(type).write(module, slot, value, allocate);
			const saved = module.HEAP8.slice(slot, slot + 16);
			const validate = () => { view().setUint32(budget, 4096, true); return module._bridge_compound_children_validate(slot, kind, count, budget); };
			assert.equal(validate(), 0);
			for(const [offset, bad] of [[0, 36], [4, 2], [4, 3], [8, 1], [12, 0xffffffff]])
			{
				module.HEAP8.set(saved, slot); view().setUint32(slot + offset, bad, true); assert.notEqual(validate(), 0);
			}
			module.HEAP8.set(saved, slot);
			view().setUint32(budget, 15, true); assert.equal(module._bridge_compound_children_validate(slot, kind, count, budget), 4);
			assert.notEqual(module._bridge_record_children_validate(slot, kind, count, budget), 0);
		}
		compileComponentCopiedCodec(string).write(module, slot, "abc", allocate);
		for(let i = 0; i < 500; i++)
		{
			view().setUint32(budget, 1024, true);
			assert.equal(module._bridge_compound_children_allocate(result, 33, 2, 0, budget), 0);
			const fields = view().getUint32(result + 8, true);
			assert.equal(module._bridge_compound_children_allocate(fields, 34, 1, 1, budget), 0);
			const payload = view().getUint32(fields + 8, true);
			assert.equal(module._bridge_record_encode_leaf(payload, 14, module._bridge_copied_decode(slot, 14, 0), budget), 0);
			assert.equal(module._bridge_compound_children_allocate(fields + 16, 35, 1, 1, budget), 0);
			const error = view().getUint32(fields + 24, true);
			view().setUint32(budget, 1, true);
			assert.equal(module._bridge_record_encode_leaf(error, 14, module._bridge_copied_decode(slot, 14, 0), budget), 4);
			module._bridge_record_slot_clear(result); module._bridge_record_slot_clear(result);
			assert.deepEqual([...module.HEAP8.slice(result, result + 16)], Array(16).fill(0));
		}
		view().setUint32(budget, 31, true);
		assert.equal(module._bridge_compound_children_allocate(result, 33, 2, 0, budget), 4);
		assert.equal(view().getUint32(result + 8, true), 0);
		for(const [kind, count, branch] of [[33, 3, 0], [33, 2, 1], [34, 0, 1], [34, 1, 0], [35, 2, 0], [35, 1, 2]])
			assert.equal(module._bridge_compound_children_allocate(result, kind, count, branch, budget), 6);
		assert.equal(module._bridge_compound_children_allocate(result, 34, 0, 0, budget), 0);
		assert.deepEqual(compileComponentCopiedCodec(apply("option", unit)).read(module, result), { tag: "none" });
		module._bridge_record_slot_clear(result);
	}
	finally
	{ for(const pointer of pointers.reverse()) module._free(pointer); }
});

test("installed npm compounds preserve branches, product nesting and mixed fields", { timeout: 600_000 }, async t => checkInstalledScalars(t, {
	name: "compounds", module: "Compounds", sourceDir: "npm-compounds"
	, consumer: "compound-consumers/npm.mjs", signatures: compoundSignatures
	, reviewedIr: compoundReviewedIr, check: "checkCompounds"
	, reportDir: "compounds/npm"
	, requiredRuntimeSymbol: "bridge_compound_abi"
	, browserTimeout: 90_000
	, assertIr: ir => {
		const signature = d => ({ name: d.source.declaration, parameters: d.parameters.map(p => p.type), result: d.result.type });
		const sort = values => values.sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(ir.declarations.map(signature)), sort(compoundReviewedIr().declarations.map(signature)));
		assert.deepEqual(ir.types.map(type => type.fields.map(field => ({ name: field.name, type: field.type }))), compoundReviewedIr().types.map(type => type.fields.map(field => ({ name: field.name, type: field.type }))));
	}
	, assertResult: result => { assert.equal(result.primitives, 19); assert.equal(result.constructors, 3); assert.ok(result.checks > 3000); }
	, typescript: `import * as api from "compounds";
const value = api.option_unit({ tag: "some", value: undefined });
if (value.tag !== "some" || value.value !== undefined) throw new Error("Some Unit erased");
const nested = api.next({ tag: "some", value: { tag: "none" } });
if (nested.tag !== "some" || nested.value.tag !== "some") throw new Error("Nested Option erased");
const result = api.flip({ ok: [42, { tag: "some", value: undefined }] });
if (!("error" in result) || result.error[0] !== 42) throw new Error("Except argument order reversed");
const pair: readonly [bigint, bigint] = api.tuple_uint64([0n, 1n]); void pair;
// @ts-expect-error none is tagged, not null.
const wrongOption: (value: null) => unknown = api.option_unit; void wrongOption;
// @ts-expect-error Some Unit still requires its payload property.
const missing: Parameters<typeof api.option_unit>[0] = { tag: "some" }; void missing;
// @ts-expect-error The nested product is not a flat three-element tuple.
const wrongTuple: api.Packet["products"] = [1, "x", [true, "a"]]; void wrongTuple;
// @ts-expect-error UInt64 requires bigint inside the success branch and tuple.
const wrongResult: ReturnType<typeof api.make> = { tag: "some", value: { ok: [1, undefined] } }; void wrongResult;
`
}));

test("recordless compounds compile and install without a nominal type table", { timeout: 600_000 }, async t => {
	const signatures = compoundSignatures.filter(item => ["Compounds.classify", "Compounds.next"].includes(item.name));
	return checkInstalledScalars(t, {
		name: "compounds", module: "Compounds", sourceDir: "npm-compounds"
		, signatures
		, consumer: "compound-consumers/npm.mjs", check: "checkRecordless"
		, reportDir: "compounds/recordless"
		, reviewedIr: () => corpusReviewedIr({ id: "compounds" }, signatures)
		, assertIr: ir => { assert.equal(ir.types.length, 0); assert.equal(ir.declarations.length, 2); }
		, assertResult: result => assert.deepEqual(result, { checks: 3 })
		, typescript: `import * as api from "compounds";
const next = api.next({ tag: "some", value: { tag: "none" } });
if (next.tag !== "some" || next.value.tag !== "some" || api.classify(next) !== 2) throw new Error("Recordless compound mismatch");
`
	});
});
