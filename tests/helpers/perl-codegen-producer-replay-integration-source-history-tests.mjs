/**
 * Authenticate central registration of the Perl codegen producer replay.
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
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforePerlCodegenProducerReplayIntegrationSource
	, perlCodegenProducerReplayIntegrationAddedPaths
	, perlCodegenProducerReplayIntegrationBase
	, perlCodegenProducerReplayIntegrationHistoryPath
	, perlCodegenProducerReplayIntegrationImplementation
	, perlCodegenProducerReplayIntegrationPaths
	, reversePerlCodegenProducerReplayIntegrationUpdate
} from "./perl-codegen-producer-replay-integration-source-history.mjs";
import { perlCodegenProducerReplayHistoryPath } from "./perl-codegen-producer-replay-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtRecordedTransition } from "./recorded-transition-source.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	perlCodegenProducerReplayIntegrationHistoryPath, "utf8"
));

test("Perl codegen producer replay integration restores its exact hub and partition", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), [
		"additions", "baseHistory", "baseCommit", "implementationCommit"
		, "milestone", "schemaVersion", "scope", "updates"
	].sort());
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "perl-codegen-producer-replay-integration-v1");
	assert.equal(record.baseCommit, perlCodegenProducerReplayIntegrationBase);
	assert.equal(record.implementationCommit
		, perlCodegenProducerReplayIntegrationImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, perlCodegenProducerReplayIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, perlCodegenProducerReplayIntegrationAddedPaths);
	assert.deepEqual(record.baseHistory, {
		path: perlCodegenProducerReplayHistoryPath
		, sha256: sha256(await readFile(perlCodegenProducerReplayHistoryPath))
	});
	for(const update of record.updates)
	{
		// The recorded integration commit was later re-applied with a join, so it is
		// rebuilt from its own base rather than reversed from the live tree.
		const current = sourceAtRecordedTransition(perlCodegenProducerReplayIntegrationBase, update);
		const previous = git(["show"
			, `${perlCodegenProducerReplayIntegrationBase}:${update.path}`]);
		assert.equal(reversePerlCodegenProducerReplayIntegrationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(update.path, current
			, update.previousSha256), previous, update.path);
		assert.equal(beforePerlCodegenProducerReplayIntegrationSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
});

test("Perl codegen producer replay integration rejects altered transitions", async () => {
	const record = await readRecord();
	const update = record.updates[0];
	const current = sourceAtRecordedTransition(perlCodegenProducerReplayIntegrationBase, update);
	assert.throws(() => sourceAtRecordedTransition(perlCodegenProducerReplayIntegrationBase
		, { ...update, currentSha256: "0".repeat(64) }));
	assert.throws(() => sourceAtRecordedTransition(perlCodegenProducerReplayIntegrationImplementation, update));
	assert.throws(() => reversePerlCodegenProducerReplayIntegrationUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.equal(beforePerlCodegenProducerReplayIntegrationSource(update.path
		, `${current}unknown\n`), `${current}unknown\n`);
});

test("Perl codegen producer replay integration writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-perl-codegen-producer-replay-integration-"));
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
		"scripts/update-perl-codegen-producer-replay-integration-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration implementation/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
