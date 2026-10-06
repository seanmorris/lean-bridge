/**
 * The CLI configuration lineage contains only exact, deduplicated recorded predecessors.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { authenticatedCliPackageConfigs, cliPackageConfigPath, selectCliPackageConfig } from "./cli-package-config-history.mjs";
import { beforeNpmFinDiagnosticsSource } from "./npm-fin-diagnostics-source-history.mjs";

const inventory = config => {
	const files = [...config.files, "README.md", "package.json"].map(path => ({ path }));
	return { package: { name: config.name, version: config.version }, sourceDateEpoch: config.sourceDateEpoch, files };
};

test("CLI package configurations come only from the current source and its recorded predecessors", async () => {
	const current = await readFile(cliPackageConfigPath, "utf8");
	const candidates = await authenticatedCliPackageConfigs();
	assert.equal(candidates[0].sha256, sha256(current));
	assert.equal(new Set(candidates.map(item => item.sha256)).size, candidates.length);
	// The #1419 module transition reconstructs its predecessor exactly.
	assert.equal(candidates[1].sha256, sha256(beforeNpmFinDiagnosticsSource(cliPackageConfigPath, current)));
	assert.ok(candidates[0].config.files.includes("src/build/component-engine-failure.mjs"));
	assert.ok(!candidates[1].config.files.includes("src/build/component-engine-failure.mjs"));
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
