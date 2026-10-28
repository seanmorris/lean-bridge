/**
 * Select the four immutable hosted archives that jointly close the remaining
 * 50 copied-field and callback Fin cells.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";

export const finCompletionEvidence = Object.freeze({
	fields: Object.freeze({
		id: "hosted-reviewed-fin-wasm-fields-installed"
		, index: "docs/evidence/reviewed-fin-wasm-entry-hosted-20261028/index.json"
		, kind: "reviewed-fin-wasm-entry-hosted-v1"
		, validators: Object.freeze([
			"tests/helpers/reviewed-fin-wasm-entry-hosted-archive.mjs"
			, "tests/helpers/reviewed-fin-wasm-entry-hosted-evidence.mjs"
			, "tests/reviewed-fin-wasm-entry-hosted-evidence.test.mjs"
		])
	})
	, browserCallbacks: Object.freeze({
		id: "hosted-reviewed-callback-fin-browser-installed"
		, index: "docs/evidence/reviewed-callback-fin-browser-hosted-20261028/index.json"
		, kind: "reviewed-callback-fin-browser-installed-v1"
		, validators: Object.freeze([
			"tests/helpers/reviewed-callback-fin-browser-hosted-archive.mjs"
			, "tests/helpers/reviewed-callback-fin-browser-hosted-evidence.mjs"
			, "tests/reviewed-callback-fin-browser-hosted-evidence.test.mjs"
		])
	})
	, managedCallbacks: Object.freeze({
		id: "hosted-callback-fin-managed-wit-installed"
		, index: "docs/evidence/callback-fin-remaining-hosted-20261028/index.json"
		, kind: "callback-fin-remaining-installed-v1"
		, validators: Object.freeze([
			"tests/helpers/callback-fin-remaining-hosted-archive.mjs"
			, "tests/helpers/callback-fin-remaining-hosted-evidence.mjs"
			, "tests/callback-fin-remaining-hosted-evidence.test.mjs"
		])
	})
	, nativeCallbacks: Object.freeze({
		id: "hosted-callback-fin-native-languages-installed"
		, index: "docs/evidence/callback-fin-native-hosts-hosted-20261028/index.json"
		, kind: "callback-fin-native-hosts-installed-v1"
		, validators: Object.freeze([
			"tests/helpers/callback-fin-native-hosted-archive.mjs"
			, "tests/helpers/callback-fin-native-hosted-evidence.mjs"
			, "tests/callback-fin-native-hosted-evidence.test.mjs"
		])
	})
});

const cells = (profiles, path, positions) => profiles.flatMap(profile =>
	positions.map(position => `${profile}/fin/${path}/${position}`));
const browserProfiles = [
	"browser-javascript", "browser-react", "browser-worker"
];
/** Exact 50-cell completion scope, independent of inventory ordering. */
export const finCompletionTargetCells = Object.freeze([
	...cells(browserProfiles, "ordinary-source", ["field"])
	, ...cells([
		"node-javascript", "node-typescript", ...browserProfiles
	], "reviewed-ir", ["field"])
	, ...cells(browserProfiles, "reviewed-ir", [
		"callback-parameter", "callback-result"
	])
	, ...cells([
		"dotnet", "java", "kotlin", "php-native", "wit-wasi"
	], "ordinary-source", ["callback-parameter", "callback-result"])
	, ...cells([
		"dotnet", "java", "kotlin", "php-native", "wit-wasi"
	], "reviewed-ir", ["callback-parameter", "callback-result"])
	, ...cells(["python", "ruby", "rust", "perl"], "ordinary-source", [
		"callback-parameter", "callback-result"
	])
	, ...cells(["python", "ruby", "rust", "perl"], "reviewed-ir", [
		"callback-parameter", "callback-result"
	])
]);
assert.equal(finCompletionTargetCells.length, 50);
assert.equal(new Set(finCompletionTargetCells).size, 50);

const common = Object.freeze([
	"scripts/promote-fin-completion.mjs"
	, "tests/helpers/fin-completion-promotion.mjs"
	, "tests/helpers/fin-completion-promotion-tests.mjs"
]);

const artifactRecords = index => {
	const hosted = index.legs ?? index.lanes ?? [index];
	return hosted.map(item => item.hostedRun).filter(Boolean).map(run => ({
		path: `${run.artifact.name}.zip`, sha256: run.artifact.sha256
	}));
};

/**
 * Read and authenticate the four archive indexes before describing the exact
 * type-surface evidence entries.
 */
export const finCompletionPromotionReferences = async () => {
	const references = [];
	for(const [name, config] of Object.entries(finCompletionEvidence))
	{
		const bytes = await readFile(config.index);
		const index = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(index), config.index);
		assert.equal(index.schemaVersion, 1, config.index);
		assert.equal(index.kind, config.kind, config.index);
		assert.match(index.producerCommit, /^[a-f0-9]{40}$/u, config.index);
		assert.match(index.checkerCommit, /^[a-f0-9]{40}$/u, config.index);
		assert.match(index.archiveCommit, /^[a-f0-9]{40}$/u, config.index);
		assert.equal(index.producerCommit, index.checkerCommit, config.index);
		assert.ok(Array.isArray(index.files) && index.files.length > 0
			, config.index);
		const paths = [...common, config.index, ...config.validators];
		const files = await Promise.all(paths.map(async path => ({
			path, sha256: sha256(await readFile(path))
		})));
		const commands = {
			fields: "LEAN_BRIDGE_REVIEWED_FIN_WASM_ENTRY_BROWSER_TEST=1 LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit node --test --test-concurrency=1 tests/reviewed-fin-wasm-entry.test.mjs"
			, browserCallbacks: "bash scripts/run-reviewed-callback-fin-browser-ci.sh"
			, managedCallbacks: "bash scripts/run-callback-fin-remaining-ci.sh <dotnet|jvm|php-native|wit-wasi>"
			, nativeCallbacks: "bash scripts/run-callback-fin-languages-ci.sh <python> <ruby> <gem> <rustc> <cargo> && bash scripts/run-callback-fin-perl-ci.sh"
		};
		const scopes = {
			fields: "Hosted original and instrumented-probe packages execute ordinary-source and independently reviewed copied Fin fields through Node JavaScript, strict TypeScript, Chromium, Firefox and WebKit pages, React production/StrictMode lifecycles and dedicated workers."
			, browserCallbacks: "Hosted independently reviewed callback-Fin packages execute callback parameters and results through Chromium, Firefox and WebKit pages, React production/StrictMode lifecycles and dedicated workers."
			, managedCallbacks: "Hosted ordinary-source and independently reviewed callback-Fin packages execute callback parameters and results through .NET, Java, Kotlin, native PHP and WIT/WASI installed consumers."
			, nativeCallbacks: "Hosted ordinary-source and independently reviewed callback-Fin packages execute callback parameters and results through Python, Ruby, Rust and all four pinned Perl ABI configurations."
		};
		references.push({
			name, id: config.id, revision: index.producerCommit
			, command: commands[name], scope: scopes[name]
			, files, artifacts: artifactRecords(index), index
		});
	}
	assert.deepEqual(references.map(item => item.name), [
		"fields", "browserCallbacks", "managedCallbacks", "nativeCallbacks"
	]);
	assert.equal(new Set(references.flatMap(item => item.artifacts.map(
		artifact => artifact.sha256))).size
	, references.reduce((sum, item) => sum + item.artifacts.length, 0));
	return references;
};
