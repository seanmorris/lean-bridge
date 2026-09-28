/**
 * Authenticate ownership-analysis changes without rewriting earlier receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedZendBailoutRepair, ownedZendBailoutNormalizationPaths } from "./owned-zend-bailout-repair-history.mjs";

export const ownedAnalysisBaseline = "caeec400c8c5848ee2e31da702dbb3345e106aa1";
export const ownedAnalysisHistoryPath = "docs/evidence/owned-analysis-integration-20260928.json";
export const ownedAnalysisPrevious = Object.freeze({
	path: "docs/evidence/owned-javascript-coexistence-integration-20260928.json"
	, sha256: "21c3f139c1753a6bae4a4e1b4671e36287721007dfc66d97f00ecec2dd4b6be6"
});
export const ownedAnalysisBaselineSources = Object.freeze({
	"docs/lean/diagnostics.md": "3cb8ed079aa99260f25d2f4696dae93b903252a4b67937078319694553f68e65"
	, "docs/reference/cli.md": "930a0979dbbec8732b436b14450947f29d835bcc8a1ab71e3e3375e639a40b78"
	, "schema/lake-entry-elaboration.schema.json": "78b3291ddfad9a617eaab1dc2564893f7fe924b4699a6b43458e1d45ddfdfd4e"
	, "schema/lake-entry-intent.schema.json": "bf8dc2357bce6542ed8b17cd21769e02114dafe075c3255c506914ca5329a7a2"
	, "schema/project-analysis.schema.json": "ab426c025fd88a233e046f0cc22dfcfcd6c0a3904c6c2672362522cbf604d041"
	, "site/reference/cli.md": "5801230f94276cee052441df5a520a3ce2b85b5c2c97440f68c738f88b051f5b"
	, "src/analyze/compiler-analysis.mjs": "af5629b7b875bcf63701548c42fa3f995b0c0f6125104c633f0ad33071534c72"
	, "src/build/lake-entry-elaboration.mjs": "2d216501f0fa2bfdcb5ba6c1b4e1acb2c79480da8c6252ee8a2a5dd1abeb8e85"
	, "src/build/lean-analysis-engine.mjs": "a5cc72c5eca950188b2496bcca402548142b823d6dddce01834c71c96ebfcd8c"
	, "tests/word-contract.test.mjs": "b350257f4a8376a06371d63be9a879c5d60a6b0f98b8b3b77147c8ecc4822c64"
});
export const ownedAnalysisChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/architecture/elaborated-export-metadata.md"
	, "docs/contributing/testing.md", "docs/lean/diagnostics.md"
	, "docs/lean/existing-package.md", "docs/lean/export-decisions.md"
	, "docs/reference/cli.md", "docs/type-surface.v1.json"
	, "schema/lake-entry-elaboration.schema.json"
	, "schema/lake-entry-intent.schema.json", "schema/project-analysis.schema.json"
	, "site/reference/cli.md"
	, "src/adoption/test-profiles.mjs", "src/analyze/compiler-analysis.mjs"
	, "src/analyze/project-analysis.mjs", "src/analyze/project-elaborated.mjs"
	, "src/analyze/reviewed-owned-source.mjs"
	, "src/build/engine-execution-request.mjs"
	, "src/build/lake-entry-elaboration.mjs"
	, "src/build/lean-analysis-engine.mjs"
	, "tests/helpers/owned-javascript-coexistence-source-history.mjs"
	, "tests/helpers/owned-javascript-npm-source-history.mjs"
	, "tests/helpers/owned-javascript-wasm-ci.mjs"
	, "tests/owned-javascript-coexistence-evidence.test.mjs"
	, "tests/owned-javascript-wasm-ci.test.mjs", "tests/word-contract.test.mjs"
].sort();
export const ownedAnalysisAddedPaths = [
	"docs/evidence/owned-compiler-analysis-20260928.md"
	, "tests/helpers/owned-analysis.mjs"
	, "tests/helpers/owned-analysis-evidence.mjs"
	, "tests/helpers/owned-analysis-source-history.mjs"
	, "tests/owned-analysis-build-parity.test.mjs"
	, "tests/owned-analysis-evidence.test.mjs"
	, "tests/owned-compiler-analysis.test.mjs"
].sort();
let cached;
export const ownedAnalysisNormalizationPaths = [...new Set([...ownedAnalysisChangedPaths, ...ownedZendBailoutNormalizationPaths])].sort();

/**
 * Undo only recorded edits with both complete source identities.
 *
 * @param source - Complete current text.
 * @param update - Declared literal edits and before/after hashes.
 */
export const reverseOwnedAnalysisUpdate = (source, update) => {
	assert.ok(ownedAnalysisChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	const parts = []; let end = 0;
	for(const { start, current, previous } of update.edits)
	{
		assert.ok(Number.isSafeInteger(start) && start >= end);
		assert.equal(typeof current, "string"); assert.equal(typeof previous, "string");
		assert.notEqual(current, previous);
		assert.equal(source.slice(start, start + current.length), current, update.path);
		parts.push(source.slice(end, start), previous); end = start + current.length;
	}
	parts.push(source.slice(end)); const restored = parts.join("");
	assert.equal(sha256(restored), update.previousSha256, update.path); return restored;
};

/**
 * Leave unknown changes visible and stop at the requested historical identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical text.
 * @param expected - Optional stopping hash.
 */
export const beforeOwnedAnalysis = (path, source, expected) => {
	source = beforeOwnedZendBailoutRepair(path, source, expected);
	if(typeof source === "string" && !ownedAnalysisChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected || !ownedAnalysisChangedPaths.includes(path)) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedAnalysisHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-analysis-integration");
	assert.equal(record.baselineRevision, ownedAnalysisBaseline);
	assert.deepEqual(record.previous, ownedAnalysisPrevious);
	assert.deepEqual(record.baselineSources, ownedAnalysisBaselineSources);
	assert.deepEqual(record.updates.map(update => update.path), ownedAnalysisChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedAnalysisUpdate(source, update) : source;
};
