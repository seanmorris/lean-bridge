/**
 * Authenticate the distributed nested checked-record history partitions.
 * This audit-only partition intentionally adds no retained suite to shard 11.
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

const partitionPaths = Array.from({ length: 12 }, (_, index) =>
	new URL(`nested-checked-record-history-partition-${String(index + 1).padStart(2, "0")}.test.mjs`, import.meta.url));
const parentPath = new URL("nested-checked-records.test.mjs", import.meta.url);
const boundedCellExpansionPaths = [
	"helpers/nested-checked-record-native-promotion-tests.mjs"
	, "helpers/nested-checked-record-python-promotion-tests.mjs"
	, "helpers/recursive-checked-record-promotion-tests.mjs"
];
const strictImport = /^import "([.]\/helpers\/[^"\r\n]+)";$/gmu;
const broadSideEffectLoad = /(?:^\s*import\s*["'][.]\/helpers\/|\bimport\s*\(\s*["'][.]\/helpers\/|\bregisterRetainedContractTests\s*\()/mu;
const expectedPartitionInventory = Object.freeze({
	assignmentSha256: "ed859382293d9887370a905592501dcdb40c100ffcc7db04ae33cd3e3c4b3a5d"
	, helperSetSha256: "791913e5307c475732a5f0397e4711c3784a1602a2460fe4b85ad59b4c9a55a0"
	, partitionImports: 30
});

test("nested checked-record history partitions retain every original suite exactly once", async context => {
	const [sources, parent, boundedCellExpansions] = await Promise.all([
		Promise.all(partitionPaths.map(path => readFile(path, "utf8")))
		, readFile(parentPath, "utf8")
		, Promise.all(boundedCellExpansionPaths.map(async path => [
			path, await readFile(new URL(path, import.meta.url), "utf8")
		]))
	]);
	const entries = sources.flatMap((source, index) =>
		[...source.matchAll(strictImport)].map(match => [index + 1, match[1]]));
	const imports = entries.map(([, path]) => path);
	await context.test("partitions contain only direct static helper loads", () => {
		assert.doesNotMatch(parent, broadSideEffectLoad);
		assert.equal(entries.filter(([partition]) => partition === 5).length, 0);
		assert.ok(sources.every(source => {
			const stripped = source.replace(strictImport, "");
			return !broadSideEffectLoad.test(stripped);
		}));
		assert.equal(new Set(imports).size, imports.length);
	});
	await context.test("audited membership and assignment match together", () => {
		assert.deepEqual({
			assignmentSha256: sha256(canonicalJson(entries.toSorted((left, right) =>
				canonicalJson(left).localeCompare(canonicalJson(right)))))
			, helperSetSha256: sha256(canonicalJson(imports.toSorted()))
			, partitionImports: imports.length
		}, expectedPartitionInventory);
	});
	await context.test("bounded cell expansions remain paired", () => {
		for(const [path, source] of boundedCellExpansions)
		{
			assert.equal(source.split("typeSurfaceCells(").length - 1, 2, path);
			assert.equal(source.split(", contracts, selected)").length - 1, 2, path);
			assert.match(source, /const stableSurface = /u, path);
			assert.match(source, /const affectedObservations = /u, path);
		}
	});

	await context.test("every audited helper has exactly one Core owner", async () => {
		const owners = await testRegistrationRootOwners(
			await collectCoreContractTestPaths(), imports);
		for(const [path, paths] of owners)
			assert.equal(paths.length, 1, `${path}: ${paths.join(", ")}`);
	});
});
