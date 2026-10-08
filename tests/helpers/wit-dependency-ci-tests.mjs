/**
 * Reject missing, optional, late or unbounded WIT dependency installation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedWitPackageCi } from "./wit-owned-package-evidence.mjs";
import "./wit-dependency-source-history-tests.mjs";

const policy = "      - name: Bound apt network waits\n";
const dependency = "      - name: Install dependencies for ordinary_wit\n";
const compile = "      - name: Compile ordinary Lean APIs and consume relocated WIT packages\n";
const install = "      - name: Install owned WIT packages without producer sources\n";
const split = async () => {
	const source = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const start = source.indexOf("  wasi-consumer:\n"); assert.ok(start > 0);
	return [source.slice(0, start), source.slice(start)];
};

test("WIT dependency setup requires bounded mandatory steps before compilation", async () => {
	const [prefix, job] = await split();
	assert.doesNotThrow(() => assertOwnedWitPackageCi(prefix + job));
	for(const [before, after] of [
		[policy, policy + "        if: false\n"]
		, [policy, policy + "        continue-on-error: true\n"]
		, [dependency, dependency + "        if: false\n"]
		, [dependency, dependency + "        continue-on-error: true\n"]
		, ["uses: ./.github/actions/bounded-apt", "uses: example/unbounded-apt@v1"]
		, ["        timeout-minutes: 1\n", "        timeout-minutes: 60\n"]
		, ["        timeout-minutes: 20\n", "        timeout-minutes: 60\n"]
		, ["sudo apt-get update &&", "sudo apt-get update;"]
		, ["zstd ripgrep\n", "zstd ripgrep || true\n"]
	]) {
		const changed = job.replace(before, after); assert.notEqual(changed, job);
		assert.throws(() => assertOwnedWitPackageCi(prefix + changed), before);
	}
});

test("WIT dependency checks reject removed or reordered installation and apt inside compilation", async () => {
	const [prefix, job] = await split();
	const policyStart = job.indexOf(policy), dependencyStart = job.indexOf(dependency), compileStart = job.indexOf(compile);
	assert.ok(policyStart > 0 && dependencyStart > policyStart && compileStart > dependencyStart);
	const bounded = job.slice(policyStart, dependencyStart), dependencies = job.slice(dependencyStart, compileStart);
	const mutations = [
		job.replace(bounded, "")
		, job.replace(dependencies, "")
		, job.replace(bounded + dependencies, dependencies + bounded)
		, job.replace(dependencies, "").replace(install, dependencies + install)
		, job.replace(compile, compile + "        run: sudo apt-get update\n")
	];
	for(const changed of mutations)
	{
		assert.notEqual(changed, job);
		assert.throws(() => assertOwnedWitPackageCi(prefix + changed));
	}
});
