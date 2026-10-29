/**
 * Require complete dependent-signature promotion to stage every file
 * atomically.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
	"scripts/promote-dependent-signature-complete.mjs", "utf8");

test("complete dependent-signature promotion is clean and transactional", () => {
	assert.match(source, /process\.argv\[2\] === "--check"/u);
	assert.match(source
		, /Dependent-signature promotion requires a clean committed checkout/u);
	assert.match(source, /readPromotionInventory\(createReadStream\(path\)/u);
	assert.match(source, /dependentSignatureCompleteReference\(\)/u);
	assert.match(source, /promoteDependentSignatureComplete\(/u);
	assert.match(source, /renderReferenceDocuments\(/u);
	assert.match(source, /renderDependentSignatureCompleteDocumentation\(/u);
	assert.match(source, /stagePromotionInventory\(/u);
	assert.match(source
		, /commitPromotionFiles\(\{ root, staging, files \}\)/u);
	assert.match(source
		, /if\(!checkOnly\)[\s\S]*installing = true;[\s\S]*commitPromotionFiles/u);
	assert.match(source
		, /Dependent-signature promotion recovery files retained/u);
	assert.doesNotMatch(source
		, /writeFile\((?:"docs\/type-surface\.v1\.json"|path),/u);
});

test("complete dependent-signature promotion keeps documentation together", () => {
	assert.match(source
		, /Object\.entries\(\s*dependentSignatureCompleteDocumentationPaths\)/u);
	assert.match(source, /generated\[documentPath\] \?\? sources\[name\]/u);
	assert.match(source
		, /files\.push\(\{ path: documentPath, staged, previous, next \}\)/u);
	assert.match(source, /mode: checkOnly \? "check" : "promote"/u);
	assert.match(source, /cells: 34/u);
});
