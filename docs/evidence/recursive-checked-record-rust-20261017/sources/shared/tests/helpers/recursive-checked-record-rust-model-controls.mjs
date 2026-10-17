/**
 * Independent recursive compiler-model mutation targets for Rust evidence.
 *
 * @file
 */
import assert from "node:assert/strict";

const refined = model => model.exports.flatMap(item =>
	item.refinements ? [item.refinements] : []);
const replaceLeaf = (value, predicate, mutate) => {
	if(!value || typeof value !== "object") return false;
	if(predicate(value))
	{
		mutate(value);
		return true;
	}
	return Object.values(value).some(child => replaceLeaf(child, predicate, mutate));
};

/**
 * Coordinated model mutations that both retained builds must refuse.
 *
 * @param fixture - Recursive or mutually recursive graph.
 */
export const recursiveCheckedRecordRustModelMutations = fixture => {
	const prefix = {
		recursive: "RecursiveCheckedRecords", mutual: "MutualCheckedRecords"
	}[fixture];
	assert.ok(prefix);
	return [
		["wrong native word width", model => { model.pointerBits = 32; }]
		, ["omitted export", model => { model.exports.pop(); }]
		, ["changed extractor", model => {
			model.sourceIdentity.extractorSha256 = "0".repeat(64);
		}]
		, ["changed carrier symbol", model => {
			model.copiedGraph.exports[0].symbol = "lean_bridge_substituted";
		}]
		, ["changed Fin bound", model => {
			assert.ok(replaceLeaf(refined(model), item => item.kind === "fin"
				, item => { item.bound = "9"; }));
		}]
		, ["invented result constructor", model => {
			assert.ok(replaceLeaf(refined(model).map(item => item.result)
				, item => item.kind === "checked-record"
				, item => { item.constructor = `${prefix}.mk${fixture === "mutual"
					? "Envelope" : "Packet"}`; }));
		}]
		, ["unreviewed parameter constructor", model => {
			assert.ok(replaceLeaf(refined(model).map(item => item.parameters)
				, item => item.kind === "subtype" && item.constructor !== null
				, item => { item.constructor = `${prefix}.unreviewed`; }));
		}]
		, ["swapped per-site constructor", model => {
			assert.ok(replaceLeaf(refined(model).map(item => item.parameters)
				, item => item.kind === "checked-record"
					&& item.constructor?.includes(".normalize")
				, item => { item.constructor = item.constructor.replace(".normalize", ".mk"); }));
		}]
	];
};
