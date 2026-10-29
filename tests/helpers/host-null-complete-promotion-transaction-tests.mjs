/**
 * Require the complete HostNull promotion to stage every file atomically.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile("scripts/promote-host-null-complete.mjs", "utf8");

test("complete HostNull promotion is clean, checkable and transactional", () => {
	assert.match(source, /process\.argv\[2\] === "--check"/u);
	assert.match(source, /HostNull promotion requires a clean committed checkout/u);
	assert.match(source, /readPromotionInventory\(createReadStream\(path\)/u);
	assert.match(source, /hostNullCompletePromotionReference\(\)/u);
	assert.match(source, /refreshHostNullPerlEvidence\(/u);
	assert.match(source, /promoteHostNullComplete\(/u);
	assert.match(source, /renderReferenceDocuments\(/u);
	assert.match(source, /renderHostNullCompleteDocumentation\(/u);
	assert.match(source, /stagePromotionInventory\(/u);
	assert.match(source, /stageEvidenceRefresh\(/u);
	assert.match(source
		, /Hosted producer must authenticate the current shared Perl source/u);
	assert.match(source, /commitPromotionFiles\(\{ root, staging, files \}\)/u);
	assert.match(source, /if\(!checkOnly\)[\s\S]*installing = true;[\s\S]*commitPromotionFiles/u);
	assert.match(source, /HostNull promotion recovery files retained/u);
	assert.doesNotMatch(source
		, /writeFile\((?:"docs\/type-surface\.v1\.json"|path),/u);
});

test("complete HostNull promotion keeps generated and manual docs together", () => {
	assert.match(source
		, /Object\.entries\(hostNullCompleteDocumentationPaths\)/u);
	assert.match(source, /generated\[documentPath\] \?\? sources\[name\]/u);
	assert.match(source
		, /files\.push\(\{ path: documentPath, staged, previous, next \}\)/u);
	assert.match(source, /mode: checkOnly \? "check" : "promote"/u);
	assert.match(source, /cells: 170/u);
	assert.match(source
		, /refreshedEvidence: hostNullPerlRequalifiedEvidenceIds\.length/u);
});
