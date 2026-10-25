/**
 * Authenticate direct C/WIT ownership-session assertions and preserve historical acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource, finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import {
	beforeOwnedCheckedCSessionBoundariesSource
	, ownedCheckedCSessionBoundariesAddedPaths
	, ownedCheckedCSessionBoundariesChangedPaths
	, ownedCheckedCSessionBoundariesImplementationPaths
	, ownedCheckedCSessionBoundariesCommits
	, ownedCheckedCSessionBoundariesIntegrationBase
	, ownedCheckedCSessionBoundariesHistoryPath
	, ownedCheckedCSessionBoundariesImplementation
	, ownedCheckedCSessionBoundariesIntegrationPaths
	, ownedCheckedCSessionBoundariesPredecessor
	, reverseOwnedCheckedCSessionBoundariesUpdate
} from "./owned-checked-c-session-boundaries-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 ** 2 });
const read = async () => JSON.parse(await readFile(ownedCheckedCSessionBoundariesHistoryPath));
const predecessor = ownedCheckedCSessionBoundariesPredecessor;
const implementation = ownedCheckedCSessionBoundariesImplementation;

test("Owned checked C session boundaries records its exact implementation and integration", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-checked-c-session-boundaries-source-v1");
	assert.equal(record.predecessorCommit, predecessor);
	assert.equal(record.implementationCommit, implementation);
	assert.equal(record.integrationBaseCommit, ownedCheckedCSessionBoundariesIntegrationBase);
	assert.deepEqual(record.implementationCommits, ownedCheckedCSessionBoundariesCommits);
	for(const [index, commit] of ownedCheckedCSessionBoundariesCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", commit]).trim()
			, index === 0 ? predecessor : ownedCheckedCSessionBoundariesCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only", predecessor, implementation]).trim().split("\n")
		, [...ownedCheckedCSessionBoundariesImplementationPaths].sort());
	assert.deepEqual(record.updates.map(update => update.path), ownedCheckedCSessionBoundariesChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path), ownedCheckedCSessionBoundariesIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path), ownedCheckedCSessionBoundariesAddedPaths);
});

test("Owned checked C session boundaries reverses all three source transitions", async () => {
	const record = await read();
	assert.equal(record.updates.length + record.integrationUpdates.length, 3);
	const updates = [...record.updates, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		const prior = record.integrationUpdates.includes(update) ? ownedCheckedCSessionBoundariesIntegrationBase : predecessor;
		const original = git(["show", `${prior}:${update.path}`]);
		assert.equal(reverseOwnedCheckedCSessionBoundariesUpdate(current, update), original);
		assert.equal(beforeOwnedCheckedCSessionBoundariesSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), original);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256))
			, addition.currentSha256);
});

test("Owned checked C session boundaries preserves runtime and original evidence", () => {
	for(const path of ["src", "docs/reference", "docs/consume", "docs/lean"
		, "site", "package.json", "package-lock.json", "lean-toolchain"
		, "docs/type-surface.v1.json"
		, "tests/fixtures/onboarding/owned-checked-records"])
		assert.equal(git(["rev-parse", `${predecessor}:${path}`])
			, git(["rev-parse", `${implementation}:${path}`]), path);
	assert.equal(git(["diff", "--name-only", "--diff-filter=MDRCT"
		, predecessor, implementation, "--", "docs/evidence"]), "");
});

test("Owned checked C session boundaries refuses unknown and altered transitions", async () => {
	const update = (await read()).updates.find(item => item.path !== "docs/type-surface.v1.json");
	const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseOwnedCheckedCSessionBoundariesUpdate(current, forged));
	assert.equal(beforeOwnedCheckedCSessionBoundariesSource(update.path, current + "unknown"), current + "unknown");
	assert.equal(beforeOwnedCheckedCSessionBoundariesSource("unrelated.mjs", current), current);
});

test("Owned checked C session boundaries writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-checked-c-session-boundaries-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const child = spawnSync(process.execPath, [resolve("scripts/update-owned-checked-c-session-boundaries-source-history.mjs")]
		, { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(child.status, 0);
	assert.equal(child.stdout, "");
	assert.deepEqual(await readdir(root), []);
});

test("Owned checked C session boundaries binds actual caller checks without claiming runtime execution", async () => {
	const path = "docs/evidence/owned-checked-c-session-boundaries-20261025.json";
	const qualification = JSON.parse(git(["show", `${implementation}:${path}`]));
	assert.equal(qualification.kind, "owned-checked-c-session-boundaries-source-v1");
	assert.equal(qualification.sourceBaseCommit, predecessor);
	assert.deepEqual(qualification.sources.map(source => source.path), ownedCheckedCSessionBoundariesChangedPaths);
	assert.deepEqual(qualification.cases.foreignSessions.serials, [41, 73, 89]);
	assert.equal(qualification.cases.foreignSessions.repetitions, 10);
	assert.equal(qualification.cases.foreignSessions.checks.length, 8);
	assert.equal(qualification.validation.headerChecks.tests, 2);
	assert.equal(qualification.validation.installedRuntimeExecutions, 0);
	assert.equal(qualification.validation.inventory.stalePins, 0);
	assert.equal(qualification.validation.inventory.changedLivePins, 0);
	assert.equal(qualification.pending.length, 3);
	for(const source of qualification.sources)
	{
		const original = git(["show", `${implementation}:${source.path}`]);
		assert.equal(sha256(original), source.sha256, source.path);
		assert.equal(Buffer.byteLength(original), source.bytes, source.path);
		assert.equal(await sourceAtFinHistoryMilestone(source.path, source.sha256), original);
		for(const required of [
			"static void check_session_boundaries("
			, "check_session_boundaries(session, ticket, retained);"
			, "make_ticket(peer, 73, &peer_owner)"
			, "owned_checked_records_echo_claim(peer, &valid"
			, "owned_checked_records_pair_claim(session, &booking, &foreign"
			, "owned_checked_records_claim_t entries[] = {valid, foreign};"
			, "first_owner == first_saved && second_owner == second_saved"
			, "state.calls == 2 && moving_owner == NULL && owner == NULL"
			, "owned_checked_records_result_release(&consumed_owner)"
			, "owned_checked_records_claim_closure_result_t_call(peer, closure"
			, "owned_checked_records_echo_claim(closed_peer, &peer_valid"
			, "make_ticket(peer, 89, &peer_owner)"
		]) assert.ok(original.includes(required), required);
	}
	for(const path of [
		"tests/fixtures/structured-types/owned-checked-record-result-only.c"
		, "tests/fixtures/structured-types/owned-checked-record-installed.cpp"
		, "tests/owned-checked-record-native-packaging.test.mjs"
		, "tests/owned-checked-record-managed-packaging.test.mjs"
		, ".github/workflows/owned-checked-record-native-perl.yml"
		, ".github/workflows/owned-checked-record-managed.yml"
	]) assert.equal(git(["rev-parse", `${predecessor}:${path}`])
		, git(["rev-parse", `${implementation}:${path}`]), path);
});

test("Owned checked C session boundaries writer cannot overwrite retained evidence", async () => {
	const before = await readFile(ownedCheckedCSessionBoundariesHistoryPath);
	const result = spawnSync(process.execPath, ["--max-old-space-size=512"
		, "scripts/update-owned-checked-c-session-boundaries-source-history.mjs"]
	, { encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.deepEqual(await readFile(ownedCheckedCSessionBoundariesHistoryPath), before);
});
