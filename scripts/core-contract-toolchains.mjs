#!/usr/bin/env node
/**
 * Derive hosted Core toolchain requirements from the selected test files.
 *
 * @file
 */
import assert from "node:assert/strict";
import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	collectCoreContractTestPaths, coreContractShardLabels
	, coreContractShardManifest
} from "./core-contract-shards.mjs";

export const coreContractToolchainTests = Object.freeze({
	component: Object.freeze(["tests/host-null-npm-installed.test.mjs"])
});

/**
 * Resolve toolchains from the authenticated file selection rather than a
 * matrix position, so repartitioning cannot silently drop a prerequisite.
 *
 * @param paths - Every sorted Core contract test path.
 * @param label - One-based Core shard label.
 */
export const coreContractToolchainPlan = (paths, label) => {
	const manifest = coreContractShardManifest(paths, label);
	const selected = new Set(manifest.selection.files), toolchains = {};
	for(const [name, requirements] of Object.entries(coreContractToolchainTests))
	{
		const files = requirements.filter(path => selected.has(path));
		toolchains[name] = { required: files.length > 0, files };
	}
	return {
		schemaVersion: 1, shard: manifest.shard
		, selectionSha256: manifest.selection.sha256, toolchains
	};
};

const run = async arguments_ => {
	assert.equal(arguments_.length, 4
		, "Usage: core-contract-toolchains.mjs --shard <k/12> --github-output <path>");
	assert.equal(arguments_[0], "--shard");
	assert.ok(coreContractShardLabels.includes(arguments_[1]));
	assert.equal(arguments_[2], "--github-output");
	assert.ok(arguments_[3]);
	const plan = coreContractToolchainPlan(
		await collectCoreContractTestPaths(), arguments_[1]);
	await appendFile(arguments_[3], Object.entries(plan.toolchains)
		.map(([name, requirement]) => `${name}=${requirement.required}\n`).join(""));
	process.stdout.write(canonicalJson(plan));
};

if(process.argv[1]
	&& import.meta.url === pathToFileURL(process.argv[1]).href)
	await run(process.argv.slice(2));
