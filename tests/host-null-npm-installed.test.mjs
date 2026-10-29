/**
 * Source-free installed HostNull acceptance in every JavaScript/browser profile.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createComponentPrivateAbi } from "../src/build/component-callable-adapters.mjs";
import { checkInstalledScalars } from "./helpers/component-scalar-install.mjs";
import { hostNullArities, hostNullProjection, hostNullReviewedIr } from "./helpers/host-null-fixture.mjs";

const expected = { checks: 39, rejections: 17, positions: 5, nestedOptionDistinct: true };
const shape = ir => {
	const abi = createComponentPrivateAbi(ir);
	return { ...abi
		, types: abi.types.toSorted((left, right) => left.id.localeCompare(right.id))
		, callbacks: abi.callbacks.toSorted((left, right) => left.id.localeCompare(right.id))
		, exports: abi.exports.toSorted((left, right) => left.bindingId.localeCompare(right.bindingId)) };
};

test("installed npm HostNull preserves null and nested Option across all JavaScript/browser positions", { timeout: 1_800_000 }, async t => checkInstalledScalars(t, {
	name: "host-null-demo", module: "HostNullDemo", sourceDir: "host-null"
	, npmSettings: { name: "host-null-demo", version: "1.0.0" }
	, consumer: "host-null-consumers/npm.mjs", check: "checkHostNull"
	, signatures: hostNullReviewedIr().declarations.map(item => ({ name: item.source.declaration }))
	, arities: hostNullArities, hostProjections: [hostNullProjection]
	, reviewedIr: hostNullReviewedIr, removeProducer: true
	, reportDir: "host-null/npm", browserTimeout: 120_000
	, requiredRuntimeSymbol: "bridge_recursive_abi"
	, assertIr: ir => {
		assert.deepEqual(shape(ir), shape(hostNullReviewedIr()));
		assert.doesNotMatch(JSON.stringify(ir), /(?:null|value)Constructor/);
	}
	, assertResult: result => assert.deepEqual(result, expected)
	, typescript: `import * as api from "host-null-demo";
const direct: null | number = api.echo(null);
const nullableOption = api.nullableOption({ tag: "some", value: 42 });
const optionalNullable = api.optionalNullable({ tag: "some", value: null });
const packet: api.Packet = { direct, nullableOption, optionalNullable };
api.packet(packet);
api.callHost(null, value => value === null ? { tag: "none" } : { tag: "some", value });
const closure = api.makeClosure(null);
closure(42); closure[Symbol.dispose]();
if(false) {
  // @ts-expect-error HostNull uses null, never undefined.
  api.echo(undefined);
  // @ts-expect-error Option remains tagged outside HostNull.
  api.optionalNullable(null);
}
`
}));
