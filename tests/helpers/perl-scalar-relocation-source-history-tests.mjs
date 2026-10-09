/**
 * Register the Perl scalar relocation without changing support claims or rewriting earlier evidence.
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
import { beforePerlScalarRelocationSource, perlScalarRelocationChangedPaths, perlScalarRelocationHistoryPath, perlScalarRelocationPredecessor, reversePerlScalarRelocationUpdate } from "./perl-scalar-relocation-source-history.mjs";

test("Perl scalar relocation history authenticates exact predecessors and refuses unknown edits", async () => {
	const record = JSON.parse(await readFile(perlScalarRelocationHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "perl-scalar-relocation-v1");
	assert.equal(record.predecessorCommit, perlScalarRelocationPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), perlScalarRelocationChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8"), previous = reversePerlScalarRelocationUpdate(source, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforePerlScalarRelocationSource(update.path, source), previous);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), previous);
		assert.equal(beforePerlScalarRelocationSource(update.path, source, update.currentSha256), source);
		assert.equal(beforeFinRefinementSource(update.path, source), beforeFinRefinementSource(update.path, previous));
		const changed = source + "\n// unrecorded change\n";
		assert.equal(beforePerlScalarRelocationSource(update.path, changed), changed);
		assert.throws(() => reversePerlScalarRelocationUpdate(changed, update));
		assert.throws(() => reversePerlScalarRelocationUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reversePerlScalarRelocationUpdate(source, { ...update, path: "unknown.mjs" }));
		assert.throws(() => reversePerlScalarRelocationUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("Perl scalar relocation preserves the inventory without refreshing pins or promoting support", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	assert.equal(sha256(text), "61a1e5cc72f8736bf7f26a2a4b6d729678956419b951e4013a1d3868269ac833", "the 0bc379f inventory is unchanged");
	const current = JSON.parse(text), previous = JSON.parse(beforePerlScalarRelocationSource(path, text));
	const record = JSON.parse(await readFile(perlScalarRelocationHistoryPath));
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
	assert.equal(pins, 0);
	assert.deepEqual(current, previous);
});

test("Perl scalar relocation retains the reviewed handoff and three-source counter scope", async () => {
	const source = await readFile("tests/perl-fin.test.mjs", "utf8");
	const registration = 'import "./helpers/perl-scalar-relocation-source-history-tests.mjs";\n';
	assert.equal(source.split(registration).length, 2);
	assert.equal(sha256(source.replace(registration, "")), "49d933169b4e0fea7cfd5c4bdfa9941e2ffeafdee19b4ea45f31dd721d5789f8");
	assert.match(source, /static unsigned long counts\[3\];/u);
});

test("the Perl scalar relocation updater refuses another HEAD before any write", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-perl-scalar-relocation-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-perl-scalar-relocation-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1); assert.match(result.stderr, /Perl scalar relocation history is draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
