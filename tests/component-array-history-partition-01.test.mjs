/**
 * Distributed retained-history partition 01 of 12.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { collectCoreContractTestPaths }
	from "../scripts/core-contract-shards.mjs";
import { testRegistrationRootOwners }
	from "./helpers/test-registration-owners.mjs";
import "./helpers/nominal-subtype-entry-publication-source-history-tests.mjs";
import "./helpers/core-contract-runtime-budget-source-history-tests.mjs";
import "./helpers/core-first-run-residual-repair-source-history-tests.mjs";
import "./helpers/checked-record-value-index-jvm-native-repair-source-history-tests.mjs";
import "./helpers/checked-record-value-index-dotnet-hosted-repair-source-history-tests.mjs";
import "./helpers/value-index-browser-lint-source-history-tests.mjs";
import "./helpers/generic-subtype-managed-tap-escape-repair-source-history-tests.mjs";
import "./helpers/php-wasm-entry-call-path-source-history-tests.mjs";
import "./helpers/generic-subtype-hosted-archive-source-history-tests.mjs";
import "./helpers/value-index-matrix-historical-inventory-repair-source-history-tests.mjs";
import "./helpers/value-index-browser-promotion-closure-repair-source-history-tests.mjs";
import "./helpers/php-wasm-callback-entry-form-repair-source-history-tests.mjs";
import "./helpers/callback-php-wasm-static-quality-repair-source-history-tests.mjs";
import "./helpers/generic-subtype-evidence-source-closure-repair-source-history-tests.mjs";
import "./helpers/native-specializations-source-history-tests.mjs";
import "./helpers/browser-refinements-source-history-tests.mjs";

const partitionPaths = Array.from({ length: 12 }, (_, index) =>
	new URL(`component-array-history-partition-${String(index + 1).padStart(2, "0")}.test.mjs`, import.meta.url));
const parentPath = new URL("component-array-contract.test.mjs", import.meta.url);
const strictImport = /^import "([.]\/helpers\/[^"\r\n]+)";$/gmu;
const broadStaticImport = /^\s*import\s*["']([.]\/helpers\/[^"'\r\n]+)["'];?\s*$/gmu;
const dynamicImport = /\bimport\s*\(\s*["']([.]\/helpers\/[^"'\r\n]+)["']\s*\)/gmu;
const retainedRegistration = /\bregisterRetainedContractTests\s*\(/mu;
const exceptions = new Map([
	["./helpers/checked-record-value-index-dotnet-evidence-tests.mjs"
		, "checked-record-value-index-dotnet-evidence.test.mjs"]
	, ["./helpers/generic-subtype-documentation-source-history-tests.mjs"
		, "generic-subtype-native-perl.test.mjs"]
	, ["./helpers/generic-subtype-promotion-source-history-tests.mjs"
		, "generic-subtype-native-perl.test.mjs"]
	, ["./helpers/owned-subtype-perl-source-path-repair-source-history-tests.mjs"
		, "owned-subtype-hosted-ci.test.mjs"]
	, ["./helpers/recursive-checked-record-documentation-closure-source-history-tests.mjs"
		, "nested-checked-record-history-partition-03.test.mjs"]
]);
const localHistory = new Set([
	"./helpers/component-array-nested-fin-source-history-tests.mjs"
	, "./helpers/component-array-subtype-source-history-tests.mjs"
]);
const loadedHelpers = source => [
	...[...source.matchAll(broadStaticImport)].map(match => match[1])
	, ...[...source.matchAll(dynamicImport)].map(match => match[1])
];

test("array history partitions retain every original helper exactly once", async () => {
	const [sources, parent] = await Promise.all([
		Promise.all(partitionPaths.map(path => readFile(path, "utf8")))
		, readFile(parentPath, "utf8")
	]);
	const entries = sources.flatMap((source, index) =>
		[...source.matchAll(strictImport)].map(match => [index + 1, match[1]]));
	const partitionImports = entries.map(([, path]) => path);
	const imports = partitionImports.filter(path => !localHistory.has(path));
	assert.deepEqual(loadedHelpers(parent), []);
	assert.doesNotMatch(parent, retainedRegistration);
	assert.deepEqual(sources.map(source =>
		[...source.matchAll(strictImport)].length)
		, [16, 17, 1, 15, 8, 8, 14, 16, 8, 8, 8, 8]);
	assert.ok(sources.every(source => {
		assert.doesNotMatch(source, retainedRegistration);
		return loadedHelpers(source).length === [...source.matchAll(strictImport)].length;
	}));
	assert.equal(partitionImports.length, 127);
	assert.equal(new Set(partitionImports).size, partitionImports.length);
	assert.equal(imports.length, 125);
	const originalImports = [...imports, ...exceptions.keys()];
	assert.equal(originalImports.length, 130);
	assert.equal(new Set(originalImports).size, originalImports.length);
	assert.equal(sha256(canonicalJson(originalImports.toSorted()))
		, "5eef538729dc79d6d6385d9b2ded489991bad4f19654f5d095d792b47a8ecfc7");
	assert.equal(sha256(canonicalJson(entries.toSorted((left, right) =>
		canonicalJson(left).localeCompare(canonicalJson(right)))))
		, "0b806e9346e5a605ff8ff7c72c9a873f7aa7f584084de67943425d3558e7351b");

	const ownedImports = [...originalImports, ...localHistory];
	const owners = await testRegistrationRootOwners(
		await collectCoreContractTestPaths(), ownedImports);
	for(const [path, paths] of owners)
	{
		assert.equal(paths.length, 1, `${path}: ${paths.join(", ")}`);
		const owner = paths[0].replace(/^tests\//u, "");
		if(exceptions.has(path)) assert.equal(owner, exceptions.get(path));
		else assert.match(owner, /^component-array-history-partition-\d{2}[.]test[.]mjs$/u);
	}
});
