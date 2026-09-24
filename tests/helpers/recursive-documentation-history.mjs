/**
 * Verify reviewed documentation changes without relaxing executable source checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { beforeRecursiveAcceptanceDocument } from "./recursive-acceptance-updates.mjs";

const recordPath = "docs/evidence/recursive-documentation-updates-20260924.json";
const lineagePath = "docs/evidence/recursive-npm-source-lineage-20260922.json";
const paths = ["docs/architecture/binding-ir.md", "docs/consume/dotnet.md"
	, "docs/consume/java.md", "docs/consume/kotlin.md"
	, "docs/contributing/testing.md", "docs/php.md"
	, "tests/documentation.test.mjs"];

/**
 * Reconstruct the original complete document from uniquely occurring edits.
 *
 * @param source - Complete current document.
 * @param update - Reviewed edits and original/current hashes.
 */
export const reverseRecursiveDocumentation = (source, update) => {
	source = beforeRecursiveAcceptanceDocument(source, update.currentSha256);
	assert.equal(sha256(source), update.currentSha256);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	for(const { current, previous } of update.edits.toReversed())
	{
		assert.ok(typeof current === "string" && current.length > 0 && typeof previous === "string");
		assert.equal(source.split(current).length, 2, "Exactly one reviewed documentation edit");
		source = source.replace(current, previous);
	}
	assert.equal(sha256(source), update.previousSha256);
	return source;
};

/**
 * Require unchanged historical records and set-wise additive registration steps.
 *
 * @param source - Complete current registration history.
 * @param previousText - Authenticated preceding history.
 */
export const assertAdditiveRecursiveHistory = (source, previousText) => {
	const current = JSON.parse(source), previous = JSON.parse(previousText);
	assert.deepEqual(Object.keys(current), Object.keys(previous));
	for(const key of ["schemaVersion", "description", "historicalReceipts"])
		assert.deepEqual(current[key], previous[key], `Historical ${key} changed`);
	for(const key of ["registrationUpdates", "sourceRegistrationUpdates"])
	{
		const entries = current[key].map(canonicalJson);
		assert.equal(new Set(entries).size, entries.length, "Duplicate registration step");
		for(const entry of previous[key]) assert.ok(entries.includes(canonicalJson(entry)), "Historical registration changed or disappeared");
	}
};

/**
 * Bind the reviewed documents, complete documentation test run and old PHP receipt.
 *
 * @param record - Current documentation evidence.
 */
export const assertRecursiveDocumentationRecord = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "recursive-documentation-updates"); assert.equal(record.finalAcceptance, false);
	assert.deepEqual(Object.keys(record.files).sort(), paths);
	for(const [path, update] of Object.entries(record.files)) reverseRecursiveDocumentation(await readFile(path, "utf8"), update);
	assert.equal(record.lineage.path, lineagePath);
	assert.equal(sha256(record.lineage.previousText), record.lineage.previousSha256);
	const source = await readFile(lineagePath, "utf8");
	assert.equal(sha256(source), record.lineage.currentSha256);
	assertAdditiveRecursiveHistory(source, record.lineage.previousText);
	assert.equal(record.predecessor.path, "docs/evidence/php-recursive-packages-20260923.json");
	const previous = await readFile(record.predecessor.path);
	assert.equal(sha256(previous), record.predecessor.sha256);
	assert.equal(sha256(record.log.text), record.log.sha256);
	assert.match(record.log.text, /# tests 45\n# suites 0\n# pass 45\n# fail 0\n# cancelled 0\n# skipped 0/);
	return JSON.parse(previous);
};

/**
 * A documentation snapshot never establishes a production-code transition.
 * Intermediate PHP documentation remains pinned in its original package receipt.
 *
 * @param path - Exact documentation or registration-history path.
 * @param source - Complete current text, including unrelated edits if any.
 * @param expected - The immutable predecessor's original digest.
 */
export const assertRecursiveDocumentationSource = async (path, source, expected) => {
	if(!paths.includes(path) && path !== lineagePath) return false;
	const record = JSON.parse(await readFile(recordPath));
	const previous = await assertRecursiveDocumentationRecord(record);
	if(path === lineagePath)
	{
		assert.equal(sha256(source), record.lineage.currentSha256);
		assert.equal(expected, record.lineage.previousSha256);
		return true;
	}
	source = beforeRecursiveAcceptanceDocument(source, record.files[path].currentSha256);
	assert.equal(sha256(source), record.files[path].currentSha256);
	assert.ok(expected === record.files[path].previousSha256
		|| path.startsWith("docs/") && expected === previous.sourceHashes[path], "Unknown documentation predecessor");
	return true;
};
