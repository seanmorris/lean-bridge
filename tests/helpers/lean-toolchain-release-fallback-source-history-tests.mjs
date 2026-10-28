/**
 * Authenticate the checksummed Lean release fallback source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	beforeLeanToolchainReleaseFallbackSource
	, leanToolchainReleaseFallbackAddedPaths
	, leanToolchainReleaseFallbackHistoryPath
	, leanToolchainReleaseFallbackImplementation
	, leanToolchainReleaseFallbackImplementationPaths
	, leanToolchainReleaseFallbackIntegrationPaths
	, leanToolchainReleaseFallbackNormalizationPaths
	, leanToolchainReleaseFallbackPredecessor
	, reverseLeanToolchainReleaseFallbackUpdate
} from "./lean-toolchain-release-fallback-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 16 * 1024 ** 2 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const readRecord = async () => JSON.parse(await readFile(
	leanToolchainReleaseFallbackHistoryPath, "utf8"
));

test("Lean release fallback records its exact source range", async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "lean-toolchain-release-fallback-source-v1");
	assert.equal(record.predecessorCommit
		, leanToolchainReleaseFallbackPredecessor);
	assert.equal(record.implementationCommit
		, leanToolchainReleaseFallbackImplementation);
	assert.equal(git(["rev-parse"
		, `${leanToolchainReleaseFallbackImplementation}^`]).trim()
		, leanToolchainReleaseFallbackPredecessor);
	assert.equal(git(["rev-parse", `${record.integrationCommit}^`]).trim()
		, leanToolchainReleaseFallbackImplementation);
	assert.deepEqual(names(["diff", "--name-only"
		, leanToolchainReleaseFallbackPredecessor
		, leanToolchainReleaseFallbackImplementation])
		, [...leanToolchainReleaseFallbackImplementationPaths].sort());
	assert.deepEqual(names(["diff", "--name-only"
		, leanToolchainReleaseFallbackImplementation, record.integrationCommit])
		, [...leanToolchainReleaseFallbackAddedPaths
			, ...leanToolchainReleaseFallbackIntegrationPaths].sort());
	assert.deepEqual(record.updates.map(update => update.path)
		, leanToolchainReleaseFallbackImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, leanToolchainReleaseFallbackIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, leanToolchainReleaseFallbackAddedPaths);
});

test("Lean release fallback pins and verifies the official archive", () => {
	const source = git(["show"
		, `${leanToolchainReleaseFallbackImplementation}:scripts/bootstrap-toolchains.sh`]);
	assert.match(source
		, /^LEAN_ARCHIVE=lean-4\.32\.2-linux\.tar\.zst$/mu);
	assert.match(source
		, /^LEAN_ARCHIVE_URL="https:\/\/github\.com\/leanprover\/lean4\/releases\/download\/v4\.32\.2\/\$LEAN_ARCHIVE"$/mu);
	assert.match(source
		, /^LEAN_ARCHIVE_SHA256=5f2069e6f5db73780f374ccb49ce8ea649aa20a0cebf0116816744c999ce72aa$/mu);
	assert.match(source, /printf '%s {2}%s\\n'.*sha256sum -c -/u);
	assert.match(source, /staged_commit=.*LEAN_COMMIT/su);
	assert.match(source, /Refusing to replace unexpected Lean toolchain path/u);
});

test("Lean release fallback reverses every source endpoint", async () => {
	const record = await readRecord();
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${leanToolchainReleaseFallbackImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${leanToolchainReleaseFallbackPredecessor}:${update.path}`]);
		assert.equal(reverseLeanToolchainReleaseFallbackUpdate(current, update)
			, previous);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeLeanToolchainReleaseFallbackSource);
		const previous = git(["show"
			, `${leanToolchainReleaseFallbackImplementation}:${update.path}`]);
		assert.equal(reverseLeanToolchainReleaseFallbackUpdate(current, update)
			, previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
	}
	for(const path of leanToolchainReleaseFallbackNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path));
});

test("Lean release fallback leaves the type surface unchanged", () => {
	for(const path of ["docs/type-surface.v1.json"
		, "docs/consumer-support.v1.json", "schema/binding-ir.schema.json"])
		assert.equal(git(["rev-parse"
			, `${leanToolchainReleaseFallbackPredecessor}:${path}`])
			, git(["rev-parse"
				, `${leanToolchainReleaseFallbackImplementation}:${path}`]), path);
});

test("Lean release fallback rejects altered transitions", async () => {
	const update = (await readRecord()).updates[0];
	const current = git(["show"
		, `${leanToolchainReleaseFallbackImplementation}:${update.path}`]);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.sh" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() =>
			reverseLeanToolchainReleaseFallbackUpdate(current, forged));
	assert.equal(beforeLeanToolchainReleaseFallbackSource(
		"unrelated.sh", current), current);
	assert.equal(sha256(current), update.currentSha256);
});

test("Lean release fallback writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-toolchain-fallback-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-lean-toolchain-release-fallback-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
