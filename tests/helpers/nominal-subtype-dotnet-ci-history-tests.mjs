/**
 * Check exact nominal C# CI changes and preservation of support observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforePhpWasmFailureDiagnosticsSource } from "./php-wasm-failure-diagnostics-history.mjs";
import { beforeNominalSubtypeDotnetCiSource, nominalSubtypeDotnetCiChangedPaths, nominalSubtypeDotnetCiHistoryPath, nominalSubtypeDotnetCiPredecessor, reverseNominalSubtypeDotnetCiUpdate } from "./nominal-subtype-dotnet-ci-history.mjs";

test("nominal C# CI preserves exact original sources and support claims", async () => {
	const record = JSON.parse(await readFile(nominalSubtypeDotnetCiHistoryPath));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "nominal-subtype-dotnet-ci-source-v1");
	assert.equal(record.predecessorCommit, nominalSubtypeDotnetCiPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), nominalSubtypeDotnetCiChangedPaths);
	const original = path => execFileSync("git", [
		"show", `${nominalSubtypeDotnetCiPredecessor}:${path}`
	], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeNominalSubtypeDotnetCiSource(
			update.path, await readFile(update.path, "utf8"), update.currentSha256
		);
		const previous = reverseNominalSubtypeDotnetCiUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNominalSubtypeDotnetCiSource(update.path, current), previous);
		assert.equal(beforeNominalSubtypeDotnetCiSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeNominalSubtypeDotnetCiSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeNominalSubtypeDotnetCiSource(update.path, current + "unknown"), current + "unknown");
		const mutations = [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		];
		for(const mutate of mutations)
		{
			const changed = structuredClone(update);
			mutate(changed);
			assert.throws(() => reverseNominalSubtypeDotnetCiUpdate(current, changed));
		}
	}
	const path = "docs/type-surface.v1.json";
	const inventory = JSON.parse(original(path));
	assert.equal(beforeNominalSubtypeDotnetCiSource(path, await readFile(path, "utf8")), original(path));
	assert.equal(inventory.evidence.length, 496);
	assert.equal(inventory.observations.length, 583);
	const current = JSON.parse(beforePhpWasmFailureDiagnosticsSource(path, await readFile(path, "utf8")));
	const expected = structuredClone(inventory); let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.previousSha256)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	assert.ok(pins > 0); assert.deepEqual(current, expected);
});

test("nominal C# CI history writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-dotnet-ci-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [
		resolve("scripts/update-nominal-subtype-dotnet-ci-history.mjs")
	], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
