/**
 * Prove the evidence-gated direct proof-erasure author documentation change.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import {
	directProofErasureCompleteDocumentationPaths
	, renderDirectProofErasureCompleteDocumentation
} from "./direct-proof-erasure-complete-documentation.mjs";
import { directProofErasureCompletePromotionPredecessor }
	from "./direct-proof-erasure-complete-promotion-source-history.mjs";

const readSource = ([name, path]) => [
	name
	, execFileSync("git", ["show"
		, `${directProofErasureCompletePromotionPredecessor}:${path}`]
	, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
];
const sources = Object.fromEntries(Object.entries(
	directProofErasureCompleteDocumentationPaths).map(readSource));

test("complete direct proof-erasure docs state the exact runtime boundary", () => {
	const rendered = renderDirectProofErasureCompleteDocumentation(sources);
	assert.match(rendered.exportDecisions
		, /authenticate proof-only positions and erase their runtime slots/u);
	assert.match(rendered.exportDecisions, /Refuse proof-valued exports/u);
	assert.doesNotMatch(rendered.exportDecisions
		, /Let Lean determine runtime erasure/u);
	assert.match(rendered.existingPackage
		, /A downstream caller never supplies a proof, null, Unit or a/u);
	assert.match(rendered.existingPackage
		, /declaration whose runtime result is itself a proof is refused/u);
	assert.match(rendered.existingPackage
		, /all seventeen consumer profiles, both author routes and all six direct/u);
});

test("complete direct proof-erasure docs reject missing and repeated markers", () => {
	const rendered = renderDirectProofErasureCompleteDocumentation(sources);
	assert.throws(() => renderDirectProofErasureCompleteDocumentation(rendered)
		, /Expected one direct proof-erasure documentation marker/u);
	for(const name of Object.keys(sources))
		assert.throws(() => renderDirectProofErasureCompleteDocumentation({
			...sources, [name]: "missing marker\n"
		}), /Expected one direct proof-erasure documentation marker/u);
});
