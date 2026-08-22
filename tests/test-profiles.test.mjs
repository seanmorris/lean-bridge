/**
 * Tests closed repository test-profile classification.
 *
 * @file
 */

import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import test from "node:test";

import { classifyRepositoryTest, groupRepositoryTests, repositoryTestProfiles } from "../src/adoption/test-profiles.mjs";

const root = resolve(".");
const visit = async directory => {
	const paths = [];
	for(const entry of await readdir(directory, { withFileTypes: true }))
	{
		const path = resolve(directory, entry.name);
		if(entry.isDirectory()) paths.push(...await visit(path));
		else if(entry.isFile() && entry.name.endsWith(".test.mjs")) paths.push(relative(root, path).replaceAll("\\", "/"));
	}
	return paths;
};

test("every repository test receives exactly one named execution profile", async () => {
	const paths = await visit(resolve(root, "tests"));
	const grouped = groupRepositoryTests(paths);
	assert.deepEqual(repositoryTestProfiles, ["contract", "browser", "performance", "managed", "php", "native", "component", "consumer", "all"]);
	assert.equal(Object.values(grouped).flat().length, paths.length);
	assert.equal(new Set(Object.values(grouped).flat()).size, paths.length);
	assert.ok(grouped.contract.includes("tests/test-profiles.test.mjs"));
	assert.ok(grouped.native.includes("tests/rust-generator.test.mjs"));
	assert.ok(grouped.consumer.includes("tests/consumer-node.test.mjs"));
});

test("unclassified tests and non-tests are rejected", () => {
	assert.throws(() => classifyRepositoryTest("tests/new-contract.test.mjs"), /Unclassified repository test/);
	assert.throws(() => classifyRepositoryTest("tests/helper.mjs"), /Not a repository test path/);
});

test("missing manifest entries and duplicate discovered paths are rejected", () => {
	assert.throws(() => groupRepositoryTests(["tests/test-profiles.test.mjs"]), /entries do not exist/);
});
