/**
 * Installed compiler-backed variants on both source paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { checkInstalledScalars } from "./helpers/component-scalar-install.mjs";
import { variantReviewedIr, variantSignatures } from "./helpers/variant-fixture.mjs";

const shape = ir => {
	const fields = values => values.map(field => ({ name: field.name, type: field.type }));
	return {
		declarations: ir.declarations.map(item => ({ id: item.id, parameters: item.parameters.map(p => p.type), result: item.result.type })).sort((a, b) => a.id.localeCompare(b.id))
		, types: ir.types.map(type => ({ id: type.id, kind: type.kind, target: type.target, fields: fields(type.fields), cases: type.cases.map(item => ({ name: item.name, fields: fields(item.fields) })) })).sort((a, b) => a.id.localeCompare(b.id))
	};
};

test("installed npm variants preserve constructor identity and typed copied payloads", { timeout: 600_000 }, async t => checkInstalledScalars(t, {
	name: "variants", module: "Variants", sourceDir: "npm-variants"
	, consumer: "variant-consumers/npm.mjs", signatures: variantSignatures
	, reviewedIr: variantReviewedIr, check: "checkVariants"
	, reportDir: "variants/npm"
	, requiredRuntimeSymbol: "bridge_nominal_abi", browserTimeout: 90_000
	, assertIr: ir => assert.deepEqual(shape(ir), shape(variantReviewedIr()))
	, assertResult: result => { assert.equal(result.primitives, 19); assert.ok(result.checks > 2000); assert.ok(result.rejections > 30); }
	, typescript: `import * as api from "variants";
const input: api.Signal = { kind: "data", count: 41, label: "test" };
const result = api.next(input);
if (result.kind !== "data" || result.count !== 42) throw new Error("Variant mismatch");
const packet: api.Nested = { kind: "packet", value: { current: { kind: "idle" }, events: [{ kind: "marker", value: undefined }], fallback: { tag: "none" }, modes: [{ kind: "first" }] } };
api.nested(packet);
const buffers = api.duplicate(new Uint8Array([7]));
if (buffers.kind !== "pair" || buffers.first[0] !== 7) throw new Error("Buffer variant mismatch");
// @ts-expect-error Nullary constructors have no payload.
const extra: api.Signal = { kind: "idle", value: undefined }; void extra;
// @ts-expect-error An explicit Unit field is required.
const missing: api.Signal = { kind: "marker" }; void missing;
// @ts-expect-error Constructor fields retain primitive types.
const wrong: api.Signal = { kind: "data", count: 1n, label: "test" }; void wrong;
// @ts-expect-error Constructor names form a closed union.
const unknown: api.Mode = { kind: "fourth" }; void unknown;
`
}));
