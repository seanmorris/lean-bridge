/**
 * Valid independent Fin reviews which must disagree with fresh Lean compilation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference, validateReviewedSource } from "../../src/analyze/reviewed-source.mjs";
import { reviewedFinWasmIr, reviewedFinWasmSelections, reviewedFinWasmWide } from "./reviewed-fin-wasm-fixture.mjs";

/**
 * Keep the erased transport unchanged while changing bounds or their semantic positions.
 *
 * @param selection - The actual scalar or structural build selection.
 */
export const reviewedFinWasmMismatches = (selection = "structural") => {
	assert.ok(reviewedFinWasmSelections.includes(selection), "Unknown Wasm Fin mismatch selection");
	const tree = (ir, name) => ir.declarations.find(item => item.name === name).source.extensions["lean-lang.org/refinements"];
	const cases = [
		["tightened scalar bound", ir => { tree(ir, "mirror").parameters[0].bound = "9"; }]
		, ["loosened scalar bound", ir => { tree(ir, "mirror").parameters[0].bound = "11"; }]
		, ["inhabited formerly empty Fin", ir => { tree(ir, "never").parameters[0].bound = "1"; }]
		, ["omitted input bound", ir => { tree(ir, "mirror").parameters[0] = null; }]
		, ["omitted result bound", ir => { tree(ir, "mirror").result = null; }]
		, ["result bound moved to parameter", ir => {
			const target = tree(ir, "tenth");
			target.parameters[0] = target.result; target.result = null;
		}]
	];
	if(selection === "structural") cases.push(
		["swapped nested result branches", ir => {
			tree(ir, "nested").parameters[0].arguments[0].arguments[0].arguments[1].arguments.reverse();
		}]
		, ["changed nested array bound", ir => {
			tree(ir, "rows").parameters[0].arguments[0].arguments[0].bound = "11";
		}]
	);
	else cases.push(
		["changed singleton bound", ir => { tree(ir, "only").parameters[0].bound = "2"; }]
		, ["changed wide alias bound", ir => { tree(ir, "huge").result.bound = (BigInt(reviewedFinWasmWide) - 1n).toString(); }]
		, ["invented input bound", ir => { tree(ir, "tenth").parameters[0] = { kind: "fin", bound: "10" }; }]
		, ["omitted declaration constraints", ir => { delete ir.declarations.find(item => item.name === "mirror").source.extensions["lean-lang.org/refinements"]; }]
	);
	return cases.map(([label, mutate]) => {
		const ir = reviewedFinWasmIr(selection); mutate(ir);
		const source = canonicalJson(ir);
		validateReviewedSource({ schemaVersion: 1, path: "api.binding-ir.json", source
			, sourceSha256: sha256(source), semanticSha256: hashBindingIr(ir) });
		const expectedField = reviewedContractDifference(ir, reviewedFinWasmIr(selection));
		assert.match(expectedField, /source\.extensions\.lean-lang\.org\/refinements/u, label);
		return { label, ir, expectedField };
	});
};

/**
 * Keep the expected difference separate from fields retained by the engine transport.
 *
 * @param error - Refusal returned by the real build route.
 * @param expectedField - Exact difference from the independently authored matching review.
 */
export const reviewedFinWasmRefusal = (error, expectedField) => {
	assert.equal(error.code, "reviewed-ir-source-mismatch");
	assert.equal(error.message, "Reviewed contract does not match the freshly compiled Lean API");
	assert.match(expectedField, /source\.extensions\.lean-lang\.org\/refinements/u);
	const fieldObserved = Object.hasOwn(error.details ?? {}, "field");
	if(fieldObserved) assert.equal(error.details.field, expectedField);
	else assert.equal(error.details?.engine?.code, "reviewed-ir-source-mismatch");
	return { expectedField, fieldObserved };
};
