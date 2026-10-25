/**
	* Authenticate the Core repair without rewriting original receipt bytes.
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
	beforeCoreAggregateSparseCheckoutSource
	, coreAggregateSparseCheckoutAddedPaths
	, coreAggregateSparseCheckoutChangedPaths
	, coreAggregateSparseCheckoutCommits
	, coreAggregateSparseCheckoutImplementationPaths
	, coreAggregateSparseCheckoutHistoryPath
	, coreAggregateSparseCheckoutImplementation
	, coreAggregateSparseCheckoutIntegrationBase
	, coreAggregateSparseCheckoutIntegrationPaths
	, coreAggregateSparseCheckoutPredecessor
	, reverseCoreAggregateSparseCheckoutUpdate
} from "./core-aggregate-sparse-checkout-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { gitSourceHistoryTransition } from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(coreAggregateSparseCheckoutHistoryPath, "utf8"));
const evidenceDirectory = "docs/evidence/core-aggregate-sparse-checkout-20261025";
const committed = path => git(["show", coreAggregateSparseCheckoutImplementation + ":" + path]);
const acceptance = () => JSON.parse(committed(evidenceDirectory + "/acceptance.json"));

test("Core aggregate sparse checkout authenticates its wiring and lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "core-aggregate-sparse-checkout-source-v1");
	assert.equal(record.predecessorCommit, coreAggregateSparseCheckoutPredecessor);
	assert.equal(record.implementationCommit, coreAggregateSparseCheckoutImplementation);
	assert.equal(record.integrationBaseCommit, coreAggregateSparseCheckoutIntegrationBase);
	assert.deepEqual(record.implementationCommits, coreAggregateSparseCheckoutCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, coreAggregateSparseCheckoutChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, coreAggregateSparseCheckoutIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, coreAggregateSparseCheckoutAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, coreAggregateSparseCheckoutPredecessor + ".." + coreAggregateSparseCheckoutImplementation]).trim().split("\n")
	, coreAggregateSparseCheckoutCommits);
	for(const [index, revision] of coreAggregateSparseCheckoutCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? coreAggregateSparseCheckoutPredecessor : coreAggregateSparseCheckoutCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, coreAggregateSparseCheckoutPredecessor
		, coreAggregateSparseCheckoutImplementation]).trim().split("\n")
	, [...coreAggregateSparseCheckoutImplementationPaths].sort());
	const updates = [...record.updates, ...record.integrationUpdates];
	for(const update of updates)
	{
		if(update.path === "docs/type-surface.v1.json")
		{
			assert.deepEqual(await gitSourceHistoryTransition(update.path
				, coreAggregateSparseCheckoutPredecessor
				, coreAggregateSparseCheckoutImplementation), update);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
			continue;
		}
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeCoreAggregateSparseCheckoutSource);
		const prior = record.integrationUpdates.includes(update)
			? coreAggregateSparseCheckoutIntegrationBase : coreAggregateSparseCheckoutPredecessor;
		const previous = git(["show", prior + ":" + update.path]);
		assert.equal(reverseCoreAggregateSparseCheckoutUpdate(
			current, update), previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256);
});

test("Core aggregate sparse checkout preserves runtime and changes exactly one inventory pin", async () => {
	for(const path of ["src", "site", "docs/lean", "docs/reference"
		, "docs/php.md", "docs/publish/php.md"])
		assert.equal(git(["rev-parse", coreAggregateSparseCheckoutPredecessor + ":" + path])
			, git(["rev-parse", coreAggregateSparseCheckoutImplementation + ":" + path]), path);
	assert.equal(git(["diff", "--name-only", coreAggregateSparseCheckoutPredecessor
		, coreAggregateSparseCheckoutImplementation, "--", ".github"]).trim()
	, ".github/workflows/quality.yml");
	const receipt = acceptance();
	assert.equal(receipt.inventory.exactInverse, true);
	assert.equal(receipt.inventory.refreshedPins, 1);
	assert.equal(receipt.inventory.previous.bytes, 102577221);
	assert.equal(receipt.inventory.current.bytes, 102577221);
	assert.equal(receipt.inventory.previous.sha256, "a3dd3938b125bd0abc97ef2e838d4932a5e5a5ffddbbcf77f2f57db17ba135d2");
	assert.equal(receipt.inventory.current.sha256, "68fd0a7a321eeda0637cba71f33284aea66b78f5e2e29686ae0c088559736582");
	assert.deepEqual(receipt.sourcePins.map(pin => pin.path)
		, coreAggregateSparseCheckoutChangedPaths.slice(0, 2));
	assert.deepEqual(receipt.sourcePins.map(pin => pin.count), [1, 0]);
	for(const pin of receipt.sourcePins)
	{
		assert.equal(sha256(git(["show", coreAggregateSparseCheckoutPredecessor + ":" + pin.path])), pin.previous);
		assert.equal(sha256(committed(pin.path)), pin.current);
	}
	const update = (await read()).updates.find(item => item.path === "docs/type-surface.v1.json");
	assert.equal(update.previousSha256, receipt.inventory.previous.sha256);
	assert.equal(update.currentSha256, receipt.inventory.current.sha256);
	assert.equal(update.edits.length, 1);
	assert.equal(update.edits[0].previous
		, '          "sha256": "' + receipt.sourcePins[0].previous + '"\n');
	assert.equal(update.edits[0].current
		, '          "sha256": "' + receipt.sourcePins[0].current + '"\n');
	const audit = JSON.parse(committed(receipt.validation.pinAudit.report.path));
	assert.deepEqual(audit.inventory, receipt.inventory);
	assert.deepEqual(audit.sourcePins, receipt.sourcePins);
	assert.deepEqual(receipt.pending, [
		"full-final-head-Core"
		, "remaining-final-head-target-gates"
		, "recurring-default-branch-activation"
	]);
});

test("Core aggregate sparse checkout retains the original failure, timeout evidence and seven passing checks", () => {
	const receipt = acceptance();
	const { tests, originalFailures, diagnostics, pinAudit } = receipt.validation;
	const files = [...tests.map(item => item.file), originalFailures
		, diagnostics, pinAudit.script, pinAudit.report];
	for(const file of files)
	{
		const bytes = committed(file.path);
		assert.equal(Buffer.byteLength(bytes), file.bytes);
		assert.equal(sha256(bytes), file.sha256);
	}
	assert.deepEqual(tests.map(item => item.count), [7]);
	const tap = committed(tests[0].file.path);
	assert.match(tap, /^TAP version 13\n/u);
	for(const line of ["1..7", "# tests 7", "# pass 7"
		, "# fail 0", "# skipped 0", "# cancelled 0"])
		assert.ok(tap.split("\n").includes(line), line);
	assert.doesNotMatch(tap, /^not ok |# SKIP|# TODO/mu);
	assert.match(tap, /Complete sparse aggregate: 1006 contract files across six shards at c9c6435b7616807cfa9c97280bd9a49848b810dc/u);
	const original = committed(originalFailures.path);
	assert.match(original, /^not ok 1 - Core quality has bounded/mu);
	assert.match(original, /The aggregate needs the complete test tree and verifier source, not retained evidence/u);
	assert.match(original, /^# fail 1$/mu);
	assert.match(original, /^# pass 0$/mu);
	const diagnosis = JSON.parse(committed(diagnostics.path));
	assert.equal(diagnosis.remote.run, 40160209518);
	assert.equal(diagnosis.remote.head, "8db80ea109610468c1e509037a6f1771371fa5cf");
	assert.equal(diagnosis.remote.status, "completed");
	assert.equal(diagnosis.remote.conclusion, "failure");
	assert.deepEqual(diagnosis.remote.jobs.map(item => item.id), [121069998089, 121102779708]);
	for(const job of diagnosis.remote.jobs)
	{
		assert.equal(job.status, "completed");
		assert.equal(job.conclusion, "cancelled");
		assert.ok(job.annotations.some(item =>
			/The job has exceeded the maximum execution time/u.test(item.message)));
	}
	assert.equal(receipt.validation.lint.exitCode, 0);
	assert.equal(receipt.validation.typecheck.exitCode, 0);
	assert.equal(receipt.validation.actionlint.exitCode, 0);
});

test("Core aggregate sparse checkout rejects unknown or forged transitions", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeCoreAggregateSparseCheckoutSource);
	assert.equal(beforeCoreAggregateSparseCheckoutSource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforeCoreAggregateSparseCheckoutSource(
		update.path, unknown), unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reverseCoreAggregateSparseCheckoutUpdate(current, forged));
	assert.equal(beforeCoreAggregateSparseCheckoutSource(
		"unrelated.mjs", current), current);
});

test("Core aggregate sparse checkout writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-core-aggregate-sparse-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-aggregate-sparse-checkout-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
