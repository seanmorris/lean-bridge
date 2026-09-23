/**
 * Verify additive test registrations without rewriting installed-build receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertSourceRegistrationUpdate } from "./source-registration-history.mjs";

/**
 * Undo only recorded, uniquely occurring manifest entries and verify each hash.
 *
 * @param source - Current test manifest text.
 * @param expected - The immutable receipt's original source hash.
 * @param updates - Explicit registration steps, newest or oldest first.
 */
export const verifyAddedTestRegistrations = (source, expected, updates) => {
	const seen = new Set();
	while(sha256(source) !== expected)
	{
		const current = sha256(source);
		assert.ok(!seen.has(current), "Cyclic registration lineage"); seen.add(current);
		const candidates = updates.filter(item => item.path === "src/adoption/test-profiles.mjs" && item.currentSha256 === current);
		assert.equal(candidates.length, 1, "Missing or ambiguous additive registration lineage");
		const update = candidates[0];
		assert.ok(Array.isArray(update.addedTests) && update.addedTests.length > 0);
		assert.equal(new Set(update.addedTests).size, update.addedTests.length);
		for(const name of update.addedTests)
		{
			assert.match(name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
			const line = `\t\t, "${name}"\n`;
			assert.equal(source.split(line).length, 2, `Registration must occur once: ${name}`);
			source = source.replace(line, "");
		}
		assert.equal(sha256(source), update.previousSha256, "Test registration changed more than its declared additions");
	}
};

/**
 * Keep current build sources exact; permit only checked registration bookkeeping.
 *
 * @param path - A source file from the historical JVM regression receipt.
 * @param expected - Its unchanged recorded SHA-256.
 */
export const assertAdministrativeSourceUpdate = async (path, expected) => {
	let source = await readFile(path, "utf8");
	if(sha256(source) === expected) return;
	if(await assertSourceRegistrationUpdate(path, source, expected)) return;
	if(path === "src/adoption/test-profiles.mjs")
	{
		const history = JSON.parse(await readFile("docs/evidence/recursive-npm-source-lineage-20260922.json"));
		verifyAddedTestRegistrations(source, expected, history.registrationUpdates);
		return;
	}
	if(path === "tests/helpers/native-graph-jvm-regression.mjs")
	{
		for(const [current, previous] of [
			['import { assertAdministrativeSourceUpdate } from "./test-registration-history.mjs";\n', ""]
			, ['for(const [path, hash] of Object.entries(regression.sourceHashes)) await assertAdministrativeSourceUpdate(path, hash);', 'for(const [path, hash] of Object.entries(regression.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);']
		]){
			assert.equal(source.split(current).length, 2, "Exactly one registration-aware verification change");
			source = source.replace(current, previous);
		}
	}
	assert.equal(sha256(source), expected, path);
};
