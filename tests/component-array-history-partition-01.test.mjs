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
const expectedPartitionInventory = Object.freeze({
	assignmentSha256: "f9089d74ed0a5b3c0dc0204ae0b52607ffb5280854a7293167744ec3d4bdc5aa"
	, helperSetSha256: "8dc7505436d77a771ccd37c6eb1b88663d395c9ee4b15ba86c04b24af1cdd879"
	, originalImports: 131
	, partitionImports: 128
	, retainedImports: 126
});
const loadedHelpers = source => [
	...[...source.matchAll(broadStaticImport)].map(match => match[1])
	, ...[...source.matchAll(dynamicImport)].map(match => match[1])
];

test("array history partitions retain every original helper exactly once", async context => {
	const [sources, parent] = await Promise.all([
		Promise.all(partitionPaths.map(path => readFile(path, "utf8")))
		, readFile(parentPath, "utf8")
	]);
	const entries = sources.flatMap((source, index) =>
		[...source.matchAll(strictImport)].map(match => [index + 1, match[1]]));
	const partitionImports = entries.map(([, path]) => path);
	const imports = partitionImports.filter(path => !localHistory.has(path));
	const originalImports = [...imports, ...exceptions.keys()];
	await context.test("partitions contain only direct static helper loads", () => {
		assert.deepEqual(loadedHelpers(parent), []);
		assert.doesNotMatch(parent, retainedRegistration);
		assert.ok(sources.every(source => {
			assert.doesNotMatch(source, retainedRegistration);
			return loadedHelpers(source).length
				=== [...source.matchAll(strictImport)].length;
		}));
		assert.equal(new Set(partitionImports).size, partitionImports.length);
		assert.equal(new Set(originalImports).size, originalImports.length);
	});
	await context.test("audited membership and assignment match together", () => {
		assert.deepEqual({
			assignmentSha256: sha256(canonicalJson(entries.toSorted((left, right) =>
				canonicalJson(left).localeCompare(canonicalJson(right)))))
			, helperSetSha256: sha256(canonicalJson(originalImports.toSorted()))
			, originalImports: originalImports.length
			, partitionImports: partitionImports.length
			, retainedImports: imports.length
		}, expectedPartitionInventory);
	});

	const ownedImports = [...originalImports, ...localHistory];
	await context.test("every audited helper has exactly one Core owner", async () => {
		const owners = await testRegistrationRootOwners(
			await collectCoreContractTestPaths(), ownedImports);
		for(const [path, paths] of owners)
		{
			assert.equal(paths.length, 1, `${path}: ${paths.join(", ")}`);
			const owner = paths[0].replace(/^tests\//u, "");
			if(exceptions.has(path)) assert.equal(owner, exceptions.get(path));
			else assert.match(owner
				, /^component-array-history-partition-\d{2}[.]test[.]mjs$/u);
		}
	});
});
