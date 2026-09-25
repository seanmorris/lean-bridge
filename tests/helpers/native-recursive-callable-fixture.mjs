/**
 * Nine copied shapes plus callback-only nested aliases for native packages.
 * The reviewed signatures remain independent of compiler extraction.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { structuredCallableArities, structuredCallableExports, structuredCallableReviewedIr } from "./structured-callable-fixture.mjs";
import { witNestedAliasExports, witNestedAliasReviewedIr } from "./wit-structured-alias-fixture.mjs";

export const nativeRecursiveCallableExports = [...structuredCallableExports({ recursive: true }), ...witNestedAliasExports];
export const nativeRecursiveCallableArities = { ...structuredCallableArities
	, "Structured.makeNestedAlias": 1, "Structured.makeNestedPlain": 1 };

/** Combine independently stated signatures without replacing shared types. */
export const nativeRecursiveCallableReviewedIr = () => {
	const ir = structuredCallableReviewedIr({ recursive: true }), aliases = witNestedAliasReviewedIr();
	for(const type of aliases.types)
	{
		const previous = ir.types.find(item => item.id === type.id);
		if(previous) assert.deepEqual(previous, type);
		else ir.types.push(type);
	}
	ir.declarations.push(...aliases.declarations);
	return ir;
};

/** Return the complete Lean source used by both native authoring paths. */
export const nativeRecursiveCallableSource = async () => {
	const source = await readFile("tests/fixtures/onboarding/structured-callables/Structured.lean", "utf8");
	const aliases = await readFile("tests/fixtures/structured-callable-consumers/wit-aliases.lean", "utf8");
	assert.equal(source.split("end Structured").length, 2);
	return source.replace("end Structured", aliases + "\nend Structured");
};
