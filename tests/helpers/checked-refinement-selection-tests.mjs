/**
 * Bound structural constructor choices without dropping compiler-owned Fin branches.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { checkedRefinementSelection, validateCheckedRefinementSelection } from "../../src/analyze/checked-refinement-selection.mjs";
import { compilerExportSelection, exportContractProblem, validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { assertJsonSchema } from "./json-schema.mjs";

const leaf = constructor => ({ constructor });
const subtype = constructor => ({ kind: "subtype", constructor });
const tree = (kind, ...children) => ({ kind, arguments: children });
const fin = { kind: "fin", bound: "184467440737095516170" };
const config = refinement => ({
	schemaVersion: 1
	, contracts: {
		"Library.run": { parameters: [{ ownership: "copy", lifetime: null, refinement }] }
	}
});

test("the configuration reader and schema preserve ordered structural constructor choices", async () => {
	for(const selection of [leaf("Library.checked")
		, ...["array", "list", "option"].map(kind => tree(kind, leaf("Library.checked")))
		, tree("tuple", leaf("Library.left"), leaf("Library.right"))
		, tree("result", null, leaf("Library.error"))
		, tree("result", leaf("Library.ok"), null)
		, tree("array", tree("tuple", leaf("Library.checked"), null))
	]){
		const configuration = config(selection), snapshot = structuredClone(configuration);
		assert.equal(validateExportConfiguration(configuration), configuration);
		await assertJsonSchema("lean-export-configuration", configuration);
		assert.deepEqual(compilerExportSelection(configuration).contracts, snapshot.contracts);
		assert.deepEqual(configuration, snapshot);
	}
	for(const selection of [tree("array", null), tree("tuple", null, null)
		, tree("tuple", leaf("Library.checked"))
		, tree("array", leaf("Library.checked"), null)
		, tree("option", { constructor: "Library.checked", trusted: true })
		, tree("result", null, tree("record", leaf("Library.checked")))
		, tree("array", { constructor: "Library.checked\n" })
	]){
		assert.throws(() => validateExportConfiguration(config(selection)), { code: "invalid-export-configuration" });
		await assert.rejects(() => assertJsonSchema("lean-export-configuration", config(selection)));
	}
});

test("accepting constructor-choice syntax does not admit an unchecked runtime projection", () => {
	const selection = tree("array", leaf("Library.checked"));
	const configuration = validateExportConfiguration(config(selection));
	const erased = { kind: "array", element: { kind: "primitive", name: "nat" } };
	assert.match(exportContractProblem(configuration.contracts["Library.run"], {
		status: "supported"
		, parameters: [{ type: erased }]
		, result: { kind: "primitive", name: "nat" }
	}), /checked refinement constructor does not match/);
});

test("structural constructor choices retain both branches and preserve source predicates", () => {
	const predicate = tree("tuple", tree("array", tree("option", subtype("Library.normalize"))),
		tree("result", tree("list", fin), subtype("Library.checked")));
	const previous = structuredClone(predicate);
	const selected = checkedRefinementSelection(predicate);
	assert.deepEqual(selected, tree("tuple", tree("array", tree("option", leaf("Library.normalize"))),
		tree("result", null, leaf("Library.checked"))));
	assert.equal(validateCheckedRefinementSelection(selected), selected);
	assert.deepEqual(predicate, previous);
	assert.deepEqual(checkedRefinementSelection(subtype("Library.scalar")), leaf("Library.scalar"));
	assert.deepEqual(checkedRefinementSelection({ kind: "checked-record", constructor: "Library.record" }), leaf("Library.record"));
	assert.equal(checkedRefinementSelection(tree("result", tree("list", fin), null)), null);
	assert.equal(checkedRefinementSelection(null), null);
	assert.equal(checkedRefinementSelection(fin), null);
});

test("constructor selections reject malformed, empty, sparse and misplaced decisions", () => {
	const sparse = new Array(2); sparse[0] = leaf("Library.checked");
	const accessor = Object.defineProperty({}, "constructor", {
		get: () => { throw new Error("Getter must not execute"); }
	});
	for(const value of [null, undefined, true, 0, "reject", [], {}
		, leaf("Library.checked\n"), leaf(""), leaf(12)
		, { ...leaf("Library.checked"), bound: "10" }, accessor
		, Object.create(leaf("Library.checked"))
		, tree("record", leaf("Library.checked"))
		, tree("callback", leaf("Library.checked"))
		, tree("constructor", leaf("Library.checked")), tree("array")
		, tree("array", leaf("Library.checked"), null)
		, tree("tuple", leaf("Library.checked"))
		, tree("tuple", null, null), tree("array", null)
		, tree("tuple", leaf("Library.checked"), tree("option", null))
		, { kind: "tuple", arguments: sparse }
		, tree("tuple", leaf("Library.checked"), { ...leaf("Library.other"), hidden: true })
	]) assert.throws(() => validateCheckedRefinementSelection(value), /Invalid checked refinement selection/);
	for(const value of [tree("array", { kind: "checked-record", constructor: "Library.record" })
		, tree("tuple", subtype("Library.checked"), { kind: "fin", bound: "01" })
		, tree("tuple", subtype("Library.checked"), { kind: "fin", bound: "10\n" })
		, tree("record", subtype("Library.checked"))
		, { kind: "tuple", arguments: sparse }
		, { kind: "subtype", constructor: "Library.checked", predicate: "trusted" }
	]) assert.throws(() => checkedRefinementSelection(value), /Invalid checked refinement selection/);
});

test("constructor selectors enforce depth and node budgets, including cycles and shared subtrees", () => {
	const nest = (value, count) => {
		for(let index = 0; index < count; index++) value = tree("array", value);
		return value;
	};
	validateCheckedRefinementSelection(nest(leaf("Library.checked"), 32));
	assert.throws(() => validateCheckedRefinementSelection(nest(leaf("Library.checked"), 33)));
	assert.deepEqual(checkedRefinementSelection(nest(subtype("Library.checked"), 32)), nest(leaf("Library.checked"), 32));
	assert.throws(() => checkedRefinementSelection(nest(subtype("Library.checked"), 33)));
	let selection = leaf("Library.checked"), predicate = subtype("Library.checked");
	for(let index = 0; index < 11; index++)
	{
		selection = tree("tuple", selection, selection);
		predicate = tree("tuple", predicate, predicate);
	}
	validateCheckedRefinementSelection(selection); // 4095 visited nodes.
	assert.deepEqual(checkedRefinementSelection(predicate), selection);
	assert.throws(() => validateCheckedRefinementSelection(tree("tuple", selection, leaf("Library.checked"))));
	assert.throws(() => checkedRefinementSelection(tree("tuple", predicate, subtype("Library.checked"))));
	const cycle = tree("array", null); cycle.arguments[0] = cycle;
	assert.throws(() => validateCheckedRefinementSelection(cycle));
	assert.throws(() => checkedRefinementSelection(cycle));
});
