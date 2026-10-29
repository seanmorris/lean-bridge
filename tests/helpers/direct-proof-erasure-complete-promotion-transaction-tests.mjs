/**
 * Require complete proof-erasure promotion to stage all files atomically.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
	"scripts/promote-direct-proof-erasure-complete.mjs", "utf8");

test("complete proof-erasure promotion is clean and transactional", () => {
	assert.match(source, /process\.argv\[2\] === "--check"/u);
	assert.match(source
		, /Direct proof-erasure promotion requires a clean committed checkout/u);
	assert.match(source, /readPromotionInventory\(createReadStream\(path\)/u);
	assert.match(source, /directProofErasureCompleteReference\(\)/u);
	assert.match(source, /promoteDirectProofErasureComplete\(/u);
	assert.match(source, /renderReferenceDocuments\(/u);
	assert.match(source, /renderDirectProofErasureCompleteDocumentation\(/u);
	assert.match(source, /stagePromotionInventory\(/u);
	assert.match(source
		, /commitPromotionFiles\(\{ root, staging, files \}\)/u);
	assert.match(source
		, /if\(!checkOnly\)[\s\S]*installing = true;[\s\S]*commitPromotionFiles/u);
	assert.match(source
		, /Direct proof-erasure promotion recovery files retained/u);
	assert.doesNotMatch(source
		, /writeFile\((?:"docs\/type-surface\.v1\.json"|path),/u);
});

test("complete proof-erasure promotion keeps all documentation together", () => {
	assert.match(source
		, /Object\.entries\(\s*directProofErasureCompleteDocumentationPaths\)/u);
	assert.match(source, /generated\[documentPath\] \?\? sources\[name\]/u);
	assert.match(source
		, /files\.push\(\{ path: documentPath, staged, previous, next \}\)/u);
	assert.match(source, /mode: checkOnly \? "check" : "promote"/u);
	assert.match(source, /cells: 204/u);
});
