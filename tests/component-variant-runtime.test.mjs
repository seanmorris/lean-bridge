/**
 * Exercise actual Wasm variant validation, owned allocation and partial cleanup.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { compileComponentCopiedCodec } from "../src/release/component-copied-codec.mjs";

test("native variant helpers preserve ordinals and reject invalid ownership and spans", async () => {
	const root = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
	const { default: createMain } = await import(pathToFileURL(join(root, "main.mjs")));
	const module = await createMain({ locateFile: path => join(root, path) });
	assert.equal(module._bridge_lean_runtime_init(), 1); assert.equal(module._bridge_nominal_abi(), 1);
	const pointers = [], allocate = size => {
		const pointer = module._malloc(Math.max(1, size)); assert.ok(pointer); pointers.push(pointer); return pointer;
	};
	const slot = allocate(16), frame = allocate(32), budget = allocate(8), table = allocate(16), text = allocate(16);
	const view = () => new DataView(module.HEAP8.buffer);
	const resetBudget = value => view().setUint32(budget, value, true);
	try
	{
		module.HEAP8.fill(0, frame, frame + 32); view().setUint32(frame + 4, 32, true);
		for(const version of [4, 5, 6, 7])
		{ view().setUint32(frame, version, true); assert.equal(module._bridge_nominal_frame_validate(frame, 0), version === 7 ? 0 : 1); }
		for(const branch of [0, 1, 3, 1023])
		{
			for(const count of [0, 1])
			{
				module.HEAP8.fill(0, slot, slot + 16);
				view().setUint32(slot, 37, true); view().setUint32(slot + 4, branch << 2, true);
				view().setUint32(slot + 8, count ? table : 0, true); view().setUint32(slot + 12, count, true);
				const saved = module.HEAP8.slice(slot, slot + 16);
				const validate = () => { resetBudget(4096); return module._bridge_nominal_children_validate(slot, 37, count, budget); };
				assert.equal(validate(), 0);
				for(const [offset, bad] of [[0, 36], [4, (branch << 2) | 1], [4, (branch << 2) | 2], [4, 1024 << 2], [8, 1], [12, 1025]])
				{
					module.HEAP8.set(saved, slot); view().setUint32(slot + offset, bad, true); assert.equal(validate(), 3);
				}
				module.HEAP8.set(saved, slot); resetBudget(15);
				assert.equal(module._bridge_nominal_children_validate(slot, 37, count, budget), 4);
				resetBudget(4096); assert.equal(module._bridge_compound_children_validate(slot, 37, count, budget), 3);
			}
		}
		const wide = { kind: "variant", id: "lean:Probe.Wide", cases: Array.from({ length: 1024 }, (_, index) => ({ name: `v${index}`, fields: [] })) };
		for(const branch of [0, 3, 1023])
		{
			resetBudget(4096); assert.equal(module._bridge_nominal_children_allocate(slot, 37, 0, branch, budget), 0);
			assert.deepEqual(compileComponentCopiedCodec(wide).read(module, slot), { kind: `v${branch}` });
			module._bridge_record_slot_clear(slot);
		}
		for(const [count, branch] of [[1025, 0], [0, 1024], [1, 0xffffffff]])
		{
			resetBudget(4096); assert.equal(module._bridge_nominal_children_allocate(slot, 37, count, branch, budget), 6);
			assert.deepEqual([...module.HEAP8.slice(slot, slot + 16)], Array(16).fill(0));
		}
		compileComponentCopiedCodec({ kind: "primitive", name: "string" }).write(module, text, "partial 🌱", allocate);
		for(let repetition = 0; repetition < 500; repetition++)
		{
			resetBudget(4096); assert.equal(module._bridge_nominal_children_allocate(slot, 37, 2, 3, budget), 0);
			const children = view().getUint32(slot + 8, true);
			assert.equal(module._bridge_nominal_children_allocate(children, 37, 1, 1, budget), 0);
			const field = view().getUint32(children + 8, true);
			assert.equal(module._bridge_record_encode_leaf(field, 14, module._bridge_copied_decode(text, 14, 0), budget), 0);
			assert.equal(module._bridge_nominal_children_allocate(children + 16, 37, 1, 2, budget), 0);
			const last = view().getUint32(children + 24, true); resetBudget(1);
			assert.equal(module._bridge_record_encode_leaf(last, 14, module._bridge_copied_decode(text, 14, 0), budget), 4);
			module._bridge_record_slot_clear(slot); module._bridge_record_slot_clear(slot);
			assert.deepEqual([...module.HEAP8.slice(slot, slot + 16)], Array(16).fill(0));
		}
		resetBudget(15); assert.equal(module._bridge_nominal_children_allocate(slot, 37, 1, 0, budget), 4);
		assert.equal(view().getBigUint64(slot + 8, true), 0n);
	}
	finally
	{ for(const pointer of pointers.reverse()) module._free(pointer); }
});
