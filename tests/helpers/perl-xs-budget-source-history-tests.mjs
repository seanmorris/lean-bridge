/**
 * Preserve prior evidence and the complete per-ABI acceptance chain when raising its budget.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforePerlXsBudgetSource, perlXsBudgetChangedPaths, perlXsBudgetHistoryPath, perlXsBudgetPredecessor, reversePerlXsBudgetUpdate } from "./perl-xs-budget-source-history.mjs";

test("Perl XS budget history authenticates exact predecessors and rejects unrecorded edits", async () => {
	const record = JSON.parse(await readFile(perlXsBudgetHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "perl-xs-budget-v1");
	assert.equal(record.predecessorCommit, perlXsBudgetPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), perlXsBudgetChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8"), previous = reversePerlXsBudgetUpdate(source, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforePerlXsBudgetSource(update.path, source), previous);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), previous);
		assert.equal(beforePerlXsBudgetSource(update.path, source, update.currentSha256), source);
		assert.equal(beforeFinRefinementSource(update.path, source), beforeFinRefinementSource(update.path, previous));
		const changed = source + "\n// unknown edit\n";
		assert.equal(beforePerlXsBudgetSource(update.path, changed), changed);
		assert.throws(() => reversePerlXsBudgetUpdate(changed, update));
		assert.throws(() => reversePerlXsBudgetUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reversePerlXsBudgetUpdate(source, { ...update, path: "unregistered.mjs" }));
		assert.throws(() => reversePerlXsBudgetUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("Perl XS budget refreshes exactly 40 source pins without changing coverage", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const current = JSON.parse(text), previous = JSON.parse(beforePerlXsBudgetSource(path, text));
	const record = JSON.parse(await readFile(perlXsBudgetHistoryPath, "utf8"));
	const updates = new Map(record.updates.map(update => [update.path, update]));
	let pins = 0;
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		const update = updates.get(file.path);
		if(update && file.sha256 === update.previousSha256)
		{
			assert.equal(sha256(await readFile(file.path)), update.currentSha256);
			file.sha256 = update.currentSha256; pins++;
		}
	}
	assert.equal(pins, 40);
	assert.deepEqual(current, previous);
});

test("the Perl XS workflow changes only its job budget and explanation", async () => {
	const path = ".github/workflows/perl-consumer.yml", text = await readFile(path, "utf8");
	const before = "    # Copied and owned package families run sequentially on each Perl ABI.\n    timeout-minutes: 120";
	const after = "    # Copied and owned package families run sequentially on each Perl ABI; the\n    # installed Compare and Verify chain alone took up to about 105 minutes.\n    timeout-minutes: 180";
	assert.equal(text.split(after).length, 2);
	assert.equal(beforePerlXsBudgetSource(path, text), text.replace(after, before));
});

test("the Perl XS budget updater refuses another HEAD before any write", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-perl-xs-budget-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-perl-xs-budget-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Perl XS budget history is draft-only at its exact predecessor/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
