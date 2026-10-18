/**
 * Authenticate the two historical aggregator registration gaps and this repair's own transitions.
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
import { sourceAtHistoryMilestone } from "./source-history-test-source.mjs";
import {
	beforeNominalPrimitiveSubtypeRegistrationGapSource
	, nominalPrimitiveSubtypeRegistrationGapChangedPaths
	, nominalPrimitiveSubtypeRegistrationGapHistoryPath
	, nominalPrimitiveSubtypeRegistrationGapPath
	, nominalPrimitiveSubtypeRegistrationGapPredecessor
	, nominalPrimitiveSubtypeRegistrationGaps
	, reverseNominalPrimitiveSubtypeRegistrationGapUpdate
} from "./nominal-primitive-subtype-registration-gap-history.mjs";

const show = (revision, path) => execFileSync("git", ["show", `${revision}:${path}`]
	, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const sha256 = text => execFileSync("sha256sum", { input: text, encoding: "utf8" }).slice(0, 64);

test("primitive-base registration gaps reproduce both unrecorded aggregator epochs exactly", async () => {
	const record = JSON.parse(await readFile(nominalPrimitiveSubtypeRegistrationGapHistoryPath, "utf8"));
	assert.equal(record.milestone, "nominal-primitive-subtype-registration-gap-source-v1");
	assert.deepEqual(Object.keys(record.gaps).sort(), Object.keys(nominalPrimitiveSubtypeRegistrationGaps).sort());
	const path = nominalPrimitiveSubtypeRegistrationGapPath;
	for(const [name, [from, to]] of Object.entries(nominalPrimitiveSubtypeRegistrationGaps))
	{
		const update = record.gaps[name], previous = show(from, path), current = show(to, path);
		assert.equal(update.previousSha256, sha256(previous)); assert.equal(update.currentSha256, sha256(current));
		assert.equal(reverseNominalPrimitiveSubtypeRegistrationGapUpdate(current, update), previous);
		assert.equal(beforeNominalPrimitiveSubtypeRegistrationGapSource(name, path, current), previous);
		assert.equal(beforeNominalPrimitiveSubtypeRegistrationGapSource(name, path, current, update.currentSha256), current);
		assert.equal(beforeNominalPrimitiveSubtypeRegistrationGapSource(name, path, current + "x"), current + "x");
		// The edits only add test registrations.
		for(const edit of update.edits)
		{
			assert.equal(edit.previous, "");
			assert.match(edit.current, /^(?:import "\.\/nominal-primitive-subtype-[a-z-]+-tests\.mjs";\n)+$/u);
		}
		// The whole hub now reaches the earlier epoch from the current aggregator.
		const reached = beforeFinRefinementSource(path, await readFile(path, "utf8"), update.previousSha256);
		assert.equal(sha256(reached), update.previousSha256, name);
	}
});

test("primitive-base registration repair records its own exact source transitions", async () => {
	const record = JSON.parse(await readFile(nominalPrimitiveSubtypeRegistrationGapHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, nominalPrimitiveSubtypeRegistrationGapPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), nominalPrimitiveSubtypeRegistrationGapChangedPaths);
	for(const update of record.updates)
	{
		// Newer layers may edit the same sources; stop at this repair's recorded output.
		const current = sourceAtHistoryMilestone(
			nominalPrimitiveSubtypeRegistrationGapHistoryPath, update.path
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = show(nominalPrimitiveSubtypeRegistrationGapPredecessor, update.path);
		assert.equal(reverseNominalPrimitiveSubtypeRegistrationGapUpdate(current, update), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
	}
});

test("primitive-base registration gap writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-primitive-registration-gap-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	const identity = ["-c", "user.name=Test", "-c", "user.email=test@example.invalid"];
	git([...identity, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const script = resolve("scripts/update-nominal-primitive-subtype-registration-gap-history.mjs");
	const result = spawnSync(process.execPath, [script], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
