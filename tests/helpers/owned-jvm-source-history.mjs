/**
 * Preserve exact predecessor evidence across owned Java/Kotlin Maven integration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeJvmProbeRepair, jvmProbeRepairChangedPaths } from "./jvm-probe-repair-history.mjs";
import { ownedPerlNormalizationPaths } from "./owned-perl-source-history.mjs";

export const ownedJvmBaseline = "4ae2450fd9dfd164486970993d0923e667c18bbf";
export const ownedJvmHistoryPath = "docs/evidence/owned-jvm-integration-20260927.json";
export const ownedJvmExecutionPath = "docs/evidence/owned-jvm-execution-20260927.json";
export const ownedJvmChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/architecture/binding-ir.md"
	, "docs/consume/java.md"
	, "docs/consume/kotlin.md"
	, "docs/contributing/testing.md"
	, "docs/lean/export-decisions.md"
	, "docs/publish/maven.md"
	, "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/jvm/callables.mjs"
	, "src/backends/jvm/copied-assets.mjs"
	, "src/backends/jvm/copied-graph-assets.mjs"
	, "src/build/compile-jvm-sources.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-project.mjs"
	, "tests/documentation.test.mjs"
	, "tests/fixtures/structured-types/recursive-jvm-loading.java"
	, "tests/fixtures/type-corpus/consumers/Wire.java"
	, "tests/helpers/jvm-graph-loading.mjs"
	, "tests/helpers/jvm-structured-callable-regression.mjs"
	, "tests/helpers/managed-ci-isolation-evidence.mjs"
	, "tests/helpers/managed-ci-isolation-history.mjs"
	, "tests/helpers/native-fork-repair-history.mjs"
	, "tests/helpers/type-corpus-jvm.mjs"
	, "tests/java-collection-evidence.test.mjs"
	, "tests/jvm-graph-package.test.mjs"
	, "tests/jvm-recursive-callable-contract.test.mjs"
	, "tests/jvm-structured-callable-contract.test.mjs"
	, "tests/kotlin-collection-evidence.test.mjs"
	, "tests/managed-ci-isolation-evidence.test.mjs"
	, "tests/managed-ci-isolation.test.mjs"
	, "tests/owned-c-packaging.test.mjs"
];
export const ownedJvmGeneratedPaths = ["aliases", "callables", "collections", "compounds", "lists", "variants"]
	.flatMap(name => ["KotlinRuntime", "NativeAssets", "Runtime"].map(type =>
		`src/main/java/org/leanbridge/${name}/${type}.java`)).sort();
export const ownedJvmSortedGeneratedPaths = ["KotlinRuntime", "Runtime"]
	.map(type => `src/main/java/org/leanbridge/collections/${type}.java`);
export const ownedJvmAddedPaths = [
	"docs/evidence/owned-jvm-calls-20260927.json"
	, "docs/evidence/owned-jvm-calls-20260927.md"
	, "docs/evidence/owned-jvm-conversions-20260927.json"
	, "docs/evidence/owned-jvm-conversions-20260927.md"
	, "docs/evidence/owned-jvm-execution-20260927.json"
	, "docs/evidence/owned-jvm-kotlin-values-20260927.md"
	, "docs/evidence/owned-jvm-packages-20260927.md"
	, "docs/evidence/owned-jvm-runtime-20260927.json"
	, "docs/evidence/owned-jvm-runtime-20260927.md"
	, "docs/evidence/owned-jvm-values-20260927.md"
	, "src/backends/jvm/owned-callables.mjs"
	, "src/backends/jvm/owned-calls.mjs"
	, "src/backends/jvm/owned-conversion-runtime.mjs"
	, "src/backends/jvm/owned-conversions.mjs"
	, "src/backends/jvm/owned-kotlin.mjs"
	, "src/backends/jvm/owned-layout.mjs"
	, "src/backends/jvm/owned-package.mjs"
	, "src/backends/jvm/owned-runtime.mjs"
	, "src/backends/jvm/owned-scalars.mjs"
	, "src/backends/jvm/owned-thread-exit.mjs"
	, "src/backends/jvm/owned-values.mjs"
	, "src/backends/jvm/verified-assets.mjs"
	, "src/build/owned-jvm-artifacts.mjs"
	, "src/build/owned-jvm-projection.mjs"
	, "src/release/owned-maven.mjs"
	, "tests/fixtures/ci/native-acceptance-before-isolation.json"
	, "tests/fixtures/structured-types/OwnedInstalledAssetsProbe.java"
	, "tests/fixtures/structured-types/OwnedInstalledSupport.java"
	, "tests/fixtures/structured-types/OwnedRuntimeProbe.java"
	, "tests/fixtures/structured-types/OwnedValueProbe.java"
	, "tests/fixtures/structured-types/VerifiedJvmAssetsProbe.java"
	, "tests/fixtures/structured-types/owned-installed-kotlin-compositions.kt"
	, "tests/fixtures/structured-types/owned-jvm-callback-scalars.java"
	, "tests/fixtures/structured-types/owned-jvm-callback-signatures.java"
	, "tests/fixtures/structured-types/owned-jvm-callback-values.java"
	, "tests/fixtures/structured-types/owned-jvm-calls.java"
	, "tests/fixtures/structured-types/owned-jvm-coexistence.java"
	, "tests/fixtures/structured-types/owned-jvm-compositions.java"
	, "tests/fixtures/structured-types/owned-jvm-conversions.java"
	, "tests/fixtures/structured-types/owned-jvm-scalars.java"
	, "tests/fixtures/structured-types/owned-kotlin-callback-scalars.kt"
	, "tests/fixtures/structured-types/owned-kotlin-callback-signatures.kt"
	, "tests/fixtures/structured-types/owned-kotlin-callback-values.kt"
	, "tests/fixtures/structured-types/owned-kotlin-coexistence.kt"
	, "tests/fixtures/structured-types/owned-kotlin-scalars.kt"
	, "tests/fixtures/structured-types/owned-kotlin-values.kt"
	, "tests/helpers/native-ci-isolation.mjs"
	, "tests/helpers/owned-jvm-call-evidence.mjs"
	, "tests/helpers/owned-jvm-call-fixture.mjs"
	, "tests/helpers/owned-jvm-ci.mjs"
	, "tests/helpers/owned-jvm-conversion-calls.mjs"
	, "tests/helpers/owned-jvm-conversion-evidence.mjs"
	, "tests/helpers/owned-jvm-conversion-native.mjs"
	, "tests/helpers/owned-jvm-installed-assets.mjs"
	, "tests/helpers/owned-jvm-installed-signatures.mjs"
	, "tests/helpers/owned-jvm-installed.mjs"
	, "tests/helpers/owned-jvm-package-evidence.mjs"
	, "tests/helpers/owned-jvm-package-tamper.mjs"
	, "tests/helpers/owned-jvm-runtime-evidence.mjs"
	, "tests/helpers/owned-jvm-runtime-native.mjs"
	, "tests/helpers/owned-jvm-source-history.mjs"
	, "tests/native-ci-isolation.test.mjs"
	, "tests/owned-jvm-call-evidence.test.mjs"
	, "tests/owned-jvm-calls.test.mjs"
	, "tests/owned-jvm-ci.test.mjs"
	, "tests/owned-jvm-coexistence.test.mjs"
	, "tests/owned-jvm-conversion-evidence.test.mjs"
	, "tests/owned-jvm-conversions.test.mjs"
	, "tests/owned-jvm-documentation.test.mjs"
	, "tests/owned-jvm-kotlin.test.mjs"
	, "tests/owned-jvm-layout.test.mjs"
	, "tests/owned-jvm-package-evidence.test.mjs"
	, "tests/owned-jvm-package.test.mjs"
	, "tests/owned-jvm-packaging.test.mjs"
	, "tests/owned-jvm-runtime-evidence.test.mjs"
	, "tests/owned-jvm-runtime.test.mjs"
	, "tests/owned-jvm-values.test.mjs"
	, "tests/verified-jvm-assets.test.mjs"
];
let cached;
const record = () => cached ??= JSON.parse(readFileSync(ownedJvmHistoryPath, "utf8"));

/**
 * Reverse ordered literal edits after authenticating both complete file identities.
 *
 * @param source - Complete current source text.
 * @param update - Exact current and previous hashes with nonoverlapping edits.
 */
export const reverseOwnedJvmUpdate = (source, update) => {
	assert.ok(ownedJvmChangedPaths.includes(update.path) || ownedJvmGeneratedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	const chunks = []; let end = 0;
	for(const { start, current, previous } of update.edits)
	{
		assert.ok(Number.isSafeInteger(start) && start >= end);
		assert.equal(typeof current, "string"); assert.equal(typeof previous, "string");
		assert.notEqual(current, previous);
		assert.equal(source.slice(start, start + current.length), current);
		chunks.push(source.slice(end, start), previous); end = start + current.length;
	}
	chunks.push(source.slice(end)); const restored = chunks.join("");
	assert.equal(sha256(restored), update.previousSha256, update.path);
	return restored;
};

/**
 * Restore only an authenticated predecessor; retain unknown edits for rejection.
 *
 * @param path - Exact repository-relative source path.
 * @param source - Complete current or historical text.
 * @param expected - Optional requested identity at which normalization stops.
 */
export const beforeOwnedJvmPackages = (path, source, expected) => {
	source = beforeJvmProbeRepair(path, source, expected);
	if(typeof source === "string" && !ownedJvmChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected || !ownedJvmChangedPaths.includes(path)) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseOwnedJvmUpdate(source, update) : source;
};

export const ownedJvmNormalizationPaths = [...new Set([...ownedJvmChangedPaths, ...jvmProbeRepairChangedPaths, ...ownedPerlNormalizationPaths])].sort();

/**
 * Normalize declared text only and preserve unrelated binary data byte-for-byte.
 *
 * @param path - Exact repository-relative source path.
 * @param bytes - Complete current or historical bytes.
 * @param expected - Optional requested identity.
 */
export const ownedJvmHistoricalBytes = (path, bytes, expected) => ownedJvmNormalizationPaths.includes(path)
	? beforeOwnedJvmPackages(path, bytes.toString("utf8"), expected) : bytes;

/**
 * Restore a generated predecessor only when both complete identities match.
 *
 * @param path - Generated Java package-relative path.
 * @param source - Complete current generated source.
 * @param expected - Frozen predecessor SHA-256.
 */
export const beforeOwnedJvmGenerated = (path, source, expected) => {
	if(typeof source === "string" && !ownedJvmGeneratedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected || !ownedJvmGeneratedPaths.includes(path)) return source;
	const history = record();
	const update = [...history.generatedUpdates, ...(history.generatedSortedUpdates ?? [])].find(item => item.path === path
		&& item.currentSha256 === digest && item.previousSha256 === expected);
	return update ? reverseOwnedJvmUpdate(source, update) : source;
};
