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
const strictImport = /^import "([.]\/helpers\/[^"\r\n]+)";$/gmu;
const broadSideEffectLoad = /(?:^\s*import\s*["'][.]\/helpers\/|\bimport\s*\(\s*["'][.]\/helpers\/|\bregisterRetainedContractTests\s*\()/mu;

test("nested checked-record history partitions retain every original suite exactly once", async () => {
	const [sources, parent] = await Promise.all([
		Promise.all(partitionPaths.map(path => readFile(path, "utf8")))
		, readFile(parentPath, "utf8")
	]);
	const entries = sources.flatMap((source, index) =>
		[...source.matchAll(strictImport)].map(match => [index + 1, match[1]]));
	const imports = entries.map(([, path]) => path);
	assert.doesNotMatch(parent, broadSideEffectLoad);
	assert.deepEqual(sources.map(source => [...source.matchAll(strictImport)].length)
		, [3, 3, 3, 3, 0, 3, 3, 3, 2, 2, 2, 3]);
	assert.ok(sources.every(source => {
		const stripped = source.replace(strictImport, "");
		return !broadSideEffectLoad.test(stripped);
	}));
	assert.equal(imports.length, 30);
	assert.equal(new Set(imports).size, imports.length);
	assert.equal(sha256(canonicalJson(imports.toSorted()))
		, "791913e5307c475732a5f0397e4711c3784a1602a2460fe4b85ad59b4c9a55a0");
	assert.equal(sha256(canonicalJson(entries.toSorted((left, right) =>
		canonicalJson(left).localeCompare(canonicalJson(right)))))
		, "ed859382293d9887370a905592501dcdb40c100ffcc7db04ae33cd3e3c4b3a5d");

	const owners = await testRegistrationRootOwners(
		await collectCoreContractTestPaths(), imports);
	for(const [path, paths] of owners)
		assert.equal(paths.length, 1, `${path}: ${paths.join(", ")}`);
});
