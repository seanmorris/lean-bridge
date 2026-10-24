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
