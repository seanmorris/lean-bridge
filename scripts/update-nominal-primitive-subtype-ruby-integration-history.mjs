/**
 * Record the exact two-parent existing primitive-base and Ruby history merge.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { nominalPrimitiveSubtypeRubyIntegrationAlternate, nominalPrimitiveSubtypeRubyIntegrationChangedPaths, nominalPrimitiveSubtypeRubyIntegrationHistoryPath, nominalPrimitiveSubtypeRubyIntegrationPredecessor, reverseNominalPrimitiveSubtypeRubyIntegrationAlternateUpdate, reverseNominalPrimitiveSubtypeRubyIntegrationUpdate } from "../tests/helpers/nominal-primitive-subtype-ruby-integration-history.mjs";

const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), nominalPrimitiveSubtypeRubyIntegrationPredecessor
	, "Primitive-base nominal Ruby integration history is draft-only at its exact first parent; never rewrite a committed ledger");
assert.equal(git(["rev-parse", "MERGE_HEAD"]).trim(), nominalPrimitiveSubtypeRubyIntegrationAlternate
	, "Primitive-base nominal Ruby integration history requires its exact alternate merge parent");
for(const parent of [nominalPrimitiveSubtypeRubyIntegrationPredecessor, nominalPrimitiveSubtypeRubyIntegrationAlternate])
	assert.ok(!git(["ls-tree", "--name-only", parent, "--", nominalPrimitiveSubtypeRubyIntegrationHistoryPath]).trim()
		, "Never rewrite a committed primitive-base nominal Ruby integration ledger");

const directory = await mkdtemp(join(tmpdir(), "lean-bridge-primitive-nominal-ruby-integration-history-draft-"));
try
{
	const currentPath = join(directory, "current"), parentPath = join(directory, "parent");
	const diff = async (current, parent) => {
		await writeFile(currentPath, current); await writeFile(parentPath, parent);
		try
		{
			return git(["diff", "--histogram", "--no-index", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", parentPath, currentPath]);
		}
		catch(error)
		{
			if(error.status !== 1 || typeof error.stdout !== "string") throw error;
			return error.stdout;
		}
	};
	const transition = async (path, source, parent) => {
		const currentLines = source.split(/(?<=\n)/u), parentLines = parent.split(/(?<=\n)/u);
		const edits = [...(await diff(source, parent)).matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu)].map(match => {
			const parentCount = Number(match[2] ?? 1), currentCount = Number(match[4] ?? 1);
			const parentStart = Number(match[1]) - (parentCount ? 1 : 0), currentStart = Number(match[3]) - (currentCount ? 1 : 0);
			return { start: currentLines.slice(0, currentStart).join("").length
				, previous: parentLines.slice(parentStart, parentStart + parentCount).join("")
				, current: currentLines.slice(currentStart, currentStart + currentCount).join("") };
		});
		return { sha256: sha256(parent), edits };
	};
	const sourceAt = (commit, path) => git(["show", `${commit}:${path}`]);
	const existsAt = (commit, path) => Boolean(git(["ls-tree", "--name-only", commit, "--", path]).trim());
	const updates = [];
	for(const path of nominalPrimitiveSubtypeRubyIntegrationChangedPaths)
	{
		const source = await readFile(path, "utf8"), update = { path, currentSha256: sha256(source) };
		if(existsAt(nominalPrimitiveSubtypeRubyIntegrationPredecessor, path))
		{
			const first = sourceAt(nominalPrimitiveSubtypeRubyIntegrationPredecessor, path);
			assert.notEqual(source, first, path);
			const primary = await transition(path, source, first);
			update.previousSha256 = primary.sha256; update.edits = primary.edits;
			assert.equal(reverseNominalPrimitiveSubtypeRubyIntegrationUpdate(source, update), first);
		}
		if(existsAt(nominalPrimitiveSubtypeRubyIntegrationAlternate, path))
		{
			const alternate = sourceAt(nominalPrimitiveSubtypeRubyIntegrationAlternate, path);
			assert.notEqual(source, alternate, path);
			const secondary = await transition(path, source, alternate);
			update.alternateSha256 = secondary.sha256; update.alternateEdits = secondary.edits;
			assert.equal(reverseNominalPrimitiveSubtypeRubyIntegrationAlternateUpdate(source, update), alternate);
		}
		assert.ok(update.previousSha256 || update.alternateSha256, `${path} must exist in a merge parent`);
		updates.push(update);
	}
	assert.deepEqual(updates.filter(update => update.previousSha256).map(update => update.path)
		, nominalPrimitiveSubtypeRubyIntegrationChangedPaths.filter(path => existsAt(nominalPrimitiveSubtypeRubyIntegrationPredecessor, path)));
	assert.deepEqual(updates.filter(update => update.alternateSha256).map(update => update.path)
		, nominalPrimitiveSubtypeRubyIntegrationChangedPaths.filter(path => existsAt(nominalPrimitiveSubtypeRubyIntegrationAlternate, path)));
	await writeFile(nominalPrimitiveSubtypeRubyIntegrationHistoryPath, JSON.stringify({
		schemaVersion: 1
		, milestone: "nominal-primitive-subtype-ruby-integration-source-v1"
		, predecessorCommit: nominalPrimitiveSubtypeRubyIntegrationPredecessor
		, alternateCommit: nominalPrimitiveSubtypeRubyIntegrationAlternate
		, updates
	}, null, 2) + "\n");
	process.stdout.write(`Recorded ${updates.length} exact first-parent transitions and ${updates.filter(update => update.alternateSha256).length} exact alternate-parent transitions.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
