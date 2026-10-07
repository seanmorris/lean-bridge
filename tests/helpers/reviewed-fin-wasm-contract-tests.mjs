/**
 * The Fin-only contract and shared consumer cannot borrow checks from Subtype or the harness.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference, reviewedSourceSelection, validateReviewedSource } from "../../src/analyze/reviewed-source.mjs";
import { reviewedFinWasmIr, reviewedFinWasmWide } from "./reviewed-fin-wasm-fixture.mjs";
import { executeCorpus } from "../fixtures/reviewed-fin-wasm/javascript.mjs";

const input = document => {
	const source = canonicalJson(document);
	return { schemaVersion: 1, path: "api.binding-ir.json", source
		, sourceSha256: sha256(source), semanticSha256: hashBindingIr(document) };
};

test("the independent reviewed Wasm Fin selections keep scalar and structural signatures separate", () => {
	for(const selection of ["scalar", "structural"])
	{
		const document = reviewedFinWasmIr(selection), review = input(document);
		validateReviewedSource(review);
		assert.equal(document.declarations.length, selection === "scalar" ? 6 : 9);
		assert.deepEqual(reviewedSourceSelection(review).exports, document.declarations.map(item => item.source.declaration).sort());
		assert.deepEqual(reviewedSourceSelection(review).arities, []);
		assert.deepEqual(document.types, [], "bare Fin aliases fold into their uses");
		assert.ok(!review.source.includes('"kind":"subtype"'));
		const declaration = name => document.declarations.find(item => item.name === name);
		const refinements = name => declaration(name).source.extensions["lean-lang.org/refinements"];
		assert.deepEqual(refinements("never"), { parameters: [{ kind: "fin", bound: "0" }], result: null });
		assert.deepEqual(refinements("only"), { parameters: [{ kind: "fin", bound: "1" }], result: null });
		assert.equal(refinements("huge").parameters[0].bound, reviewedFinWasmWide);
		assert.equal(refinements("huge").result.bound, reviewedFinWasmWide);
		assert.deepEqual(refinements("tenth"), { parameters: [null], result: { kind: "fin", bound: "10" } });
		if(selection === "structural")
		{
			const tree = refinements("nested").parameters[0];
			assert.equal(tree.kind, "list");
			assert.equal(tree.arguments[0].kind, "option");
			assert.equal(tree.arguments[0].arguments[0].kind, "tuple");
			assert.deepEqual(tree.arguments[0].arguments[0].arguments[1], {
				kind: "result"
				, arguments: [{ kind: "fin", bound: "5" }, { kind: "fin", bound: "2" }]
			});
		}
		const changed = reviewedFinWasmIr(selection);
		changed.declarations.find(item => item.name === "huge").source.extensions["lean-lang.org/refinements"].parameters[0].bound = "10";
		assert.match(reviewedContractDifference(changed, document), /source\.extensions\.lean-lang\.org\/refinements/u);
	}
	assert.throws(() => reviewedFinWasmIr("all"), /Unknown reviewed Wasm Fin selection/u);
	const modified = reviewedFinWasmIr("scalar");
	modified.declarations[0].source.extensions["lean-lang.org/refinements"].parameters[0].bound = "9";
	assert.equal(reviewedFinWasmIr("scalar").declarations[0].source.extensions["lean-lang.org/refinements"].parameters[0].bound, "10");
});

const faithfulApi = () => {
	const fin = bound => value => {
		if(typeof value !== "bigint" || value < 0n || value >= bound) throw new RangeError("Fin bound");
		return value;
	};
	const array = element => values => {
		if(!Array.isArray(values)) throw new TypeError("array");
		return values.map(element);
	};
	const api = {
		mirror: value => 9n - fin(10n)(value)
		, never: fin(0n)
		, only: value => fin(1n)(value) + 7n
		, huge: fin(BigInt(reviewedFinWasmWide))
		, tenth: value => value % 10n
		, label: (before, digit, after) => before + String(fin(10n)(digit)) + after
		, rows: values => array(array(fin(10n)))(values).reverse()
		, empty: array(fin(0n))
		, nested: values => array(item => {
			if(item.tag === "none") return item;
			fin(3n)(item.value[0]);
			if("ok" in item.value[1]) fin(5n)(item.value[1].ok);
			else fin(2n)(item.value[1].error);
			return item;
		})(values).reverse()
	};
	return { ...api, raw: (name, args) => api[name](...args) };
};

test("the shared Fin consumer rejects permissive public or raw substitutes", () => {
	for(const selection of ["scalar", "structural"])
	{
		const request = { module: "reviewed-fin", selection }, api = faithfulApi();
		const observed = executeCorpus(request, api);
		assert.ok(observed.checks > 40 && observed.rejections > 100);
		assert.equal(observed.module, request.module);
		assert.equal(observed.selection, selection);
		assert.throws(() => executeCorpus(request, { ...api, mirror: () => 0n }), /failed: mirror endpoints/u);
		assert.throws(() => executeCorpus(request, { ...api, never: () => 0n }), /accepted: never public bound/u);
		const lenient = (name, args) => {
			try
			{ return api.raw(name, args); }
			catch
			{ return 0n; }
		};
		assert.throws(() => executeCorpus(request, { ...api, raw: lenient }), /accepted: mirror raw bound/u);
		if(selection === "structural")
		{
			assert.throws(() => executeCorpus(request, { ...api, empty: values => values }), /accepted: empty public bound/u);
			assert.throws(() => executeCorpus(request, { ...api, raw: (name, args) => name === "empty" ? args[0] : api.raw(name, args) }), /accepted: empty raw bound/u);
		}
	}
	assert.throws(() => executeCorpus({ module: "reviewed-fin", selection: "missing" }, faithfulApi()), /Unknown Fin selection/u);
});
