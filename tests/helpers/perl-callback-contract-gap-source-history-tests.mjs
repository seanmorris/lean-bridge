/**
 * Authenticate the omitted 18804049 Perl callback contract transition.
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
	beforePerlCallbackContractGapSource
	, reversePerlCallbackContractGapUpdate
	, perlCallbackContractGapAddedPaths
	, perlCallbackContractGapHistoricalCommit
	, perlCallbackContractGapHistoricalPaths
	, perlCallbackContractGapHistoricalPredecessor
	, perlCallbackContractGapHistoryPath
	, perlCallbackContractGapPredecessor
} from "./perl-callback-contract-gap-source-history.mjs";
import { beforePostPerlCallbackStaging } from "./post-perl-callback-staging-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	perlCallbackContractGapHistoryPath, "utf8"
));

test("Perl callback contract gap records exactly the omitted 18804049 transition", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), ["additions", "historicalCommit"
		, "historicalPredecessorCommit", "historicalTransitions", "milestone"
		, "predecessorCommit", "schemaVersion", "scope"]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "perl-callback-contract-gap-source-v1");
	assert.equal(record.predecessorCommit, perlCallbackContractGapPredecessor);
	assert.equal(record.historicalPredecessorCommit
		, perlCallbackContractGapHistoricalPredecessor);
	assert.equal(record.historicalCommit, perlCallbackContractGapHistoricalCommit);
	assert.equal(git(["rev-parse", `${perlCallbackContractGapHistoricalCommit}^`]).trim()
		, perlCallbackContractGapHistoricalPredecessor);
	assert.deepEqual(record.historicalTransitions.map(item => item.path)
		, perlCallbackContractGapHistoricalPaths);
	for(const transition of record.historicalTransitions)
	{
		assert.equal(transition.previousCommit, perlCallbackContractGapHistoricalPredecessor);
		assert.equal(transition.currentCommit, perlCallbackContractGapHistoricalCommit);
		const previous = git(["show", `${transition.previousCommit}:${transition.path}`]);
		const current = git(["show", `${transition.currentCommit}:${transition.path}`]);
		assert.equal(sha256(previous), transition.previousSha256, transition.path);
		assert.equal(sha256(current), transition.currentSha256, transition.path);
		assert.equal(reversePerlCallbackContractGapUpdate(current, transition)
			, previous, transition.path);
		assert.equal(beforePerlCallbackContractGapSource(transition.path, current)
			, previous, transition.path);
		assert.equal(beforePerlCallbackContractGapSource(transition.path, current,
			transition.currentSha256), current);
	}
});

test("Perl callback contract gap restores both original acceptance source pins", async () => {
	const record = await readRecord();
	const [transition] = record.historicalTransitions;
	const current = await readFile(transition.path);
	assert.equal(sha256(current), transition.currentSha256);
	for(const path of [
		"docs/evidence/owned-perl-callback-results-20261003.json"
		, "docs/evidence/owned-perl-callback-result-variants-20261003.json"
	]){
		const original = JSON.parse(await readFile(path, "utf8"));
		assert.equal(original.sources[transition.path], transition.previousSha256);
		const restored = beforePostPerlCallbackStaging(
			transition.path, current, original.sources[transition.path]);
		assert.equal(sha256(restored), transition.previousSha256, path);
		const unknown = Buffer.from(current.toString() + "\n// unrelated\n");
		assert.equal(sha256(beforePostPerlCallbackStaging(
			transition.path, unknown, original.sources[transition.path])), sha256(unknown));
	}
});

test("Perl callback contract gap additions restore exactly", async () => {
	const record = await readRecord();
	assert.deepEqual(record.additions.map(item => item.path)
		, perlCallbackContractGapAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256, addition.path);
});

test("Perl callback contract gap rejects altered transitions and unknown content", async () => {
	const record = await readRecord();
	for(const transition of record.historicalTransitions)
	{
		const current = git(["show", `${transition.currentCommit}:${transition.path}`]);
		for(const changed of [{ ...transition, currentSha256: "0".repeat(64) }
			, { ...transition, previousSha256: "0".repeat(64) }
			, { ...transition, path: "unknown.mjs" }
			, { ...transition, edits: [] }
			, { ...transition, edits: [...transition.edits, transition.edits[0]] }])
			assert.throws(() => reversePerlCallbackContractGapUpdate(current, changed));
		const shifted = structuredClone(transition);
		shifted.edits[0].start += 1;
		assert.throws(() => reversePerlCallbackContractGapUpdate(current, shifted));
		const unknown = `${current}unrelated\n`;
		assert.equal(beforePerlCallbackContractGapSource(transition.path, unknown), unknown);
		assert.throws(() => reversePerlCallbackContractGapUpdate(unknown, transition));
		assert.equal(beforePerlCallbackContractGapSource("docs/unrelated.md", current), current);
	}
});

test("Perl callback contract gap writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-perl-callback-contract-gap-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = arguments_ => execFileSync("git", arguments_, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-perl-callback-contract-gap-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact predecessor commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
