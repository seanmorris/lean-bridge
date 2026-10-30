/**
 * Prove the evidence-gated optional-parameter author documentation change.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import {
	optionalParameterCompleteDocumentationPaths
	, renderOptionalParameterCompleteDocumentation
} from "./optional-parameter-complete-documentation.mjs";
import { optionalParameterCompletePromotionPredecessor }
	from "./optional-parameter-complete-promotion-source-history.mjs";

const readSource = ([name, path]) => [name
	, execFileSync("git", ["show"
		, `${optionalParameterCompletePromotionPredecessor}:${path}`]
	, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })];
const sources = Object.fromEntries(Object.entries(
	optionalParameterCompleteDocumentationPaths).map(readSource));

test("complete optional-parameter docs state the exact omission boundary", () => {
	const rendered = renderOptionalParameterCompleteDocumentation(sources);
	assert.match(rendered.exportDecisions
		, /target-idiomatic omission without changing the full-arity ABI/u);
	assert.match(rendered.exportDecisions
		, /host null, Unit, and Option\.None distinct/u);
	assert.match(rendered.existingPackage
		, /Both versions accept compiler-authenticated optional copied parameters/u);
	assert.match(rendered.existingPackage
		, /Omission never means null, Unit or `Option\.none`/u);
	assert.match(rendered.existingPackage
		, /all seventeen consumer profiles/u);
	assert.match(rendered.existingPackage
		, /optional\s+results, fields, callbacks, resources and asynchronous/u);
	assert.doesNotMatch(rendered.existingPackage
		, /Both versions reject defaults, optional arguments/u);
});

test("complete optional-parameter docs reject missing and repeated markers", () => {
	const rendered = renderOptionalParameterCompleteDocumentation(sources);
	assert.throws(() => renderOptionalParameterCompleteDocumentation(rendered)
		, /Expected one optional-parameter documentation marker/u);
	for(const name of Object.keys(sources))
		assert.throws(() => renderOptionalParameterCompleteDocumentation({
			...sources, [name]: "missing marker\n"
		}), /Expected one optional-parameter documentation marker/u);
});
