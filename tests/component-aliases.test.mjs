/**
 * Installed compiler-authenticated aliases, including bare return types.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { checkInstalledScalars } from "./helpers/component-scalar-install.mjs";
import { aliasReviewedIr, aliasSignatures } from "./helpers/alias-fixture.mjs";

const shape = ir => ({
	declarations: ir.declarations.map(item => ({ id: item.id, parameters: item.parameters.map(p => p.type), result: item.result.type })).sort((a, b) => a.id.localeCompare(b.id))
	, types: ir.types.map(type => ({ id: type.id, kind: type.kind
		, target: type.target
		, fields: type.fields.map(({ name, type }) => ({ name, type }))
		, cases: type.cases.map(item => ({ name: item.name, fields: item.fields.map(({ name, type }) => ({ name, type })) })) })).sort((a, b) => a.id.localeCompare(b.id))
});

test("installed npm aliases preserve names, targets and exact transparent values", { timeout: 600_000 }, async t => checkInstalledScalars(t, {
	name: "aliases", module: "Aliases", sourceDir: "npm-aliases"
	, consumer: "alias-consumers/npm.mjs", signatures: aliasSignatures
	, reviewedIr: aliasReviewedIr, check: "checkAliases", reportDir: "aliases/npm"
	, requiredRuntimeSymbol: "bridge_nominal_abi", browserTimeout: 90_000
	, assertIr: ir => assert.deepEqual(shape(ir), shape(aliasReviewedIr()))
	, assertResult: result => { assert.equal(result.primitives, 19); assert.ok(result.checks > 1000); assert.ok(result.rejections > 30); }
	, typescript: `import * as api from "aliases";
const count: api.Count = api.make();
const result: api.OtherCount = api.increment(count);
if (result !== 42) throw new Error("Alias value mismatch");
const scalarFunction: (value: api.ScalarsView) => api.ScalarsView = api.scalars; void scalarFunction;
const text: api.AText = api.label();
const unit: api.AUnit = undefined;
const nested: api.Maybe = { tag: "some", value: { tag: "some", value: unit } };
const packet: api.PacketView = { count, text, rows: [[count]], maybe: nested, outcome: { ok: [count, new Uint8Array([7])] } };
const packets: api.Packets = api.packets([packet]); void packets;
const mode: api.ModeView = { kind: "second", count }; api.mode(mode);
// @ts-expect-error A UInt32 alias is not a bigint.
const wrong: api.Count = 1n; void wrong;
// @ts-expect-error Alias targets retain the exact record shape.
const missing: api.PacketView = { count }; void missing;
// @ts-expect-error Alias targets retain the closed constructor set.
const bad: api.ModeView = { kind: "third" }; void bad;
`
}));
