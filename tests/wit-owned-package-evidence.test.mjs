/**
 * Source-bound owned WIT installed acceptance and immutable predecessor receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import "./helpers/wit-dependency-ci-tests.mjs";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeOwnedWitBuildRepair, ownedWitBuildRepairHistoricalBytes } from "./helpers/wit-owned-build-repair-history.mjs";
import { assertOwnedWitPackageCi, assertOwnedWitPackageExecution } from "./helpers/wit-owned-package-evidence.mjs";
import { beforeOwnedWitPackage, ownedWitPackageAddedPaths
	, ownedWitPackageBaseline, ownedWitPackageChangedPaths, ownedWitPackagePath
	, ownedWitPackagePrevious, reverseOwnedWitPackageUpdate } from "./helpers/wit-owned-package-history.mjs";

const read = async () => JSON.parse(await readFile(ownedWitPackagePath, "utf8"));

test("owned WIT installed successor authenticates source and preserves earlier support cells", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "wit-owned-packages");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedWitPackageBaseline);
	assert.deepEqual(record.previous, ownedWitPackagePrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([...Object.keys(previous.sources), ...ownedWitPackageAddedPaths])].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(ownedWitBuildRepairHistoricalBytes(path, await readFile(path), digest)), digest, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedWitPackageChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path], update.path);
		assert.equal(update.currentSha256, record.sources[update.path], update.path);
		const current = beforeOwnedWitBuildRepair(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(beforeOwnedWitPackage(update.path, current)), update.previousSha256);
		assert.equal(beforeOwnedWitPackage(update.path, current, update.currentSha256), current);
	}
	const current = beforeOwnedWitBuildRepair("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8"));
	const prior = JSON.parse(beforeOwnedWitPackage("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedWitBuildRepairHistoricalBytes(file.path, await readFile(file.path)));
	assert.deepEqual(JSON.parse(current), prior, "Final cross-language support cells are a separate acceptance step");
});

test("owned WIT installed history rejects unknown text, forged ancestors and overlapping edits", async () => {
	for(const update of (await read()).updates)
	{
		const current = beforeOwnedWitBuildRepair(update.path, await readFile(update.path, "utf8")), unknown = current + "\n/* unrelated */\n";
		assert.equal(beforeOwnedWitPackage(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedWitPackageUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unrecorded.mjs" }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedWitPackageUpdate(current, changed));
	}
});

test("owned WIT installed evidence requires both source paths and exact package and loader checks", async () => {
	const record = await read(); assertOwnedWitPackageExecution(record);
	const loader = await readFile("tests/fixtures/structured-types/wit-owned-package-loader.c");
	const page = await readFile("docs/consume/wit-wasi.md", "utf8");
	const example = page.split("### Packages containing resources\n")[1]?.split("```c\n")[1]?.split("```")[0];
	assert.ok(example);
	for(const report of record.installed.filter(item => item.fixture === "values"))
	{
		assert.equal(report.loader.sourceSha256, sha256(loader));
		assert.equal(report.documentation.sourceSha256, sha256(example));
	}
});

test("owned WIT installed evidence rejects skipped cases, missing dependencies and unsupported claims", async () => {
	const original = await read();
	for(const mutate of [
		...["transferredInputs", "anchoredBorrowedResults", "retainedHostCallbacks", "standaloneWasi"]
			.map(key => record => { record.scope[key] = true; })
		, record => { record.scope.installedSupportPromotions = 1; }
		, record => { record.run.exitCode = 1; }
		, record => { record.run.text += "unrecorded"; }
		, record => { record.run.text = record.run.text.replace("# skipped 0", "# skipped 1"); record.run.sha256 = sha256(record.run.text); }
		, record => { record.installed.pop(); }
		, record => { record.installed[1].mode = "ordinary"; }
		, record => { record.installed[0].sourceRemoved = false; }
		, record => { record.installed[0].packages[0].compilerAccess = true; }
		, record => { record.installed[0].dependencies.pop(); }
		, record => { record.installed[0].loader.reports.pop(); }
		, record => { record.installed[0].loader.reports[2].conflict = false; }
		, record => { record.installed[0].documentation.stdout = "0\n"; }
	]) {
		const changed = structuredClone(original); mutate(changed);
		assert.throws(() => assertOwnedWitPackageExecution(changed), undefined, mutate.toString());
	}
});

test("owned WIT installed CI executes enabled probes and retains logs and package reports", async () => {
	assertOwnedWitPackageCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
});

test("owned WIT installed CI rejects hidden failures and disabled or missing checks", async () => {
	const source = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const jobStart = source.indexOf("  wasi-consumer:\n"); assert.ok(jobStart > 0);
	const prefix = source.slice(0, jobStart), jobAndFollowing = source.slice(jobStart);
	const execute = "      - name: Install owned WIT packages without producer sources\n";
	for(const [before, after] of [
		['          LEAN_BRIDGE_WIT_OWNED_PACKAGE_TEST: "1"', '          LEAN_BRIDGE_WIT_OWNED_PACKAGE_TEST: "0"']
		, ["tests/wit-owned-packaging.test.mjs", ""]
		, ["build-essential cmake pkg-config zstd ripgrep", "build-essential pkg-config zstd ripgrep"]
		, ["  wasi-consumer:\n", "  wasi-consumer:\n    if: false\n"]
		, [execute, execute + "        if: false\n"]
		, [execute, execute + "        continue-on-error: true\n"]
		, ["tee build/wit-owned-packaging.log\n", "tee build/wit-owned-packaging.log || true\n"]
		, ...["pass 6", "fail 0", "skipped 0"].map(value => [`          rg '^# ${value}$' build/wit-owned-packaging.log\n`, ""])
		, ["            build/wit-owned-packaging.log\n", ""]
		, ["            build/owned-wit-packaging/*.json\n", ""]
		, ["      - name: Preserve owned WIT installed execution\n        if: always()", "      - name: Preserve owned WIT installed execution\n        if: false"]
		, ["steps.owned_wit_package.outcome != 'success'", "false"]
		, ["      - wasi-consumer\n", ""]
	]) {
		const changed = prefix + jobAndFollowing.replace(before, after); assert.notEqual(changed, source);
		assert.throws(() => assertOwnedWitPackageCi(changed), before);
	}
	const unrelated = prefix.replace("build-essential cmake pkg-config zstd ripgrep", "build-essential pkg-config zstd ripgrep");
	assert.notEqual(unrelated, prefix);
	assert.doesNotThrow(() => assertOwnedWitPackageCi(unrelated + jobAndFollowing));
});
