/**
 * Check the scoped Perl promotion, immutable archive and exact source-history integration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { beforeFinRefinementSource } from "./helpers/fin-refinement-source-history.mjs";
import { perlRelocatedPromotionIds, perlRelocatedReviewedId, promotePerlRelocatedInventory, promotePerlRelocatedObservations } from "./helpers/perl-relocated-promotion.mjs";
import { beforePerlRelocatedPromotionSource, perlRelocatedPromotionChangedPaths, perlRelocatedPromotionHistoryPath, perlRelocatedPromotionPredecessor, reversePerlRelocatedPromotionUpdate } from "./helpers/perl-relocated-promotion-source-history.mjs";

test("Perl relocated promotion authenticates all exact predecessors and refuses unknown edits", async () => {
	const history = JSON.parse(await readFile(perlRelocatedPromotionHistoryPath));
	assert.equal(history.schemaVersion, 1); assert.equal(history.milestone, "perl-relocated-promotion-v1");
	assert.equal(history.predecessorCommit, perlRelocatedPromotionPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), perlRelocatedPromotionChangedPaths);
	for(const update of history.updates)
	{
		const current = await readFile(update.path, "utf8"), previous = reversePerlRelocatedPromotionUpdate(current, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforePerlRelocatedPromotionSource(update.path, current), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current), beforeFinRefinementSource(update.path, previous));
		const changed = current + "\n// unknown edit\n";
		assert.equal(beforePerlRelocatedPromotionSource(update.path, changed), changed);
		assert.throws(() => reversePerlRelocatedPromotionUpdate(changed, update));
		assert.throws(() => reversePerlRelocatedPromotionUpdate(current, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reversePerlRelocatedPromotionUpdate(current, { ...update, path: "unknown.mjs" }));
		assert.throws(() => reversePerlRelocatedPromotionUpdate(current, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("Perl inventory adds only two ordinary observations and reviewed-container relocation", async () => {
	const path = "docs/type-surface.v1.json", source = await readFile(path, "utf8");
	const current = JSON.parse(source), previous = JSON.parse(beforePerlRelocatedPromotionSource(path, source));
	const expected = await promotePerlRelocatedInventory(previous);
	const history = JSON.parse(await readFile(perlRelocatedPromotionHistoryPath));
	for(const evidence of expected.evidence.slice(0, previous.evidence.length)) for(const file of evidence.files)
	{
		const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update) file.sha256 = update.currentSha256;
	}
	assert.deepEqual(current, expected, "No other claim, artifact or source pin may change");
	assert.equal(current.observations.length, previous.observations.length + 2);
	assert.equal(current.evidence.length, previous.evidence.length + 4);
	for(const observation of previous.observations)
		if(observation.id !== perlRelocatedReviewedId) assert.deepEqual(current.observations.find(item => item.id === observation.id), observation);
	for(const id of perlRelocatedPromotionIds)
	{
		const observation = current.observations.find(item => item.id === id);
		assert.deepEqual(observation.profiles, ["perl"]);
		assert.deepEqual(observation.positions, ["parameter", "result"]);
		assert.equal(observation.path, "ordinary-source");
		for(const stage of Object.values(observation.stages)) assert.equal(stage.state, "passed");
	}
	assert.throws(() => promotePerlRelocatedObservations(current.observations), /Already promoted/u);
	assert.throws(() => promotePerlRelocatedObservations(previous.observations.filter(item => item.id !== perlRelocatedReviewedId)));
	for(const evidence of current.evidence) for(const file of evidence.files)
		assert.equal(sha256(await readFile(file.path)), file.sha256, file.path);
});

test("Perl promotion evidence binds four configurations per selection and does not invent scalar relocation", async () => {
	const inventory = JSON.parse(await readFile("docs/type-surface.v1.json"));
	const evidence = inventory.evidence.filter(item => item.id.startsWith("perl-relocated-"));
	assert.equal(evidence.length, 4);
	for(const entry of evidence)
	{
		assert.equal(entry.revision, "93c60a0487d0b2acc0b6d562cd72a3876738a666");
		assert.equal(entry.artifacts.length, 8);
		assert.equal(new Set(entry.artifacts.map(file => file.path.split("/")[0])).size, 4);
		assert.match(entry.scope, /installed tree is moved/u);
		assert.match(entry.scope, /Package binaries are not retained/u);
	}
	assert.match(evidence.find(item => item.id === "perl-relocated-container-hosted-installed").scope, /does not establish relocated scalar/u);
	const consumer = await readFile("docs/consume/perl.md", "utf8");
	assert.ok(consumer.includes("perl-refinements-20261009.md"));
	const subtypeRow = consumer.split("\n").find(line => line.startsWith("| `Subtype /"));
	const finRow = consumer.split("\n").find(line => line.startsWith("| `Fin n`"));
	assert.match(finRow, /generated Some->new\(value\) for presence/u);
	const fixture = await readFile("tests/fixtures/fin-container-consumers/perl.pl", "utf8");
	assert.ok(fixture.includes("LeanBridge::FinContainers::Some->new($_[0])"));
	assert.match(subtypeRow, /Ordinary source: Installed checks passed \(input, result\)/u);
	assert.match(subtypeRow, /Reviewed IR: Not audited/u);
	for(const root of ["perl-relocated-hosted-evidence", "perl-relocated-promotion"])
		assert.equal(classifyRepositoryTest(`tests/${root}.test.mjs`), "contract");
});

test("Perl promotion updater refuses an unrelated HEAD before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-perl-relocated-promotion-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-perl-relocated-promotion-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1); assert.match(result.stderr, /Perl relocated promotion history is draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
