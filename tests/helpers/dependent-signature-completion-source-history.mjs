/**
 * Reverse the complete direct dependent-signature rollout.
 *
 * The rollout spans twelve first-parent commits. Every modified source state
 * remains independently reversible so retained evidence can stop at the exact
 * producer that observed it.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentSignatureCompletionHistoryPath
	= "docs/evidence/dependent-signature-completion-source-history-20261028.json";
export const dependentSignatureCompletionPredecessor
	= "f311acff4ab598b6332155a209a10ba8620719ee";
export const dependentSignatureCompletionImplementation
	= "0aaf055668c7b28b4009ae07a224b637ec470c7c";
export const dependentSignatureCompletionCommits = Object.freeze([
	"4781b28fb4c1fdeb0bf56006a27a6f7004d60c17"
	, "f0d486e4328fc84d07ea8f6f5b14e5cccd61442a"
	, "37fdcd34bfc1eccd0d4649728992d0a1a03ea680"
	, "797cf4ea8f7dcb83c308f59a9fc618b5883ba27a"
	, "5226e8c2b0713c8496746664e0b2eb97f01272d1"
	, "3dde61d323121efbd1b3d6631e7c1161643ea7d4"
	, "748bf7350e634cdcf64fd9a144c8bf3a99aaeaad"
	, "ffb032059b671d39cb7dbf4c851733141ac4d227"
	, "f1d25fb1a0c22d06ef0bb2295ec581527a75e69f"
	, "b83449a69bb6b212cf3cfd500fbb618eea13b617"
	, "7c5e7210fbc457add9352ff6b6cb1d6807737b17"
	, dependentSignatureCompletionImplementation
]);
export const dependentSignatureCompletionChangedPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, ".github/workflows/perl-consumer.yml"
	, "schema/compiler-adapter-plan.schema.json"
	, "schema/elaborated-export-metadata.schema.json"
	, "schema/native-metadata-type.schema.json"
	, "src/abi/refinements.mjs"
	, "src/adoption/test-profiles.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/checked-refinement-selection.mjs"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/native-types.mjs"
	, "src/analyze/reviewed-refinements.mjs"
	, "src/analyze/reviewed-subtypes.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, "src/backends/c/native-graph-adapters.mjs"
	, "src/backends/dotnet/copied-values.mjs"
	, "src/backends/javascript/generate.mjs"
	, "src/backends/jvm/copied-values.mjs"
	, "src/backends/native/fin-refinements.mjs"
	, "src/backends/perl/generate.mjs"
	, "src/backends/php/copied-values.mjs"
	, "src/backends/python/refinements.mjs"
	, "src/backends/ruby/copied-values.mjs"
	, "src/backends/rust/copied-values.mjs"
	, "src/backends/wit/fin-refinements.mjs"
	, "src/build/compiler-adapters.mjs"
	, "src/build/component-callable-adapters.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/native-artifacts.mjs"
	, "src/build/native-model.mjs"
	, "tests/helpers/dependent-signature-foundation-tests.mjs"
	, "tests/helpers/managed-dependent-fin.mjs"
	, "tests/managed-dependent-fin.test.mjs"
]);
export const dependentSignatureCompletionImplementationAddedPaths
	= Object.freeze([
		"tests/dependent-fin-javascript.test.mjs"
		, "tests/fixtures/dependent-fin-consumers/c.c"
		, "tests/fixtures/dependent-fin-consumers/cpp.cpp"
		, "tests/fixtures/dependent-fin-consumers/dotnet.cs"
		, "tests/fixtures/dependent-fin-consumers/java.java"
		, "tests/fixtures/dependent-fin-consumers/javascript.mjs"
		, "tests/fixtures/dependent-fin-consumers/kotlin.kt"
		, "tests/fixtures/dependent-fin-consumers/perl.pl"
		, "tests/fixtures/dependent-fin-consumers/php-native.php"
		, "tests/fixtures/dependent-fin-consumers/python.py"
		, "tests/fixtures/dependent-fin-consumers/ruby.rb"
		, "tests/fixtures/dependent-fin-consumers/rust.rs"
		, "tests/fixtures/dependent-fin-consumers/wit-wasi.c"
		, "tests/fixtures/onboarding/dependent-signatures/DependentSignatures.lean"
		, "tests/fixtures/onboarding/dependent-signatures/LICENSE"
		, "tests/fixtures/onboarding/dependent-signatures/lakefile.toml"
		, "tests/fixtures/onboarding/dependent-signatures/lean-toolchain"
		, "tests/fixtures/onboarding/dependent-signatures/package.json"
		, "tests/fixtures/onboarding/native-dependent-fin/DependentFin.lean"
		, "tests/fixtures/onboarding/native-dependent-fin/LICENSE"
		, "tests/fixtures/onboarding/native-dependent-fin/lakefile.toml"
		, "tests/fixtures/onboarding/native-dependent-fin/lean-toolchain"
		, "tests/fixtures/onboarding/native-dependent-fin/package.json"
		, "tests/helpers/dependent-fin-javascript-install.mjs"
		, "tests/helpers/dependent-fin-javascript-tests.mjs"
		, "tests/helpers/dependent-fin-javascript.mjs"
		, "tests/helpers/dependent-signature-extractor-tests.mjs"
		, "tests/helpers/dependent-signature-fixture-tests.mjs"
		, "tests/helpers/dependent-signature-fixture.mjs"
		, "tests/helpers/dependent-signature-foundation-tests.mjs"
		, "tests/helpers/managed-dependent-fin.mjs"
		, "tests/managed-dependent-fin.test.mjs"
	]);
export const dependentSignatureCompletionIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const dependentSignatureCompletionNormalizationPaths = Object.freeze([
	...dependentSignatureCompletionChangedPaths
	, ...dependentSignatureCompletionIntegrationPaths
]);
export const dependentSignatureCompletionHistoryAddedPaths = Object.freeze([
	"scripts/refresh-dependent-signature-completion-pins.mjs"
	, "scripts/update-dependent-signature-completion-source-history.mjs"
	, "tests/helpers/dependent-signature-completion-source-history-tests.mjs"
	, "tests/helpers/dependent-signature-completion-source-history.mjs"
]);
export const dependentSignatureCompletionAddedPaths = Object.freeze([
	...dependentSignatureCompletionImplementationAddedPaths
	, ...dependentSignatureCompletionHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentSignatureCompletionHistoryPath, "utf8"
));
const paths = new Set(dependentSignatureCompletionNormalizationPaths);

/**
 * Restore one exact first-parent or integration transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact authenticated source transition.
 */
export const reverseDependentSignatureCompletionUpdate = (source, update) => {
	assert.ok(paths.has(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove every matching dependent-signature transition, newest first.
 * Stop at an explicitly requested authenticated intermediate digest.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDependentSignatureCompletionSource = (
	path, source, expected
) => {
	if(typeof source !== "string" || !paths.has(path)) return source;
	let current = source;
	const updates = [...record().integrationUpdates, ...record().updates];
	while(true)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseDependentSignatureCompletionUpdate(current, update);
	}
};
