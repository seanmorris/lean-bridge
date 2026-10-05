/**
 * Keep callable-result lifetime decisions relative to each callable signature.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { validateExportConfiguration, exportContractProblem } from "../src/analyze/export-configuration.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";

const borrow = { ownership: "borrow", lifetime: { scope: "call", anchor: null } };
const lease = { ownership: "lease", lifetime: { scope: "explicit", anchor: null } };
const copy = { ownership: "copy", lifetime: null };
const anchor = index => ({ ownership: "borrow", lifetime: { scope: "parameter", anchor: `arg${index}` } });
const wrap = site => ({ schemaVersion: 1, contracts: { "Library.run": { parameters: [site] } } });
const resource = { kind: "resource" }, scalar = { kind: "primitive", name: "uint32" };
const callable = { kind: "callback", parameters: [scalar, resource], result: resource };
const projection = { status: "supported", parameters: [{ type: callable }], result: resource };

test("callable decisions and their schema preserve ordered local parameter anchors", async () => {
	for(const site of [
		{ ...borrow, callable: { result: anchor(1) } }
		, { ...borrow, callable: { parameters: [copy, borrow], result: anchor(1) } }
		, { ...borrow, callable: { parameters: [{ ...borrow, callable: { result: anchor(0) } }], result: anchor(0) } }
		, { ...lease, callable: { result: lease } }
	]) {
		const value = wrap(site);
		assert.equal(validateExportConfiguration(value), value);
		await assertJsonSchema("lean-export-configuration", value);
	}
	for(const callable of [null, [], {}, { result: anchor(0), receiver: "method" }
		, { parameters: Array(17).fill(borrow) }
		, { result: { ...copy, type: "UInt32" } }
		, { result: { ...borrow, lifetime: { scope: "parameter", anchor: "arg01" } } }
		, { result: { ...borrow, lifetime: { scope: "parameter", anchor: "arg0\n" } } }
	]) {
		const value = wrap({ ...borrow, callable });
		assert.throws(() => validateExportConfiguration(value), { code: "invalid-export-configuration" });
		await assert.rejects(() => assertJsonSchema("lean-export-configuration", value));
	}
	assert.throws(() => validateExportConfiguration(wrap({ ...borrow, callable: { parameters: [borrow], result: anchor(1) } })), /outside its parameters/u);
});

test("callable-result contracts reject copied, missing and outer receiver anchors", () => {
	const contract = result => ({ parameters: [{ ...borrow, callable: { result } }] });
	assert.equal(exportContractProblem(contract(anchor(1)), projection, true), null);
	assert.match(exportContractProblem(contract(anchor(0)), projection, true), /retained identity or aggregate anchor/u);
	assert.match(exportContractProblem(contract(anchor(2)), projection, true), /retained identity or aggregate anchor/u);
	assert.match(exportContractProblem(contract(anchor(1)), projection, false), /ownership or lifetime/u);
	assert.match(exportContractProblem(contract({ ownership: "borrow", lifetime: { scope: "receiver", anchor: "receiver" } }), projection, true), /retained identity or aggregate anchor/u);
	assert.match(exportContractProblem(contract(anchor(1)), { ...projection, parameters: [{ type: scalar }] }, true), /compiler-checked callback/u);
	assert.match(exportContractProblem(contract(anchor(1)), { ...projection, parameters: [{ type: { ...callable, result: scalar } }] }, true), /ownership or lifetime/u);
	assert.match(exportContractProblem({ parameters: [{ ...borrow, callable: { parameters: [copy, { ownership: "transfer", lifetime: { scope: "call", anchor: null } }], result: anchor(1) } }] }, projection, true), /call-scoped borrows/u);
	assert.match(exportContractProblem({ parameters: [{ ...borrow, callable: { parameters: [], result: lease } }] }, projection, true), /exact runtime argument count/u);
});

test("returned and nested closures use their own parameter numbering", () => {
	const contract = { parameters: [copy], result: { ...lease, callable: { result: anchor(1) } } };
	assert.equal(exportContractProblem(contract, { status: "supported", parameters: [{ type: scalar }], result: callable }, true), null);
	const nested = { ...callable, parameters: [callable] };
	const site = { ...borrow, callable: { parameters: [{ ...borrow, callable: { result: anchor(1) } }], result: anchor(0) } };
	assert.equal(exportContractProblem({ parameters: [site] }, { ...projection, parameters: [{ type: nested }] }, true), null);
	const changed = structuredClone(site); changed.callable.parameters[0].callable.result = anchor(0);
	assert.match(exportContractProblem({ parameters: [changed] }, { ...projection, parameters: [{ type: nested }] }, true), /arg0\.callable: arg0\.callable: result/u);
});
