/**
 * The CLI configuration lineage contains only exact, deduplicated recorded predecessors.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { authenticatedCliPackageConfigs, cliPackageConfigPath, retargetCliInventory, selectCliPackageConfig } from "./cli-package-config-history.mjs";
import { beforeNpmFinDiagnosticsSource } from "./npm-fin-diagnostics-source-history.mjs";
import { beforeFinDistributionSource } from "./fin-distribution-source-history.mjs";

const inventory = config => {
	const files = [...config.files, "README.md", "package.json"].map(path => ({ path }));
	return { package: { name: config.name, version: config.version }, sourceDateEpoch: config.sourceDateEpoch, files };
};

test("CLI package configurations come only from the current source and its recorded predecessors", async () => {
	const current = await readFile(cliPackageConfigPath, "utf8");
	const candidates = await authenticatedCliPackageConfigs();
	assert.equal(candidates[0].sha256, sha256(current));
	assert.equal(new Set(candidates.map(item => item.sha256)).size, candidates.length);
	// Registering the Fin documentation modules reconstructs its predecessor exactly.
	const finModule = "src/backends/native/fin-refinements.mjs";
	assert.equal(candidates[1].sha256, sha256(beforeFinDistributionSource(cliPackageConfigPath, current)));
	assert.ok(candidates[0].config.files.includes(finModule));
	assert.ok(!candidates[1].config.files.includes(finModule));
	// The #1419 module transition reconstructs its predecessor exactly.
	assert.equal(candidates[2].sha256, sha256(beforeNpmFinDiagnosticsSource(cliPackageConfigPath, current)));
	assert.ok(candidates[1].config.files.includes("src/build/component-engine-failure.mjs"));
	assert.ok(!candidates[2].config.files.includes("src/build/component-engine-failure.mjs"));
	for(const { config } of candidates) assert.deepEqual(await selectCliPackageConfig(inventory(config)), config);
	const base = candidates[0].config;
	for(const forged of [
		{ ...base, files: [...base.files, "src/build/unrecorded.mjs"] }
		, { ...base, files: base.files.filter(path => path !== "src/build/canonical-build.mjs") }
		, { ...base, version: "9.9.9" }
		, { ...base, sourceDateEpoch: base.sourceDateEpoch + 1 }
	]) await assert.rejects(() => selectCliPackageConfig(inventory(forged)), /exactly one authenticated configuration/u);
	await assert.rejects(() => selectCliPackageConfig(undefined), /exactly one authenticated configuration/u);
});

test("retargeted CLI inventories select every other recorded configuration", async () => {
	const candidates = await authenticatedCliPackageConfigs();
	const fixture = async path => Buffer.from(`fixture ${path}`);
	const paths = cli => cli.files.map(file => file.path).sort();
	for(const { config: built } of candidates)
	{
		const recorded = inventory(built);
		// Retargeting to the configuration that built a report changes nothing,
		// so a negative control must always choose a different one.
		assert.deepEqual(paths(await retargetCliInventory(recorded, built, fixture)), paths(recorded));
		const others = candidates.filter(({ config }) => JSON.stringify(config.files) !== JSON.stringify(built.files));
		assert.ok(others.length > 0);
		for(const { config } of others)
		{
			const changed = await retargetCliInventory(recorded, config, fixture);
			assert.notDeepEqual(paths(changed), paths(recorded));
			assert.deepEqual(await selectCliPackageConfig(changed), config);
			for(const file of changed.files.filter(file => recorded.files.some(item => item.path === file.path)))
				assert.deepEqual(file, recorded.files.find(item => item.path === file.path));
		}
	}
});
