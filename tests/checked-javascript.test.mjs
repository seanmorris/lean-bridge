/**
 * Tests the explicit checked-JavaScript adoption boundary.
 *
 * @file
 */

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import test from "node:test";
import "./helpers/core-contract-repair-history-tests.mjs";
import "./helpers/checked-javascript-disposition-history-tests.mjs";
import "./helpers/core-evidence-memory-repair-source-history-tests.mjs";
import "./helpers/entry-fixture-repair-source-history-tests.mjs";
import "./helpers/owned-c-producer-repair-source-history-tests.mjs";
import "./helpers/owned-dotnet-producer-repair-source-history-tests.mjs";
import "./helpers/documentation-workflow-repair-source-history-tests.mjs";
import "./helpers/owned-javascript-producer-repair-source-history-tests.mjs";
import "./helpers/owned-subtype-delegation-repair-source-history-tests.mjs";
import "./helpers/native-fork-transfer-producer-repair-source-history-tests.mjs";
import "./helpers/fin-history-rolling-repair-source-history-tests.mjs";
import "./helpers/fin-history-rolling-stage-tests.mjs";
import "./helpers/perl-callback-admission-repair-source-history-tests.mjs";
import "./helpers/owned-jvm-transfer-producer-repair-source-history-tests.mjs";
import "./helpers/owned-c-receiver-producer-repair-source-history-tests.mjs";
import "./helpers/php-wasm-callback-subtype-entry-source-history-tests.mjs";
import "./helpers/php-wasm-callback-fin-mixed-entry-source-history-tests.mjs";
import "./helpers/owned-javascript-transfer-nix-producer-repair-source-history-tests.mjs";
import "./helpers/owned-milestone-producer-repair-source-history-tests.mjs";
import "./helpers/php-wasm-callback-tiles-trace-repair-source-history-tests.mjs";
import "./helpers/author-refinement-guidance-repair-source-history-tests.mjs";
import "./helpers/wit-transfer-copy-gap-source-history-tests.mjs";
import "./helpers/core-evidence-repair-integration-source-history-tests.mjs";
import "./helpers/jvm-npm-producer-binding-tests.mjs";
import "./helpers/jvm-npm-producer-repair-source-history-tests.mjs";
import "./helpers/feature-admission-producer-binding-tests.mjs";
import "./helpers/admission-archive-producer-repair-source-history-tests.mjs";
import "./helpers/borrow-receiver-producer-binding-tests.mjs";
import "./helpers/borrow-receiver-producer-repair-source-history-tests.mjs";
import "./helpers/generic-subtype-archive-boundary-tests.mjs";
import "./helpers/generic-subtype-archive-boundary-source-history-tests.mjs";
import "./helpers/core-producer-live-pin-repair-source-history-tests.mjs";
import "./helpers/ruby-transfer-copy-gap-source-history-tests.mjs";
import "./helpers/ruby-transfer-copy-gap-integration-source-history-tests.mjs";
import "./helpers/perl-promotion-live-pin-repair-source-history-tests.mjs";
import "./helpers/php-wasm-callback-endpoint-stop-source-history-tests.mjs";
import "./helpers/zero-payload-dotnet-archive-gap-source-history-tests.mjs";
import "./helpers/core-history-endpoint-integration-source-history-tests.mjs";
import "./helpers/owned-producer-replay-source-history-tests.mjs";
import "./helpers/php-recursive-milestone-stop-tests.mjs";
import "./helpers/owned-history-followup-source-history-tests.mjs";
import "./helpers/perl-callback-contract-gap-source-history-tests.mjs";
import "./helpers/milestone-control-repair-source-history-tests.mjs";
import "./helpers/php-recursive-producer-replay-tests.mjs";
import "./helpers/php-recursive-replay-source-history-tests.mjs";
import "./helpers/zero-payload-rust-producer-replay-tests.mjs";
import "./helpers/zero-payload-rust-producer-replay-source-history-tests.mjs";
import "./helpers/owned-callback-result-producer-tests.mjs";
import "./helpers/owned-callback-inventory-endpoint-tests.mjs";
import "./helpers/callback-producer-replay-source-history-tests.mjs";
import "./helpers/owned-transfer-borrow-producer-tests.mjs";
import "./helpers/transfer-borrow-producer-replay-source-history-tests.mjs";
import "./helpers/owned-lifetime-producer-tests.mjs";
import "./helpers/owned-lifetime-replay-control-tests.mjs";
import "./helpers/owned-lifetime-producer-replay-source-history-tests.mjs";
import "./helpers/owned-php-wasm-hosted-archive-source-history-tests.mjs";
import "./helpers/owned-npm-ci-environment-repair-source-history-tests.mjs";
import "./helpers/core-inventory-endpoint-tests.mjs";
import "./helpers/core-inventory-endpoint-repair-source-history-tests.mjs";
import "./helpers/core-inventory-followup-endpoint-tests.mjs";
import "./helpers/core-inventory-followup-repair-source-history-tests.mjs";
import "./helpers/core-fin-cpp-repair-source-history-tests.mjs";
import "./helpers/dotnet-callback-producer-replay-source-history-tests.mjs";
import "./helpers/python-callback-producer-replay-source-history-tests.mjs";
import "./helpers/jvm-callback-producer-replay-source-history-tests.mjs";
import "./helpers/php-wasm-callback-producer-replay-source-history-tests.mjs";
import "./helpers/core-receiver-endpoint-tests.mjs";
import "./helpers/core-receiver-endpoint-repair-source-history-tests.mjs";
import "./helpers/core-perl-consumer-endpoint-tests.mjs";
import "./helpers/core-perl-consumer-endpoint-repair-source-history-tests.mjs";
import "./helpers/owned-checked-record-npm-producer-tests.mjs";
import "./helpers/owned-npm-scoped-producer-source-history-tests.mjs";
import "./helpers/core-php-structured-endpoint-tests.mjs";
import "./helpers/core-php-structured-endpoint-repair-source-history-tests.mjs";
import "./helpers/owned-checked-record-hosted-matrix-tests.mjs";
import "./helpers/owned-checked-record-matrix-gate-source-history-tests.mjs";
import "./helpers/core-structured-history-endpoint-tests.mjs";
import "./helpers/core-structured-history-repair-source-history-tests.mjs";
import "./helpers/owned-npm-source-identity-repair-source-history-tests.mjs";
import "./helpers/generic-subtype-compact-reference-source-history-tests.mjs";
import "./helpers/type-surface-promotion-io-tests.mjs";
import "./helpers/promotion-file-transaction-tests.mjs";
import "./helpers/generic-subtype-promotion-transaction-source-history-tests.mjs";
import "./helpers/generic-subtype-promotion-baseline-tests.mjs";
import "./helpers/source-history-stream-tests.mjs";
import "./helpers/generic-subtype-promotion-baseline-source-history-tests.mjs";
import "./helpers/owned-npm-history-checkout-source-history-tests.mjs";
import "./helpers/generic-subtype-published-matrix-tests.mjs";
import "./helpers/owned-checked-record-promotion-tests.mjs";
import "./helpers/generic-subtype-matrix-publication-source-history-tests.mjs";
import "./helpers/owned-checked-record-promotion-preparation-source-history-tests.mjs";
import "./helpers/php-wasm-entry-tag-dispatch-source-history-tests.mjs";
import "./helpers/owned-checked-record-published-matrix-tests.mjs";
import "./helpers/owned-checked-record-semantic-audit-tests.mjs";
import "./helpers/owned-checked-record-semantic-audit-source-history-tests.mjs";
import "./helpers/owned-checked-record-matrix-publication-source-history-tests.mjs";
import "./helpers/php-wasm-refinement-entry-hosted-identities-tests.mjs";
import "./helpers/php-wasm-entry-hosted-identity-source-history-tests.mjs";
import "./helpers/php-wasm-refinement-entry-hosted-replay-tests.mjs";
import "./helpers/php-wasm-entry-hosted-replay-source-history-tests.mjs";
import "./helpers/php-wasm-refinement-entry-hosted-storage-tests.mjs";
import "./helpers/php-wasm-refinement-entry-hosted-diagnostic-tests.mjs";
import "./helpers/php-wasm-entry-diagnostic-retention-source-history-tests.mjs";
import "./helpers/php-wasm-refinement-entry-hosted-archive-tests.mjs";
import "./helpers/php-wasm-entry-complete-archive-source-history-tests.mjs";
import "./helpers/php-wasm-refinement-entry-publication-tests.mjs";
import "./helpers/php-wasm-refinement-entry-publication-docs-tests.mjs";
import "./helpers/php-wasm-entry-publication-preparation-source-history-tests.mjs";
import "./helpers/php-wasm-refinement-entry-publisher-tests.mjs";
import "./helpers/php-wasm-refinement-entry-publication-pins-tests.mjs";
import "./helpers/php-wasm-entry-publisher-source-history-tests.mjs";
import "./helpers/php-wasm-entry-publication-pin-repair-source-history-tests.mjs";
import "./helpers/php-wasm-entry-published-probe-tests.mjs";
import "./helpers/php-wasm-entry-probe-publication-source-history-tests.mjs";
import "./helpers/consumer-tool-lookups-tests.mjs";
import "./helpers/consumer-tool-lookups-source-history-tests.mjs";
import "./helpers/php-wasm-entry-source-supplement-source-history-tests.mjs";
import "./helpers/core-recursive-endpoint-tests.mjs";
import "./helpers/core-publication-recursive-repair-source-history-tests.mjs";
import "./helpers/core-author-publication-repair-source-history-tests.mjs";
import "./helpers/php-wasm-entry-build-input-supplement-source-history-tests.mjs";
import "./helpers/core-aggregate-sparse-checkout-source-history-tests.mjs";
import "./helpers/owned-npm-complete-acceptance-source-history-tests.mjs";
import "./helpers/php-closure-producer-replay-source-history-tests.mjs";
import "./helpers/owned-receipt-producer-replay-source-history-tests.mjs";
import "./helpers/owned-matrix-isolation-source-history-tests.mjs";
import "./helpers/owned-matrix-refresh-source-history-tests.mjs";
import "./helpers/owned-checked-carrier-compilation-source-history-tests.mjs";
import "./helpers/owned-checked-native-mixed-coverage-source-history-tests.mjs";
import "./helpers/owned-native-promotion-scope-source-history-tests.mjs";
import "./helpers/owned-checked-language-mixed-coverage-source-history-tests.mjs";
import "./helpers/dependent-matrix-doc-gate-source-history-tests.mjs";
import "./helpers/owned-checked-window-rejection-source-history-tests.mjs";
import "./helpers/owned-checked-managed-mixed-coverage-source-history-tests.mjs";
import "./helpers/owned-checked-php-wasm-mixed-coverage-source-history-tests.mjs";
import "./helpers/owned-checked-wit-bootstrap-source-history-tests.mjs";
import "./helpers/wasmtime-capi-rollout-tests.mjs";
import "./helpers/wasmtime-capi-ci-rollout-source-history-tests.mjs";
import "./helpers/owned-checked-record-php-wasm-context-tests.mjs";
import "./helpers/owned-checked-php-wasm-contexts-source-history-tests.mjs";
import "./helpers/owned-checked-retained-identity-source-history-tests.mjs";
import "./helpers/owned-subtype-npm-complete-acceptance-source-history-tests.mjs";
import "./helpers/owned-subtype-npm-hosted-source-history-tests.mjs";
import "./helpers/owned-subtype-hosted-promotion-source-history-tests.mjs";
import "./helpers/owned-subtype-promotion-transaction-source-history-tests.mjs";
import "./helpers/owned-subtype-published-matrix-tests.mjs";
import "./helpers/owned-subtype-matrix-publication-source-history-tests.mjs";
import "./helpers/owned-checked-record-archive-roots-source-history-tests.mjs";
import "./helpers/owned-publication-coexistence-source-history-tests.mjs";
import "./helpers/owned-checked-record-aligned-publication-source-history-tests.mjs";
import "./helpers/owned-checked-record-promotion-labels-source-history-tests.mjs";
import "./helpers/owned-checked-c-session-boundaries-source-history-tests.mjs";

const root = resolve(".");

/**
 * Inventories owned JavaScript modules below one directory.
 *
 * @param {string} directory - Directory whose owned modules are inventoried.
 */
const visit = async directory => {
	const paths = [];
	for(const entry of await readdir(directory, { withFileTypes: true }))
	{
		const path = resolve(directory, entry.name);
		if(entry.isDirectory()) paths.push(...await visit(path));
		else if(entry.isFile() && entry.name.endsWith(".mjs")) paths.push(relative(root, path).replaceAll("\\", "/"));
	}
	return paths.sort();
};

test("every owned source module has one explicit typecheck disposition", async () => {
	const manifest = JSON.parse(await readFile(resolve(root, "config/checked-javascript.json"), "utf8"));
	const paths = [...manifest.checked, ...manifest.deferred.map(entry => entry.path)];
	assert.deepEqual(paths.toSorted(), await visit(resolve(root, "src")));
	assert.equal(new Set(paths).size, paths.length);
	assert.ok(manifest.checked.length > 0);
	assert.ok(manifest.deferred.every(entry => new Set(["strict-migration-backlog", "generated-runtime-import-boundary"]).has(entry.classification)));
});

test("the required typecheck uses strict checkJs for exactly the adopted modules", async () => {
	const [manifest, config] = await Promise.all([
		readFile(resolve(root, "config/checked-javascript.json"), "utf8").then(JSON.parse)
		, readFile(resolve(root, "jsconfig.checked.json"), "utf8").then(JSON.parse)
	]);
	assert.equal(config.compilerOptions.checkJs, true);
	assert.equal(config.compilerOptions.strict, true);
	assert.deepEqual(config.include.toSorted(), manifest.checked.toSorted());
});

test("the default and CI quality gates cover the same core contract", async () => {
	const [packageDocument, workflow] = await Promise.all([
		readFile(resolve(root, "package.json"), "utf8").then(JSON.parse)
		, readFile(resolve(root, ".github/workflows/quality.yml"), "utf8")
	]);
	assert.equal(packageDocument.scripts.check, "npm run check:core");
	assert.match(packageDocument.scripts["check:core"], /env:check:core.*lint.*typecheck.*test:contracts/);
	assert.match(workflow, /node-version: 22/);
	assert.match(workflow, /bootstrap-toolchains\.sh --wasm-tools-only/);
	assert.match(workflow, /npm ci --ignore-scripts/);
	for(const command of ["env:check:core", "lint", "typecheck"])
		assert.equal(workflow.match(new RegExp(`npm run ${command}`, "gu"))?.length, 1);
	assert.match(workflow
		, /run-test-profile\.sh contract \\\n\s+--shard "\$\{\{ matrix\.shard \}\}\/6"/u);
	assert.match(workflow, /check-core-contract-shards\.mjs build\/core-shards/u);
	assert.match(workflow, /permissions:\n\s+contents: read/);
});
