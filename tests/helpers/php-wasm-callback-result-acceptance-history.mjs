/**
 * Authenticate and reverse the PHP-Wasm callback-result acceptance transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";

export const phpWasmCallbackResultHistoryPath
	= "docs/evidence/php-wasm-callback-result-acceptance-source-history-20261003.json";
export const phpWasmCallbackResultHistorySha256 = "2f166a7605432483c404e078ede7c36c00c73056c3908971ae4d172c889f804d";
export const phpWasmCallbackResultBaseline = "146cff24d74eabc00a53cbda7cedfea0be7dbb0e";
export const phpWasmCallbackResultIntegration = "39a82da8a81730db7d576b706011f20ea4a29892";
export const phpWasmCallbackResultLineage = Object.freeze([
	"c38ebca1a71782482f5872ec3d9691ec74a6168c"
	, phpWasmCallbackResultIntegration
]);
export const phpWasmCallbackResultPrevious = Object.freeze({
	path: "docs/evidence/wit-callback-installed-acceptance-source-history-20261003.json"
	, sha256: "394ccc991f9371c50d2bb9fb3c3a9ede83459acacaaebcb2d57888f0cc802c7f"
});
export const phpWasmCallbackResultReceipt = Object.freeze({
	path: "docs/evidence/owned-php-wasm-callback-results-20261003.json"
	, sha256: "50a7bf4e3b83db76530c5e4983a7a4eb4fd348d001ea17e3ff747b1e69314ddb"
});
export const phpWasmCallbackResultModifiedPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, "docs/php.md"
	, "docs/publish/php.md"
	, "docs/type-surface.v1.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/analyze/export-configuration.mjs"
	, "src/backends/php/owned-zend-borrows.mjs"
	, "src/backends/php/owned-zend-callbacks.mjs"
	, "src/backends/php/owned-zend-extension.mjs"
	, "src/backends/php/owned-zend-model.mjs"
	, "src/backends/php/owned-zend-php.mjs"
	, "src/backends/php/owned-zend-readme.mjs"
	, "src/build/elaborated-component.mjs"
	, "src/build/multi-profile-project.mjs"
	, "src/build/php-wasm-copied-artifacts.mjs"
	, "src/build/php-wasm-copied-component.mjs"
	, "src/build/php-wasm-owned-component.mjs"
	, "src/build/php-wasm-owned-model.mjs"
	, "src/build/php-wasm-project.mjs"
	, "src/release/php-wasm-copied-package.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/native-ci-isolation.mjs"
	, "tests/helpers/owned-php-wasm-packages.mjs"
	, "tests/test-profiles.test.mjs"
	, "tests/type-surface.test.mjs"
].sort());
export const phpWasmCallbackResultIntroducedPaths = Object.freeze([
	"docs/evidence/owned-php-wasm-callback-results-20261003.json"
	, "docs/evidence/owned-php-wasm-callback-results-20261003.md"
	, "scripts/record-owned-php-wasm-callback-results.mjs"
	, "tests/helpers/owned-php-wasm-callback-result-evidence.mjs"
	, "tests/owned-php-wasm-callback-result-evidence.test.mjs"
	, "tests/owned-php-wasm-callback-results.test.mjs"
].sort());
export const phpWasmCallbackResultReaderPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/backends/php/owned-zend-borrows.mjs"
	, "src/backends/php/owned-zend-callbacks.mjs"
	, "src/backends/php/owned-zend-model.mjs"
	, "src/backends/php/owned-zend-php.mjs"
	, "src/backends/php/owned-zend-readme.mjs"
	, "tests/helpers/copied-fixture-source-history.mjs"
	, "tests/helpers/native-fork-repair-evidence.mjs"
	, "tests/helpers/owned-aggregate-evidence.mjs"
	, "tests/helpers/owned-cpp-evidence.mjs"
	, "tests/helpers/owned-dotnet-process-evidence.mjs"
	, "tests/helpers/owned-host-evidence.mjs"
	, "tests/helpers/owned-jvm-package-evidence.mjs"
	, "tests/helpers/owned-package-evidence.mjs"
	, "tests/helpers/owned-php-wasm-callback-result-evidence.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-acceptance.mjs"
	, "tests/helpers/php-callback-acceptance-history-tests.mjs"
	, "tests/helpers/owned-php-callback-result-acceptance.mjs"
	, "tests/helpers/owned-php-receiver-package-evidence.mjs"
	, "tests/helpers/owned-php-wasm-borrow-evidence.mjs"
	, "tests/helpers/owned-python-evidence.mjs"
	, "tests/helpers/owned-rust-evidence.mjs"
	, "tests/helpers/post-perl-callback-staging-history.mjs"
	, "tests/helpers/wit-callback-installed-acceptance-history.mjs"
	, "tests/helpers/wit-callback-acceptance-history-tests.mjs"
	, "tests/helpers/wit-owned-projection-history.mjs"
	, "tests/helpers/wit-recursive-callable-evidence.mjs"
	, "tests/owned-analysis-evidence.test.mjs"
	, "tests/owned-javascript-coexistence-evidence.test.mjs"
	, "tests/owned-javascript-npm-evidence.test.mjs"
	, "tests/owned-javascript-wasm-evidence.test.mjs"
	, "tests/owned-jvm-receiver-gc-evidence.test.mjs"
	, "tests/owned-perl-package-evidence.test.mjs"
	, "tests/owned-php-callback-result-packaging.test.mjs"
	, "tests/owned-php-wasm-receiver-documentation.test.mjs"
	, "tests/owned-php-wasm-evidence.test.mjs"
	, "tests/owned-php-wasm-callback-result-evidence.test.mjs"
	, "tests/perl-contract-repair-evidence.test.mjs"
].sort());
export const phpWasmCallbackResultNormalizationPaths = Object.freeze([...new Set([
	...phpWasmCallbackResultModifiedPaths, ...phpWasmCallbackResultReaderPaths
])].sort());
const categories = Object.freeze({
	".github/workflows/consumer-matrix.yml": "administrative"
	, "docs/evidence/owned-php-wasm-callback-results-20261003.json": "receipt"
	, "docs/evidence/owned-php-wasm-callback-results-20261003.md": "documentation"
	, "docs/php.md": "documentation"
	, "docs/publish/php.md": "documentation"
	, "docs/type-surface.v1.json": "administrative"
	, "package.json": "administrative"
	, "scripts/record-owned-php-wasm-callback-results.mjs": "recorder"
	, "src/adoption/test-profiles.mjs": "administrative"
	, "src/analyze/export-configuration.mjs": "implementation"
	, "src/backends/php/owned-zend-borrows.mjs": "implementation"
	, "src/backends/php/owned-zend-callbacks.mjs": "implementation"
	, "src/backends/php/owned-zend-extension.mjs": "implementation"
	, "src/backends/php/owned-zend-model.mjs": "implementation"
	, "src/backends/php/owned-zend-php.mjs": "implementation"
	, "src/backends/php/owned-zend-readme.mjs": "implementation"
	, "src/build/elaborated-component.mjs": "implementation"
	, "src/build/multi-profile-project.mjs": "implementation"
	, "src/build/php-wasm-copied-artifacts.mjs": "implementation"
	, "src/build/php-wasm-copied-component.mjs": "implementation"
	, "src/build/php-wasm-owned-component.mjs": "implementation"
	, "src/build/php-wasm-owned-model.mjs": "implementation"
	, "src/build/php-wasm-project.mjs": "implementation"
	, "src/release/php-wasm-copied-package.mjs": "implementation"
	, "tests/documentation.test.mjs": "test"
	, "tests/helpers/copied-fixture-source-history.mjs": "reader"
	, "tests/helpers/native-ci-isolation.mjs": "reader"
	, "tests/helpers/native-fork-repair-evidence.mjs": "reader"
	, "tests/helpers/owned-aggregate-evidence.mjs": "reader"
	, "tests/helpers/owned-cpp-evidence.mjs": "reader"
	, "tests/helpers/owned-dotnet-process-evidence.mjs": "reader"
	, "tests/helpers/owned-host-evidence.mjs": "reader"
	, "tests/helpers/owned-jvm-package-evidence.mjs": "reader"
	, "tests/helpers/owned-package-evidence.mjs": "reader"
	, "tests/helpers/owned-php-wasm-callback-result-evidence.mjs": "reader"
	, "tests/helpers/owned-php-wasm-packages.mjs": "test"
	, "tests/helpers/owned-perl-callback-result-variant-acceptance.mjs": "reader"
	, "tests/helpers/php-callback-acceptance-history-tests.mjs": "reader"
	, "tests/helpers/owned-php-callback-result-acceptance.mjs": "reader"
	, "tests/helpers/owned-php-receiver-package-evidence.mjs": "reader"
	, "tests/helpers/owned-php-wasm-borrow-evidence.mjs": "reader"
	, "tests/helpers/owned-python-evidence.mjs": "reader"
	, "tests/helpers/owned-rust-evidence.mjs": "reader"
	, "tests/helpers/post-perl-callback-staging-history.mjs": "reader"
	, "tests/helpers/wit-callback-installed-acceptance-history.mjs": "reader"
	, "tests/helpers/wit-callback-acceptance-history-tests.mjs": "reader"
	, "tests/helpers/wit-owned-projection-history.mjs": "reader"
	, "tests/helpers/wit-recursive-callable-evidence.mjs": "reader"
	, "tests/owned-analysis-evidence.test.mjs": "reader"
	, "tests/owned-javascript-coexistence-evidence.test.mjs": "reader"
	, "tests/owned-javascript-npm-evidence.test.mjs": "reader"
	, "tests/owned-javascript-wasm-evidence.test.mjs": "reader"
	, "tests/owned-jvm-receiver-gc-evidence.test.mjs": "reader"
	, "tests/owned-perl-package-evidence.test.mjs": "reader"
	, "tests/owned-php-callback-result-packaging.test.mjs": "reader"
	, "tests/owned-php-wasm-receiver-documentation.test.mjs": "reader"
	, "tests/owned-php-wasm-evidence.test.mjs": "reader"
	, "tests/owned-php-wasm-callback-result-evidence.test.mjs": "reader"
	, "tests/perl-contract-repair-evidence.test.mjs": "reader"
	, "tests/owned-php-wasm-callback-results.test.mjs": "test"
	, "tests/test-profiles.test.mjs": "test"
	, "tests/type-surface.test.mjs": "test"
});
const scope = Object.freeze({
	stage: "php-wasm-callback-result-acceptance"
	, acceptanceReceipt: true
	, compiledLean: true
	, installedNpm: true
	, installedComposer: true
	, nodeExecution: true
	, chromiumExecution: true
	, ciRequired: true
	, documentationPublished: true
	, producerRerun: true
	, registryPublication: false
	, supportPromotions: 4
});
const keys = (value, names) => assert.deepEqual(Object.keys(value).sort(), names.split(" ").sort());
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const freeze = value => {
	if(value && typeof value === "object")
	{ Object.values(value).forEach(freeze); Object.freeze(value); }
	return value;
};
let history;

/**
 * Validate the closed integration and successor-reader transition.
 *
 * @param record - Candidate authenticated history record.
 */
export const assertPhpWasmCallbackResultHistory = record => {
	keys(record, "schemaVersion kind baselineRevision integrationRevision lineage previous completedReceipt scope updates readerUpdates introducedSources");
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.kind, "php-wasm-callback-result-acceptance-source-history");
	assert.equal(record.baselineRevision, phpWasmCallbackResultBaseline);
	assert.equal(record.integrationRevision, phpWasmCallbackResultIntegration);
	assert.deepEqual(record.lineage, phpWasmCallbackResultLineage);
	assert.deepEqual(record.previous, phpWasmCallbackResultPrevious);
	assert.deepEqual(record.completedReceipt, phpWasmCallbackResultReceipt);
	assert.deepEqual(record.scope, scope);
	assert.deepEqual(record.updates.map(update => update.path), phpWasmCallbackResultModifiedPaths);
	assert.deepEqual(record.readerUpdates.map(update => update.path), phpWasmCallbackResultReaderPaths);
	for(const update of [...record.updates, ...record.readerUpdates])
	{
		keys(update, "path category currentSha256 previousSha256 strategy edits");
		assert.equal(update.category, categories[update.path]);
		digest(update.currentSha256); digest(update.previousSha256);
		assert.notEqual(update.currentSha256, update.previousSha256);
		const expected = update.path !== "docs/type-surface.v1.json" ? "spans"
			: record.readerUpdates.includes(update) ? "source-hashes" : "inventory";
		assert.equal(update.strategy, expected); assert.ok(update.edits.length > 0);
		let end = 0;
		for(const edit of update.edits)
			if(update.strategy === "source-hashes" || edit.kind === "source-hash")
			{
				keys(edit, update.strategy === "inventory"
					? "kind path current previous count" : "path current previous count");
				digest(edit.current); digest(edit.previous);
				assert.ok(Number.isSafeInteger(edit.count) && edit.count > 0);
			} else if(update.strategy === "inventory")
			{
				keys(edit, "kind id currentSha256");
				assert.ok(["evidence", "observation"].includes(edit.kind));
				assert.equal(typeof edit.id, "string"); digest(edit.currentSha256);
			} else
			{
				keys(edit, "start current previous");
				assert.ok(Number.isSafeInteger(edit.start) && edit.start >= end);
				assert.equal(typeof edit.current, "string"); assert.equal(typeof edit.previous, "string");
				assert.notEqual(edit.current, edit.previous); end = edit.start + edit.current.length;
			}
	}
	assert.deepEqual(Object.keys(record.introducedSources), phpWasmCallbackResultIntroducedPaths);
	for(const [path, identity] of Object.entries(record.introducedSources))
	{
		keys(identity, "integrationSha256 currentSha256");
		digest(identity.integrationSha256); digest(identity.currentSha256);
		assert.equal(categories[path] === undefined, false);
	}
};

/** Load the immutable source-history record. */
export const readPhpWasmCallbackResultHistory = () => {
	if(history === undefined)
	{
		const bytes = readFileSync(phpWasmCallbackResultHistoryPath);
		assert.equal(sha256(bytes), phpWasmCallbackResultHistorySha256);
		const record = JSON.parse(bytes); assertPhpWasmCallbackResultHistory(record);
		for(const predecessor of [record.previous, record.completedReceipt])
			assert.equal(sha256(readFileSync(predecessor.path)), predecessor.sha256);
		history = freeze(record);
	}
	return history;
};

/**
 * Reverse one exact recorded source transition.
 *
 * @param source - Complete current source bytes or text.
 * @param update - Exact authenticated update to reverse.
 * @param category - Integration or successor-reader collection.
 */
export const reversePhpWasmCallbackResultUpdate = (source, update, category = "updates") => {
	assert.ok(["readerUpdates", "updates"].includes(category));
	const recorded = readPhpWasmCallbackResultHistory()[category].find(value => value.path === update.path);
	assert.ok(recorded, update.path); assert.deepEqual(update, recorded);
	assert.equal(sha256(source), update.currentSha256, update.path);
	let previous = source.toString();
	if(update.strategy === "inventory")
	{
		const document = JSON.parse(previous);
		for(const edit of update.edits.filter(value => value.kind !== "source-hash"))
		{
			const name = edit.kind === "evidence" ? "evidence" : "observations";
			const index = document[name].findIndex(value => value.id === edit.id);
			assert.notEqual(index, -1, edit.id);
			assert.equal(sha256(canonicalJson(document[name][index])), edit.currentSha256);
			document[name].splice(index, 1);
		}
		for(const edit of update.edits.filter(value => value.kind === "source-hash"))
		{
			let count = 0;
			for(const evidence of document.evidence) for(const file of evidence.files)
				if(file.path === edit.path && file.sha256 === edit.current)
				{ file.sha256 = edit.previous; count++; }
			assert.equal(count, edit.count, edit.path);
		}
		previous = JSON.stringify(document, null, 2) + "\n";
	} else if(update.strategy === "source-hashes")
		for(const edit of update.edits)
		{
			assert.equal(previous.split(edit.current).length - 1, edit.count);
			previous = previous.replaceAll(edit.current, edit.previous);
		}
	else
	{
		const parts = []; let end = 0;
		for(const edit of update.edits)
		{
			assert.equal(previous.slice(edit.start, edit.start + edit.current.length), edit.current);
			parts.push(previous.slice(end, edit.start), edit.previous); end = edit.start + edit.current.length;
		}
		parts.push(previous.slice(end)); previous = parts.join("");
	}
	assert.equal(sha256(previous), update.previousSha256, update.path); return previous;
};

/**
 * Peel this acceptance layer while preserving historical and unknown bytes.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current, historical or unknown source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforePhpWasmCallbackResultAcceptance = (path, source, expected) => {
	for(const category of ["readerUpdates", "updates"])
	{
		const update = readPhpWasmCallbackResultHistory()[category].find(value => value.path === path);
		const current = sha256(source);
		if(update && current !== expected && current === update.currentSha256)
			source = reversePhpWasmCallbackResultUpdate(source, update, category);
	}
	return source;
};
