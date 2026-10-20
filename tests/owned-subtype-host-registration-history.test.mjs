/**
 * Authenticate the installed owned-Subtype package-script registrations.
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
	beforeOwnedSubtypeHostRegistrationSource
	, ownedSubtypeHostRegistrationAddedPaths
	, ownedSubtypeHostRegistrationChangedPaths
	, ownedSubtypeHostRegistrationDraftParent
	, ownedSubtypeHostRegistrationEpochs
	, ownedSubtypeHostRegistrationHistoryPath
	, ownedSubtypeHostRegistrationPath
	, ownedSubtypeHostRegistrationPredecessor
	, reverseOwnedSubtypeHostRegistrationUpdate
} from "./helpers/owned-subtype-host-registration-source-history.mjs";
import { sha256 } from "./helpers/source-history-digest.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});

test("owned Subtype host registrations reproduce every package-script epoch", async () => {
	const record = JSON.parse(await readFile(
		ownedSubtypeHostRegistrationHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-subtype-host-registration-source-v1");
	assert.equal(record.predecessorCommit, ownedSubtypeHostRegistrationPredecessor);
	assert.equal(record.draftParentCommit, ownedSubtypeHostRegistrationDraftParent);
	assert.deepEqual(record.registrationEpochs, ownedSubtypeHostRegistrationEpochs);
	assert.equal(record.registrations.length, ownedSubtypeHostRegistrationEpochs.length);
	for(const [index, [from, to]] of ownedSubtypeHostRegistrationEpochs.entries())
	{
		const update = record.registrations[index];
		const previous = git(["show", `${from}:${ownedSubtypeHostRegistrationPath}`]);
		const current = git(["show", `${to}:${ownedSubtypeHostRegistrationPath}`]);
		assert.equal(update.fromCommit, from); assert.equal(update.toCommit, to);
		assert.equal(reverseOwnedSubtypeHostRegistrationUpdate(current, update), previous);
	}
	const latest = git(["show"
		, `${ownedSubtypeHostRegistrationPredecessor}:${ownedSubtypeHostRegistrationPath}`]);
	const earliest = git(["show"
		, `${ownedSubtypeHostRegistrationEpochs[0][0]}:${ownedSubtypeHostRegistrationPath}`]);
	assert.equal(beforeOwnedSubtypeHostRegistrationSource(
		ownedSubtypeHostRegistrationPath, latest), earliest);
});

test("owned Subtype host registration repair has closed source transitions", async () => {
	const record = JSON.parse(await readFile(
		ownedSubtypeHostRegistrationHistoryPath, "utf8"
	));
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedSubtypeHostRegistrationChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedSubtypeHostRegistrationAddedPaths);
	for(const update of record.updates)
	{
		const current = await readFile(update.path, "utf8");
		const previous = git(["show"
			, `${ownedSubtypeHostRegistrationPredecessor}:${update.path}`]);
		assert.equal(reverseOwnedSubtypeHostRegistrationUpdate(current, update), previous);
		assert.equal(beforeOwnedSubtypeHostRegistrationSource(
			update.path, current), previous);
	}
	for(const addition of record.additions)
	{
		assert.equal(sha256(await readFile(addition.path)), addition.currentSha256);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${ownedSubtypeHostRegistrationPredecessor}:${addition.path}`]
		, { stdio: "ignore" }).status, 0);
	}
});

test("owned Subtype host registration writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-owned-subtype-host-registration-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = args => execFileSync("git", args
		, { cwd: root, env: environment, stdio: "pipe" });
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-owned-subtype-host-registration-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /exact draft parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
