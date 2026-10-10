/**
 * Explicit malformed foreign-ABI cases, separate from well-formed erased Lean adapter inputs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { generateCBindingPackage } from "../../src/backends/c/generate.mjs";
import { finContainerEdgeColumns, finContainerEdgeEntries, finContainerEdgeWireSymbols } from "./fin-container-edge-dispatch.mjs";

export const finForeignClearSymbols = Object.freeze([
	"fincontainers_array_nat_span_clear"
	, "fincontainers_list_nat_span_clear"
	, "fincontainers_option_nat_value_clear"
	, "fincontainers_option_list_nat_value_clear"
]);
export const finForeignSymbols = Object.freeze([...finContainerEdgeWireSymbols, ...finForeignClearSymbols]);
const freeze = value => {
	if(value && typeof value === "object")
	{ Object.values(value).forEach(freeze); Object.freeze(value); }
	return value;
};
/** Case numbers select independent C fixture branches, not serialized Lean layouts. */
export const finForeignCases = freeze((() => {
	const cases = [];
	const add = (name, method, kind, row = 0, column = 0, accepted = false) =>
		cases.push({ name: `${name}-${finContainerEdgeEntries[method]}`, method, kind, row, column, accepted });
	for(let method = 0; method < 6; method++)
	{
		for(const [name, kind] of [["null-argument", 1], ["null-output", 2], ["invalid-root", 3], ["oversized-root", 4], ["bound", 10]])
			add(name, method, kind);
	}
	for(let row = 0; row < 3; row++)
	{
		for(const method of [0, 1, 3, 4]) add(`missing-limbs-${row}`, method, 5, row);
		for(const tag of [2, 255]) add(`invalid-tag-${row}-${tag}`, 4, 6, row, tag);
		add(`missing-row-${row}`, 5, 7, row);
		for(let column = 0; column < 3; column++) add(`missing-nested-limbs-${row}-${column}`, 5, 8, row, column);
	}
	for(const method of [2, 3])
		for(const tag of [2, 255]) add(`invalid-tag-${tag}`, method, 6, 0, tag);
	add("missing-limbs", 2, 5);
	for(let method = 0; method < 6; method++)
	{
		add("valid", method, 0, 0, 0, true);
		add("inactive-poison", method, 9, 0, 0, true);
	}
	return cases;
})());

export const finForeignExpected = freeze((() => {
	const counts = Array(8).fill(0), rows = [["start", "ok", 0, [...counts]]]; let calls = 0;
	const accepted = (method, count) => {
		counts[method + 2] += count;
		if(method >= 4) counts[method - 4] += count;
	};
	for(const item of finForeignCases)
	{
		if(item.accepted) accepted(item.method, 1);
		rows.push([item.name, item.accepted ? "ok" : "refused", ++calls, [...counts]]);
	}
	for(let method = 0; method < 6; method++)
	{
		accepted(method, 1000); calls += 2000;
		rows.push([`recovery-${finContainerEdgeEntries[method]}`, "pairs:1000", calls, [...counts]]);
	}
	return rows;
})());

/**
 * Rebuild the foreign C header using the production generator and receipt-bound Binding IR.
 *
 * @param model - Verified native model; no manual ABI struct declarations are substituted.
 */
export const finForeignHeader = model => {
	finContainerEdgeColumns(model, model.component);
	const header = generateCBindingPackage(model.bindingIr)["include/fincontainers.h"];
	assert.ok(typeof header === "string" && header.includes("FINCONTAINERS_BINDING_ABI_VERSION 1u"));
	return header;
};

/**
 * Generate only call scheduling and exact dynamic-definition checks around the independent C probe.
 *
 * @param model - Receipt-verified model.
 * @param definitions - Exact public entrypoint and disposal symbol definitions.
 */
export const finForeignProbe = async (model, definitions) => {
	finForeignHeader(model);
	assert.deepEqual(Object.keys(definitions).sort(), [...finForeignSymbols].sort());
	for(const path of Object.values(definitions))
		assert.ok(typeof path === "string" && isAbsolute(path) && !path.includes("\0"));
	const fixture = await readFile("tests/fixtures/fin-container-foreign-carriers.c", "utf8");
	const insert = (text, marker, value) => {
		assert.equal(text.split(marker).length, 2, marker);
		return text.replace(marker, () => value);
	};
	const symbols = Object.entries(definitions).map(([name, path]) => `  check_definition(${JSON.stringify(name)}, ${JSON.stringify(path)});`).join("\n");
	const calls = finForeignCases.map(item => `  exercise(${item.method}, ${item.kind}, ${item.row}, ${item.column}); report(${JSON.stringify(item.name)}, "${item.accepted ? "ok" : "refused"}");`).join("\n");
	const recovery = finContainerEdgeEntries.map((name, method) =>
		`  for (unsigned cycle = 0; cycle < 1000; cycle++) { exercise(${method}, 3, 0, 0); exercise(${method}, 0, 0, 0); } report("recovery-${name}", "pairs:1000");`).join("\n");
	return insert(insert(insert(fixture, "/* FOREIGN_DEFINITIONS */", symbols), "/* FOREIGN_CASES */", calls), "/* FOREIGN_RECOVERY */", recovery);
};

/**
 * Require complete ordered observations, exact calls, and every source/adapter counter.
 *
 * @param stdout - Actual probe stdout.
 */
export const readFinForeign = stdout => {
	assert.ok(typeof stdout === "string" && stdout.endsWith("\n"));
	const lines = stdout.slice(0, -1).split("\n");
	assert.equal(lines.length, finForeignExpected.length);
	return lines.map((line, index) => {
		assert.match(line, /^foreign-carrier [A-Za-z0-9-]+ (?:ok|refused|pairs:1000)(?: (?:0|[1-9][0-9]{0,14})){9}$/u);
		const [, name, status, calls, ...counts] = line.split(" ");
		const row = [name, status, Number(calls), counts.map(Number)];
		assert.deepEqual(row, finForeignExpected[index], `foreign carrier row ${index}`);
		return row;
	});
};
