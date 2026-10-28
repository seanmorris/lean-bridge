/**
 * Authenticate local integration of the merged Perl codegen replay.
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
	beforePerlCodegenMergedIntegrationSource
	, perlCodegenMergedIntegrationAddedPaths
	, perlCodegenMergedIntegrationBase
	, perlCodegenMergedIntegrationHistoryPath
	, perlCodegenMergedIntegrationImplementation
	, perlCodegenMergedIntegrationPathCommits
	, perlCodegenMergedIntegrationPaths
	, reversePerlCodegenMergedIntegrationUpdate
} from "./perl-codegen-merged-integration-source-history.mjs";
import { perlCodegenMergedHistoryPath } from "./perl-codegen-merged-source-history.mjs";
import { perlCodegenProducerReplayIntegrationHistoryPath } from "./perl-codegen-producer-replay-integration-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	perlCodegenMergedIntegrationHistoryPath, "utf8"));

test("merged Perl integration restores the exact pre-cherry-pick hub", async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.baseCommit, perlCodegenMergedIntegrationBase);
	assert.equal(record.implementationCommit
		, perlCodegenMergedIntegrationImplementation);
	assert.deepEqual(record.pathCommits
		, perlCodegenMergedIntegrationPathCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, perlCodegenMergedIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, perlCodegenMergedIntegrationAddedPaths);
	assert.deepEqual(record.histories, [
		{ path: perlCodegenMergedHistoryPath
			, sha256: sha256(await readFile(perlCodegenMergedHistoryPath)) }
		, { path: perlCodegenProducerReplayIntegrationHistoryPath
			, sha256: sha256(await readFile(
				perlCodegenProducerReplayIntegrationHistoryPath)) }
	]);
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${perlCodegenMergedIntegrationImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${perlCodegenMergedIntegrationBase}:${update.path}`]);
		assert.equal(reversePerlCodegenMergedIntegrationUpdate(current, update)
			, previous, update.path);
		assert.equal(beforePerlCodegenMergedIntegrationSource(update.path
			, current, update.previousSha256), previous, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
});

test("merged Perl integration rejects altered transitions", async () => {
	const record = await readRecord(), update = record.updates[0];
	const current = git(["show"
		, `${perlCodegenMergedIntegrationImplementation}:${update.path}`]);
	assert.throws(() => reversePerlCodegenMergedIntegrationUpdate(current
		, { ...update, currentSha256: "0".repeat(64) }));
	assert.equal(beforePerlCodegenMergedIntegrationSource(update.path
		, `${current}unknown\n`), `${current}unknown\n`);
});

test("merged Perl integration writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-perl-codegen-merge-int-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = arguments_ => execFileSync("git", arguments_, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-perl-codegen-merged-integration-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.deepEqual(await readdir(root), [".git"]);
});
