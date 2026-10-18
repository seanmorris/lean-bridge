/**
 * Deterministically partition and authenticate the complete Core test profile.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { groupRepositoryTests } from "../src/adoption/test-profiles.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";

export const coreContractShardCount = 6;
export const coreContractShardLabels = Object.freeze(
	Array.from({ length: coreContractShardCount }
		, (_, index) => `${index + 1}/${coreContractShardCount}`));
const partition = "sorted-index-modulo-v1";

const assertPaths = paths => {
	assert.ok(Array.isArray(paths) && paths.length > 0);
	assert.ok(paths.every(path => typeof path === "string"
		&& /^tests\/(?:[^/]+\/)*[^/]+\.test\.mjs$/u.test(path)));
	assert.equal(new Set(paths).size, paths.length);
	assert.deepEqual(paths, paths.toSorted());
};

/**
 * Enumerate every repository test in stable path order.
 *
 * @param root - Repository root whose tests are enumerated.
 */
export const collectRepositoryTestPaths = async (root = resolve(".")) => {
	const visit = async directory => {
		const paths = [];
		for(const entry of await readdir(directory, { withFileTypes: true }))
		{
			const path = resolve(directory, entry.name);
			if(entry.isDirectory()) paths.push(...await visit(path));
			else if(entry.isFile() && entry.name.endsWith(".test.mjs"))
				paths.push(relative(root, path).replaceAll("\\", "/"));
		}
		return paths;
	};
	return (await visit(resolve(root, "tests"))).toSorted();
};

/**
 * Enumerate the closed Core contract profile in stable path order.
 *
 * @param root - Repository root whose Core profile is selected.
 */
export const collectCoreContractTestPaths = async (root = resolve(".")) => {
	const grouped = groupRepositoryTests(await collectRepositoryTestPaths(root));
	assertPaths(grouped.contract);
	return grouped.contract;
};

/**
 * Construct one exact shard manifest from the complete contract profile.
 *
 * @param paths - Every sorted Core contract test path.
 * @param label - One-based shard label `k/6`.
 */
export const coreContractShardManifest = (paths, label) => {
	assertPaths(paths);
	assert.ok(coreContractShardLabels.includes(label), `Unknown Core shard ${label}`);
	const index = Number(label.split("/")[0]);
	const files = paths.filter((_, position) =>
		position % coreContractShardCount === index - 1);
	assert.ok(files.length > 0);
	return {
		schemaVersion: 1, partition
		, shard: { index, total: coreContractShardCount }
		, contract: { count: paths.length, sha256: sha256(canonicalJson(paths)) }
		, selection: {
			count: files.length, sha256: sha256(canonicalJson(files)), files
		}
	};
};

/**
 * Recompute every expected shard and require an exact, disjoint full closure.
 *
 * @param paths - Every sorted Core contract test path.
 * @param manifests - Parsed canonical manifests in any order.
 */
export const verifyCoreContractShardManifests = (paths, manifests) => {
	assertPaths(paths);
	assert.equal(manifests.length, coreContractShardCount);
	const byLabel = new Map();
	for(const manifest of manifests)
	{
		assert.equal(manifest?.shard?.total, coreContractShardCount);
		const label = `${manifest.shard.index}/${manifest.shard.total}`;
		assert.ok(coreContractShardLabels.includes(label));
		assert.ok(!byLabel.has(label), `Duplicate Core shard ${label}`);
		byLabel.set(label, manifest);
	}
	const files = [];
	for(const label of coreContractShardLabels)
	{
		const expected = coreContractShardManifest(paths, label);
		assert.deepEqual(byLabel.get(label), expected, `Core shard ${label}`);
		files.push(...expected.selection.files);
	}
	assert.equal(new Set(files).size, paths.length);
	assert.deepEqual(files.toSorted(), paths);
	return {
		schemaVersion: 1, partition, shards: coreContractShardCount
		, contractFiles: paths.length, contractSha256: sha256(canonicalJson(paths))
	};
};
