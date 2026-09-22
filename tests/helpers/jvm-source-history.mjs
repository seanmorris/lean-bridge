/**
 * Keep historical JVM archives immutable while binding changed sources to fresh runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";

export const jvmHistoricalReceipts = Object.freeze({
	"java-collections-20260922": "632f5d31a780571d0aabce1b71e879439d0ba68782b12cbd7bbe2c5f3911f191"
	, "jvm-compounds-20260920": "efb0b3d87ea13ef28f27e8ff5830502bbec091f40ff56aaddae251d39f34aa8f"
	, "jvm-lists-20260920": "ab89a6e92339a06602fb2c5a900a56550847c99f445f19256191cb8158173002"
	, "jvm-aliases-20260921": "ac1eef0d323a6adb619f2c1e6b1b5949f2efc18426bc128dbfcd2520ed8c2368"
	, "jvm-variants-20260921": "57dbfb5d98868c68bd2611a67a7884176ee30b57d12e0b6d8e2cae1234d55e13"
	, "jvm-callables-20260919": "5a12f508e4cec7ebeb46e765f75e6b684620485a5984ee156e3fbf199ed4554e"
});

/**
 * Read exact historical bytes, not a receipt regenerated from current sources.
 *
 * @param name - Pinned historical receipt name without its extension.
 */
export const readJvmHistoricalEvidence = async name => {
	assert.ok(Object.hasOwn(jvmHistoricalReceipts, name), `Unknown historical JVM receipt: ${name}`);
	const bytes = await readFile(`docs/evidence/${name}.json`);
	assert.equal(sha256(bytes), jvmHistoricalReceipts[name], `Historical receipt changed: ${name}`);
	return JSON.parse(bytes);
};

/**
 * Check an unchanged source or its explicit old-to-current evidence lineage.
 * The current Kotlin receipt separately verifies every replacement source and run.
 *
 * @param name - Historical receipt owning the old hash.
 * @param path - Repository-relative source path.
 * @param expected - Historical SHA-256, never rewritten to the current value.
 */
export const assertJvmHistoricalSource = async (name, path, expected) => {
	const current = sha256(await readFile(path));
	if(current === expected) return;
	const historical = await readJvmHistoricalEvidence(name);
	const original = historical.sourceHashes[path] ?? historical.regressions?.find(run => run.test === path)?.sourceSha256;
	assert.equal(original, expected, `Source does not belong to historical receipt: ${path}`);
	const record = JSON.parse(await readFile("docs/evidence/kotlin-collections-20260922.json"));
	const lineage = record.sourceLineage[name];
	assert.equal(lineage?.receiptSha256, jvmHistoricalReceipts[name], name);
	assert.deepEqual(lineage.sources[path], { previousSha256: expected, currentSha256: current }, path);
	assert.equal(record.sourceHashes[path], current, `Replacement source lacks current evidence: ${path}`);
};
