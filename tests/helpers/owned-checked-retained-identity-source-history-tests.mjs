/**
 * Authenticate the retained-resource test correction against the existing lease contract.
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
	beforeOwnedCheckedRetainedIdentitySource
	, ownedCheckedRetainedIdentityAddedPaths
	, ownedCheckedRetainedIdentityChangedPaths
	, ownedCheckedRetainedIdentityImplementationPaths
	, ownedCheckedRetainedIdentityCommits
	, ownedCheckedRetainedIdentityIntegrationBase
	, ownedCheckedRetainedIdentityHistoryPath
	, ownedCheckedRetainedIdentityImplementation
	, ownedCheckedRetainedIdentityIntegrationPaths
	, ownedCheckedRetainedIdentityPredecessor
	, reverseOwnedCheckedRetainedIdentityUpdate
} from "./owned-checked-retained-identity-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 ** 2 });
const read = async () => JSON.parse(await readFile(ownedCheckedRetainedIdentityHistoryPath));
const predecessor = ownedCheckedRetainedIdentityPredecessor;
const implementation = ownedCheckedRetainedIdentityImplementation;

test("Owned checked retained identity records its exact implementation and integration", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-checked-retained-identity-source-v1");
	assert.equal(record.predecessorCommit, predecessor);
	assert.equal(record.implementationCommit, implementation);
	assert.equal(record.integrationBaseCommit, ownedCheckedRetainedIdentityIntegrationBase);
	assert.deepEqual(record.implementationCommits, ownedCheckedRetainedIdentityCommits);
	for(const [index, commit] of ownedCheckedRetainedIdentityCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", commit]).trim()
			, index === 0 ? predecessor : ownedCheckedRetainedIdentityCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only", predecessor, implementation]).trim().split("\n")
		, [...ownedCheckedRetainedIdentityImplementationPaths].sort());
	assert.deepEqual(record.updates.map(update => update.path), ownedCheckedRetainedIdentityChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path), ownedCheckedRetainedIdentityIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path), ownedCheckedRetainedIdentityAddedPaths);
});

test("Owned checked retained identity reverses all three source transitions", async () => {
	const record = await read();
	assert.equal(record.updates.length + record.integrationUpdates.length, 3);
	const updates = [...record.updates, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		const prior = record.integrationUpdates.includes(update) ? ownedCheckedRetainedIdentityIntegrationBase : predecessor;
		const original = git(["show", `${prior}:${update.path}`]);
		assert.equal(reverseOwnedCheckedRetainedIdentityUpdate(current, update), original);
		assert.equal(beforeOwnedCheckedRetainedIdentitySource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), original);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256))
			, addition.currentSha256);
});

test("Owned checked retained identity preserves runtime and original evidence", () => {
	for(const path of ["src", "docs/reference", "docs/consume", "docs/lean"
		, "site", "package.json", "package-lock.json", "lean-toolchain"
		, "docs/type-surface.v1.json"
		, "tests/fixtures/onboarding/owned-checked-records"])
		assert.equal(git(["rev-parse", `${predecessor}:${path}`])
			, git(["rev-parse", `${implementation}:${path}`]), path);
	assert.equal(git(["diff", "--name-only", "--diff-filter=MDRCT"
		, predecessor, implementation, "--", "docs/evidence"]), "");
});

test("Owned checked retained identity refuses unknown and altered transitions", async () => {
	const update = (await read()).updates.find(item => item.path !== "docs/type-surface.v1.json");
	const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseOwnedCheckedRetainedIdentityUpdate(current, forged));
	assert.equal(beforeOwnedCheckedRetainedIdentitySource(update.path, current + "unknown"), current + "unknown");
	assert.equal(beforeOwnedCheckedRetainedIdentitySource("unrelated.mjs", current), current);
});

test("Owned checked retained identity writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-checked-retained-identity-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const child = spawnSync(process.execPath, [resolve("scripts/update-owned-checked-retained-identity-source-history.mjs")]
		, { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(child.status, 0);
	assert.equal(child.stdout, "");
	assert.deepEqual(await readdir(root), []);
});

test("Owned checked retained identity separates a live retained resource from true expiry", async () => {
	const path = "docs/evidence/owned-checked-retained-identity-20261025.json";
	const qualification = JSON.parse(git(["show", `${implementation}:${path}`]));
	assert.equal(qualification.kind, "owned-checked-retained-identity-source-v1");
	assert.equal(qualification.sourceBaseCommit, predecessor);
	assert.equal(qualification.failure.run, 40221585405);
	assert.equal(qualification.failure.job, 121254115511);
	assert.equal(qualification.failure.producer, "34f6bde6410c0c2b95c59fdf0db855c5a1e0085a");
	assert.deepEqual(qualification.failure.failed, ["ordinary-full", "reviewed-full"]);
	assert.deepEqual(qualification.failure.passed, ["ordinary-result-only", "reviewed-result-only"]);
	assert.equal(qualification.failure.artifact.accepted, false);
	assert.equal(qualification.failure.artifact.immutableArchivePending, true);
	assert.equal(qualification.validation.generatedHeaderChecks.tests, 2);
	assert.equal(qualification.validation.installedRuntimeExecutions, 0);
	assert.equal(qualification.validation.inventory.stalePins, 0);
	assert.equal(qualification.sources.length, 1);
	assert.equal(qualification.contractReferences.length, 5);
	for(const source of [...qualification.sources, ...qualification.contractReferences])
	{
		const original = git(["show", `${implementation}:${source.path}`]);
		assert.equal(sha256(original), source.sha256, source.path);
		assert.equal(Buffer.byteLength(original), source.bytes, source.path);
	}
	const source = git(["show", `${implementation}:${qualification.sources[0].path}`]);
	const release = source.indexOf("  release(&peer_owner);");
	const live = source.indexOf("OK(owned_checked_records_echo_claim(peer, &foreign", release);
	const acquire = source.indexOf("expired_ticket = make_ticket(peer, 74, &expired_owner)", live);
	const drop = source.indexOf("release(&expired_owner);", acquire);
	const reject = source.indexOf("CHECK(owned_checked_records_echo_claim(peer, &expired", drop);
	const retained = source.indexOf("expect_serial(peer, peer_kept, 73);", reject);
	assert.ok(release >= 0 && live > release && acquire > live && drop > acquire
		&& reject > drop && retained > reject);
	assert.ok(source.slice(reject, retained).includes("== OWNED_CHECKED_RECORDS_INVALID_ARGUMENT"));
	assert.ok(source.slice(reject, retained).includes("memcmp(saved, &out, sizeof(out)) == 0"));
	assert.equal((source.match(/expired_ticket = make_ticket/gu) ?? []).length, 1);
	assert.doesNotMatch(source, /retain\(peer, expired_ticket/u);
	const ledger = git(["show", `${implementation}:src/backends/native/owned-aggregate-leases.mjs`]);
	assert.ok(ledger.includes("if (--owner->references) return;"));
	assert.ok(ledger.includes("*token = owner->token;"));
	assert.ok(ledger.includes("++owner->references;"));
});

test("Owned checked retained identity writer cannot overwrite retained evidence", async () => {
	const before = await readFile(ownedCheckedRetainedIdentityHistoryPath);
	const result = spawnSync(process.execPath, ["--max-old-space-size=512"
		, "scripts/update-owned-checked-retained-identity-source-history.mjs"]
	, { encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.deepEqual(await readFile(ownedCheckedRetainedIdentityHistoryPath), before);
});
