/**
 * Keep PHP-Wasm type support separate from instrumented entry measurements.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { phpWasmRefinementEntryReference } from "../../scripts/generate-type-docs.mjs";
import { phpWasmEntryProbeEvidenceId } from "./php-wasm-refinement-entry-publication.mjs";
import {
	phpWasmEntryProbeDocumentationPaths, phpWasmEntryProbePreviousDocumentation
	, renderPhpWasmEntryProbeBoundary
} from "./php-wasm-refinement-entry-publication-docs.mjs";
import { readPromotionInventory } from "./type-surface-promotion-io.mjs";
import {
	phpWasmRefinementEntryArtifactNames
} from "./php-wasm-refinement-entry-hosted-summary.mjs";
import {
	phpWasmRefinementEntryMatrix
} from "./php-wasm-refinement-entry-matrix.mjs";

const evidenceId = "php-wasm-refinement-entry-instrumented-probe-contract";
let inventory;
const readInventory = () => inventory ??= (async () => {
	const irSchema = JSON.parse(await readFile("schema/binding-ir.schema.json", "utf8"));
	const consumers = JSON.parse(await readFile("docs/consumer-support.v1.json", "utf8"));
	return (await readPromotionInventory(createReadStream("docs/type-surface.v1.json")
		, { irSchema, consumers }, { retainEvidence: [evidenceId] })).document;
})();
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
	const document = await readInventory();
	phpWasmRefinementEntryReference(document);
	const hosted = document.evidence.find(item => item.id === phpWasmEntryProbeEvidenceId);
	for(const page of pages)
	{
		const source = await readFile(page.path, "utf8");
		if(page.heading) assert.ok(source.includes(page.heading), page.path);
		assert.match(source, /unmodified prepared(?: PHP-Wasm)? packages/iu, page.path);
		assert.match(source, matrixBoundary, page.path);
		assert.match(source, copiedBoundary, page.path);
		assert.match(source, callbackBoundary, page.path);
		const name = Object.keys(phpWasmEntryProbeDocumentationPaths)
			.find(name => phpWasmEntryProbeDocumentationPaths[name] === page.path);
		if(hosted)
		{
			assert.ok(source.includes(renderPhpWasmEntryProbeBoundary(hosted, name)), page.path);
			assert.ok(!source.includes(phpWasmEntryProbePreviousDocumentation[name]), page.path);
		}
		else
			assert.match(source
				, /no hosted (?:entry-)?count claim|not\s+a\s+hosted\s+result|not[^.]*hosted evidence/iu
				, page.path);
		assert.match(source
			, /actions\/workflows\/php-wasm-refinement-entry-promotion\.yml/u
			, page.path);
	}
});

test("the type surface records probes without widening installed support", async () => {
	const document = await readInventory();
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
	).filter(id => [evidenceId, phpWasmEntryProbeEvidenceId].includes(id)), []
	, "probe evidence must not establish a prepared-package support stage");
	assert.equal(phpWasmRefinementEntryMatrix.length, 30);
	assert.equal(phpWasmRefinementEntryArtifactNames("a".repeat(40)).length, 27);
});
