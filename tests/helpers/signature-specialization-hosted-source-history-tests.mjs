/**
 * Authenticate the hosted specialization archive/replay source milestone.
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
	beforeSignatureSpecializationHostedSource
	, reverseSignatureSpecializationHostedUpdate
	, signatureSpecializationHostedAddedPaths
	, signatureSpecializationHostedChangedPaths
	, signatureSpecializationHostedHistoryPath
	, signatureSpecializationHostedImplementation
	, signatureSpecializationHostedImplementationAdditions
	, signatureSpecializationHostedPredecessor
} from "./signature-specialization-hosted-source-history.mjs";
import {
	signatureSpecializationHostedPerlProducer
	, signatureSpecializationHostedProducer
	, signatureSpecializationHostedRepairProducer
	, signatureSpecializationHostedSourcePath
	, signatureSpecializationHostedSources
} from "./signature-specialization-hosted-archive.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	signatureSpecializationHostedHistoryPath, "utf8"
));

test("hosted specialization retention restores its exact implementation", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), [
		"additions", "implementationAdditions", "implementationCommit"
		, "milestone", "predecessorCommit", "schemaVersion", "scope"
		, "updates"
	].sort());
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "signature-specialization-hosted-source-v1");
	assert.equal(record.predecessorCommit
		, signatureSpecializationHostedPredecessor);
	assert.equal(record.implementationCommit
		, signatureSpecializationHostedImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, signatureSpecializationHostedChangedPaths);
	for(const update of record.updates)
	{
		const previous = git(["show"
			, `${signatureSpecializationHostedPredecessor}:${update.path}`]);
		const current = git(["show"
			, `${signatureSpecializationHostedImplementation}:${update.path}`]);
		assert.equal(reverseSignatureSpecializationHostedUpdate(
			current, update), previous, update.path);
		assert.equal(beforeSignatureSpecializationHostedSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("hosted specialization retention additions and source roles restore exactly", async () => {
	const record = await readRecord();
	assert.deepEqual(record.implementationAdditions.map(item => item.path)
		, signatureSpecializationHostedImplementationAdditions);
	for(const addition of record.implementationAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, signatureSpecializationHostedPredecessor
			, "--", addition.path]).trim(), "");
		assert.equal(sha256(git(["show"
			, `${signatureSpecializationHostedImplementation}:${addition.path}`]))
			, addition.currentSha256, addition.path);
	}
	assert.deepEqual(record.additions.map(item => item.path)
		, signatureSpecializationHostedAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
	const sources = signatureSpecializationHostedSources({
		producers: [...new Set([
			signatureSpecializationHostedProducer
			, signatureSpecializationHostedRepairProducer
			, signatureSpecializationHostedPerlProducer
		])].sort()
		, checker: signatureSpecializationHostedImplementation
		, archiver: signatureSpecializationHostedImplementation
	});
	for(const [role, entry] of [
		["producer", "tests/reviewed-specializations.test.mjs"]
		, ["checker", "tests/helpers/signature-specialization-hosted-evidence.mjs"]
		, ["archiver", "scripts/archive-signature-specialization-hosted.mjs"]
	]) assert.ok(sources.some(source =>
		source.role === role && source.path === entry), `${role}:${entry}`);
	for(const [revision, entry] of [
		[signatureSpecializationHostedProducer
			, "tests/fixtures/specialization-consumers/php-native.php"]
		, [signatureSpecializationHostedRepairProducer
			, "tests/fixtures/specialization-consumers/php-wasm.php"]
		, [signatureSpecializationHostedPerlProducer
			, "tests/fixtures/specialization-consumers/perl.pl"]
	]) assert.ok(sources.some(source => source.role === "producer"
		&& source.revision === revision && source.path === entry)
	, `${revision}:${entry}`);
	assert.equal(new Set(sources.map(signatureSpecializationHostedSourcePath)).size
		, sources.length);
});

test("hosted specialization retention rejects altered transitions", async () => {
	const update = (await readRecord()).updates[0];
	const current = git(["show"
		, `${signatureSpecializationHostedImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseSignatureSpecializationHostedUpdate(
		current, forged));
});

test("hosted specialization history writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-signature-specialization-hosted-history-"));
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
		"scripts/update-signature-specialization-hosted-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
