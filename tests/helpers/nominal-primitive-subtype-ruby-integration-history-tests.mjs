/**
 * Check exact reconstruction of both existing primitive-base and Ruby merge parents.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeNominalPrimitiveSubtypeRubyIntegrationSource, nominalPrimitiveSubtypeRubyIntegrationAlternate, nominalPrimitiveSubtypeRubyIntegrationChangedPaths, nominalPrimitiveSubtypeRubyIntegrationHistoryPath, nominalPrimitiveSubtypeRubyIntegrationPredecessor, reverseNominalPrimitiveSubtypeRubyIntegrationAlternateUpdate, reverseNominalPrimitiveSubtypeRubyIntegrationUpdate } from "./nominal-primitive-subtype-ruby-integration-history.mjs";
import { nominalPrimitiveSubtypeRubyRegistrationHistoryPath } from "./nominal-primitive-subtype-ruby-registration-history.mjs";

test("existing primitive-base and Ruby integration authenticates both merge parents", async () => {
	const record = JSON.parse(await readFile(nominalPrimitiveSubtypeRubyIntegrationHistoryPath));
	const registration = JSON.parse(await readFile(nominalPrimitiveSubtypeRubyRegistrationHistoryPath));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "nominal-primitive-subtype-ruby-integration-source-v1");
	assert.equal(record.predecessorCommit, nominalPrimitiveSubtypeRubyIntegrationPredecessor);
	assert.equal(record.alternateCommit, nominalPrimitiveSubtypeRubyIntegrationAlternate);
	assert.deepEqual(record.updates.map(update => update.path), nominalPrimitiveSubtypeRubyIntegrationChangedPaths);
	const at = (commit, path) => execFileSync("git", ["show", `${commit}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = await readFile(update.path, "utf8");
		assert.equal(beforeNominalPrimitiveSubtypeRubyIntegrationSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeNominalPrimitiveSubtypeRubyIntegrationSource(update.path, current + "unknown"), current + "unknown");
		if(update.previousSha256)
		{
			const first = at(record.predecessorCommit, update.path);
			assert.equal(reverseNominalPrimitiveSubtypeRubyIntegrationUpdate(current, update), first);
			assert.equal(beforeNominalPrimitiveSubtypeRubyIntegrationSource(update.path, current), first);
			assert.equal(beforeNominalPrimitiveSubtypeRubyIntegrationSource(update.path, current, update.previousSha256), first);
			assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), first);
			for(const mutate of [
				item => { item.path = "unknown"; }
				, item => { item.currentSha256 = "0".repeat(64); }
				, item => { item.previousSha256 = "0".repeat(64); }
				, item => { item.edits = []; }
				, item => { item.edits[0].start = -1; }
				, item => { item.edits[0].current += "unknown"; }
			]) {
				const changed = structuredClone(update); mutate(changed);
				assert.throws(() => reverseNominalPrimitiveSubtypeRubyIntegrationUpdate(current, changed));
			}
		}
		else
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e", `${record.predecessorCommit}:${update.path}`]).status, 0);
			assert.throws(() => reverseNominalPrimitiveSubtypeRubyIntegrationUpdate(current, update));
		}
		if(update.alternateSha256)
		{
			const alternate = at(record.alternateCommit, update.path);
			assert.equal(reverseNominalPrimitiveSubtypeRubyIntegrationAlternateUpdate(current, update), alternate);
			assert.equal(beforeNominalPrimitiveSubtypeRubyIntegrationSource(update.path, current, update.alternateSha256), alternate);
			assert.equal(beforeFinRefinementSource(update.path, current, update.alternateSha256), alternate);
			const registrationUpdate = registration.updates.find(item => item.path === update.path);
			if(registrationUpdate)
				assert.equal(beforeNominalPrimitiveSubtypeRubyIntegrationSource(update.path, current, registrationUpdate.previousSha256)
					, at(registration.predecessorCommit, update.path));
			for(const mutate of [
				item => { item.alternateSha256 = "0".repeat(64); }
				, item => { item.alternateEdits = []; }
				, item => { item.alternateEdits[0].current += "unknown"; }
			]) {
				const changed = structuredClone(update); mutate(changed);
				assert.throws(() => reverseNominalPrimitiveSubtypeRubyIntegrationAlternateUpdate(current, changed));
			}
		}
		else
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e", `${record.alternateCommit}:${update.path}`]).status, 0);
			assert.throws(() => reverseNominalPrimitiveSubtypeRubyIntegrationAlternateUpdate(current, update));
		}
	}
});

test("existing primitive-base and Ruby integration writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-primitive-nominal-ruby-integration-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-nominal-primitive-subtype-ruby-integration-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only at its exact first parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
