/**
 * Connect unchanged collection receipts to measured recursive-backend updates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { verifyAddedTestRegistrations } from "./test-registration-history.mjs";
import { assertJvmSharedRegressionEvidence } from "./jvm-shared-regression-receipt.mjs";
import { assertNativeGraphJvmRegression } from "./native-graph-jvm-regression.mjs";
import { assertPhpWasmSharedSourceTransition } from "./php-wasm-shared-regression-receipt.mjs";
import { beforeWitPackageIntegration } from "./wit-package-source-history.mjs";

const kotlinPath = "tests/kotlin-collection-evidence.test.mjs";
const phpPath = "tests/php-wasm-collection-evidence.test.mjs";
const changedJvm = ["src/build/compile-jvm-sources.mjs"
	, "src/build/native-c-projection.mjs", "src/build/native-jvm-artifacts.mjs"
	, "src/build/native-jvm-projection.mjs", "src/build/native-project.mjs"
	, "src/release/native-maven.mjs"];
const sharedJvm = ["src/build/native-c-projection.mjs", "src/build/native-project.mjs"];
const changes = {
	[kotlinPath]: [
		['import { assertCurrentKotlinCollectionSources } from "./helpers/current-collection-evidence.mjs";\n', 'import { assertRecursiveSourceHistory } from "./helpers/recursive-source-history.mjs";\n']
		, ['await assertCurrentKotlinCollectionSources(record);', 'for(const [path, hash] of Object.entries(record.sourceHashes)) await assertRecursiveSourceHistory("kotlin-collections-20260922", path, hash);']
	]
	, [phpPath]: [
		['import { assertCurrentPhpWasmCollectionSources } from "./helpers/current-collection-evidence.mjs";\n', ""]
		, ['await assertCurrentPhpWasmCollectionSources(record);', 'for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);\n\tfor(const [path, hash] of Object.entries(record.generatorSourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);']
	]
};

/**
 * Restore only the source-check upgrade, leaving every execution assertion intact.
 *
 * @param path - Exact upgraded collection test path.
 * @param source - Complete current test source.
 */
export const beforeCurrentCollectionVerification = (path, source) => {
	const edits = changes[path];
	if(!edits || edits.every(([current]) => !source.includes(current))) return source;
	for(const [current, previous] of edits)
	{
		assert.equal(source.split(current).length, 2, "Exactly one collection-source verifier upgrade");
		source = source.replace(current, previous);
	}
	return source;
};

/**
 * Retain the original Kotlin observations and authenticate both later JVM runs.
 * The installed test bodies, generated callers and failure probes do not change.
 *
 * @param original - Unchanged Kotlin collection receipt being checked.
 */
export const assertCurrentKotlinCollectionSources = async original => {
	const history = JSON.parse(await readFile("docs/evidence/recursive-npm-source-lineage-20260922.json"));
	const lineage = history.historicalReceipts["kotlin-collections-20260922"];
	const bytes = await readFile("docs/evidence/kotlin-collections-20260922.json");
	assert.equal(sha256(bytes), lineage.receiptSha256);
	assert.deepEqual(original, JSON.parse(bytes));
	const fresh = JSON.parse(await readFile("docs/evidence/jvm-shared-regressions-20260924.json"));
	const { baseline } = await assertJvmSharedRegressionEvidence(fresh);
	assert.equal(sha256(await readFile(lineage.regression.path)), lineage.regression.sha256);
	assert.deepEqual(baseline, JSON.parse(await readFile(lineage.regression.path)));
	const currentLineage = structuredClone(lineage);
	for(const path of sharedJvm)
	{
		assert.equal(lineage.sources[path].previousSha256, original.sourceHashes[path]);
		// The new compiled run binds current sources. The original regression
		// below still authenticates its own source snapshots and observations.
		currentLineage.sources[path].currentSha256 = fresh.sourceHashes[path];
	}
	await assertNativeGraphJvmRegression(currentLineage, original);
	for(const [path, expected] of Object.entries(original.sourceHashes))
	{
		const source = beforeWitPackageIntegration(path, await readFile(path, "utf8")), actual = sha256(source);
		if(actual === expected) continue;
		if(changedJvm.includes(path))
		{
			assert.equal(actual, fresh.sourceHashes[path], path);
			continue;
		}
		if(path === "src/adoption/test-profiles.mjs")
		{
			assert.equal(lineage.sources[path].previousSha256, expected);
			verifyAddedTestRegistrations(source, lineage.sources[path].currentSha256, history.registrationUpdates);
			continue;
		}
		assert.equal(path, kotlinPath, `Unmeasured collection source change: ${path}`);
		assert.equal(lineage.sources[path].previousSha256, expected);
		assert.equal(sha256(beforeCurrentCollectionVerification(path, source)), lineage.sources[path].currentSha256);
	}
};

/**
 * Require the independently measured PHP-Wasm packaging transition. Preserve
 * the collection archives, original generated sources and execution checks.
 *
 * @param record - Original collection receipt, never rewritten.
 */
export const assertCurrentPhpWasmCollectionSources = async record => {
	const original = JSON.parse(await readFile("docs/evidence/php-wasm-collections-20260922.json"));
	assert.equal(canonicalJson(record), canonicalJson(original));
	for(const sources of [record.sourceHashes, record.generatorSourceHashes])
		for(const [path, expected] of Object.entries(sources))
		{
			const source = await readFile(path, "utf8");
			if(sha256(source) === expected) continue;
			if(path === phpPath)
				assert.equal(sha256(beforeCurrentCollectionVerification(path, source)), expected, path);
			else assert.equal(await assertPhpWasmSharedSourceTransition(path, source, expected), true, path);
		}
};
