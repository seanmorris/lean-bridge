/**
 * Installed List execution through both ordinary source and independent review.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { checkInstalledScalars } from "./helpers/component-scalar-install.mjs";
import { listReviewedIr, listSignatures } from "./helpers/list-fixture.mjs";

test("installed npm Lists preserve sequence order, exact leaves and nested copied values", { timeout: 600_000 }, async t => checkInstalledScalars(t, {
	name: "lists", module: "Lists", sourceDir: "npm-lists"
	, consumer: "list-consumers/npm.mjs", signatures: listSignatures
	, reviewedIr: listReviewedIr, check: "checkLists"
	, reportDir: "lists/npm", requiredRuntimeSymbol: "bridge_compound_abi"
	, browserTimeout: 90_000
	, assertIr: ir => {
		const signature = d => ({ name: d.source.declaration, parameters: d.parameters.map(p => p.type), result: d.result.type });
		const sort = values => values.sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(ir.declarations.map(signature)), sort(listReviewedIr().declarations.map(signature)));
		assert.deepEqual(ir.types.map(type => type.fields.map(field => ({ name: field.name, type: field.type }))), listReviewedIr().types.map(type => type.fields.map(field => ({ name: field.name, type: field.type }))));
	}
	, assertResult: result => { assert.equal(result.primitives, 19); assert.ok(result.checks > 25_000); assert.ok(result.rejections >= 25); }
	, typescript: `import * as api from "lists";
const input: ReadonlyArray<bigint> = [0n, 0xffffffffffffffffn];
const result: ReadonlyArray<bigint> = api.reverse_uint64(input);
if (result[0] !== input[1]) throw new Error("List order changed");
const mixed: ReadonlyArray<ReadonlyArray<number>> = api.mix([[1, 2], []]);
if (mixed[1][0] !== 2) throw new Error("List/Array nesting changed");
const unit: ReadonlyArray<void> = api.reverse_unit([undefined]); void unit;
const packet: api.Packet = { sequences: [[1]], branches: [{ tag: "some", value: { ok: [1n, undefined] } }], buffers: [], arrays: [] };
api.transform(packet);
// @ts-expect-error UInt64 keeps bigint elements inside a List.
const wrong: Parameters<typeof api.reverse_uint64>[0] = [1]; void wrong;
// @ts-expect-error List is an ordered Array, not a typed array.
const typed: Parameters<typeof api.reverse_uint32>[0] = new Uint32Array([1]); void typed;
// @ts-expect-error Lists preserve every nesting level.
const flat: api.Packet["sequences"] = [1, 2]; void flat;
`
}));
