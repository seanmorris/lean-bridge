/**
 * Valid independent Fin reviews which must disagree with fresh Lean compilation.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateReviewedSource } from "../../src/analyze/reviewed-source.mjs";
import { reviewedFinWasmIr } from "./reviewed-fin-wasm-fixture.mjs";

/**
 * Keep the erased transport unchanged while changing bounds or their semantic positions.
 */
export const reviewedFinWasmMismatches = () => {
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
		, ["swapped nested result branches", ir => {
			tree(ir, "nested").parameters[0].arguments[0].arguments[0].arguments[1].arguments.reverse();
		}]
		, ["changed nested array bound", ir => {
			tree(ir, "rows").parameters[0].arguments[0].arguments[0].bound = "11";
		}]
	];
	return cases.map(([label, mutate]) => {
		const ir = reviewedFinWasmIr("structural"); mutate(ir);
		const source = canonicalJson(ir);
		validateReviewedSource({ schemaVersion: 1, path: "api.binding-ir.json", source
			, sourceSha256: sha256(source), semanticSha256: hashBindingIr(ir) });
		return { label, ir };
	});
};
