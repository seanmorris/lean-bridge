/**
 * Require complete optional-parameter promotion to stage all files atomically.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
	"scripts/promote-optional-parameter-complete.mjs", "utf8");

test("complete optional-parameter promotion is clean and transactional", () => {
	assert.match(source, /process\.argv\[2\] === "--check"/u);
	assert.match(source
		, /Optional-parameter promotion requires a clean committed checkout/u);
	assert.match(source, /readPromotionInventory\(createReadStream\(path\)/u);
	assert.match(source, /optionalParameterCompleteReference\(\)/u);
	assert.match(source, /promoteOptionalParameterComplete\(/u);
	assert.match(source, /renderReferenceDocuments\(/u);
	assert.match(source, /renderOptionalParameterCompleteDocumentation\(/u);
	assert.match(source, /reconcileDependentCheckedRecordSourcePins\(/u);
	assert.match(source, /Missing promoted documentation:/u);
	assert.match(source, /refresh exactly 70 live pins/u);
	assert.match(source, /retain exactly 35 live-pin evidence entries/u);
	assert.match(source, /stagePromotionInventory\(/u);
	assert.match(source, /stageEvidenceRefresh\(/u);
	assert.match(source
		, /Source-pin reconciliation must not change rendered documentation/u);
	assert.match(source
		, /commitPromotionFiles\(\{ root, staging, files \}\)/u);
	assert.match(source
		, /if\(!checkOnly\)[\s\S]*installing = true;[\s\S]*commitPromotionFiles/u);
	assert.match(source
		, /Optional-parameter promotion recovery files retained/u);
	assert.doesNotMatch(source
		, /writeFile\((?:"docs\/type-surface\.v1\.json"|path),/u);
});

test("complete optional-parameter promotion keeps all documentation together", () => {
	assert.match(source
		, /Object\.entries\(\s*optionalParameterCompleteDocumentationPaths\)/u);
	assert.match(source, /generated\[documentPath\] \?\? sources\[name\]/u);
	assert.match(source
		, /files\.push\(\{ path: documentPath, staged, previous, next \}\)/u);
	assert.match(source, /mode: checkOnly \? "check" : "promote"/u);
	assert.match(source, /cells: 34/u);
	assert.match(source, /sourcePins: \{/u);
});
