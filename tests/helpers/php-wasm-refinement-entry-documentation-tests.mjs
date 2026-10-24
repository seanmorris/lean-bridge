/**
 * Keep PHP-Wasm type support separate from instrumented entry measurements.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	phpWasmRefinementEntryArtifactNames
} from "./php-wasm-refinement-entry-hosted-summary.mjs";
import {
	phpWasmRefinementEntryMatrix
} from "./php-wasm-refinement-entry-matrix.mjs";

const evidenceId = "php-wasm-refinement-entry-instrumented-probe-contract";
const matrixBoundary = /30\s+ordinary\/reviewed routes in 27 retained artifacts/u;
const copiedBoundary = /24\s+copied,\s*owned\s+and\s+indexed\s+routes[\s\S]{0,180}(?:count|use)[\s\S]{0,180}validator,\s*constructor,\s*adapter\s+and\s+Lean-source\s+entries/iu;
const callbackBoundary = /six\s+callback\s+routes\s+record\s+callback\s+control\s+totals/iu;
const pages = Object.freeze([
	Object.freeze({ path: "docs/php.md", heading: "### Refinement support and entry measurements" })
	, Object.freeze({ path: "docs/publish/php.md", heading: "## Refinement checks and measurement probes" })
	, Object.freeze({ path: "docs/lean/existing-package.md", heading: null })
	, Object.freeze({ path: "docs/reference/types.md", heading: null })
]);

test("PHP-Wasm docs separate prepared-package support from entry probes", async () => {
	for(const page of pages)
	{
		const source = await readFile(page.path, "utf8");
		if(page.heading) assert.ok(source.includes(page.heading), page.path);
		assert.match(source, /unmodified prepared(?: PHP-Wasm)? packages/iu, page.path);
		assert.match(source, matrixBoundary, page.path);
		assert.match(source, copiedBoundary, page.path);
		assert.match(source, callbackBoundary, page.path);
		assert.match(source
			, /no hosted (?:entry-)?count claim|not\s+a\s+hosted\s+result|not[^.]*hosted evidence/iu
			, page.path);
		assert.match(source
			, /actions\/workflows\/php-wasm-refinement-entry-promotion\.yml/u
			, page.path);
	}
});

test("the type surface records probes without widening installed support", async () => {
	const document = JSON.parse(await readFile("docs/type-surface.v1.json", "utf8"));
	const evidence = document.evidence.find(item => item.id === evidenceId);
	assert.ok(evidence);
	assert.equal(evidence.kind, "test");
	assert.match(evidence.scope, /separate instrumented PHP-Wasm fixture packages/u);
	assert.match(evidence.scope, matrixBoundary);
	assert.match(evidence.scope, /not installed consumer-package evidence/u);
	assert.match(evidence.scope, /does not change the support states/u);
	assert.match(evidence.scope, /does not claim hosted entry counts until/u);
	assert.deepEqual(evidence.artifacts, []);
	assert.deepEqual(evidence.files.map(item => item.path), [
		".github/workflows/php-wasm-refinement-entry-promotion.yml"
		, "tests/helpers/php-wasm-refinement-entry-matrix.mjs"
		, "tests/helpers/php-wasm-refinement-entry-hosted-summary.mjs"
		, "tests/helpers/php-wasm-refinement-entry-promotion-ci.mjs"
	]);
	assert.deepEqual(document.observations.flatMap(observation =>
		Object.values(observation.stages).flatMap(stage => stage.evidence)
	).filter(id => id === evidenceId), []
	, "probe evidence must not establish a prepared-package support stage");
	assert.equal(phpWasmRefinementEntryMatrix.length, 30);
	assert.equal(phpWasmRefinementEntryArtifactNames("a".repeat(40)).length, 27);
});
