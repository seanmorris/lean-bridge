/**
 * Preserve exact prior evidence while supplying GDB to the hosted Ruby entry-counter tests.
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
import { beforeGenericNpmClosureSource } from "./generic-record-npm-closure-source-history.mjs";
import { beforeRubyGdbCiSource, rubyGdbCiChangedPaths, rubyGdbCiHistoryPath, rubyGdbCiPredecessor, reverseRubyGdbCiUpdate } from "./ruby-gdb-ci-source-history.mjs";

test("Ruby GDB CI history authenticates exact predecessors and refuses unrecorded edits", async () => {
	const record = JSON.parse(await readFile(rubyGdbCiHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "ruby-gdb-ci-v1");
	assert.equal(record.predecessorCommit, rubyGdbCiPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), rubyGdbCiChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeGenericNpmClosureSource(update.path, await readFile(update.path, "utf8")), previous = reverseRubyGdbCiUpdate(source, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforeRubyGdbCiSource(update.path, source), previous);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), previous);
		assert.equal(beforeRubyGdbCiSource(update.path, source, update.currentSha256), source);
		assert.equal(beforeFinRefinementSource(update.path, source), beforeFinRefinementSource(update.path, previous));
		const changed = source + "\n// unknown edit\n";
		assert.equal(beforeRubyGdbCiSource(update.path, changed), changed);
		assert.throws(() => reverseRubyGdbCiUpdate(changed, update));
		assert.throws(() => reverseRubyGdbCiUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseRubyGdbCiUpdate(source, { ...update, path: "unregistered.mjs" }));
		assert.throws(() => reverseRubyGdbCiUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("Ruby GDB CI refreshes exactly 119 source pins without changing any support claim", async () => {
	const path = "docs/type-surface.v1.json", text = beforeGenericNpmClosureSource(path, await readFile(path, "utf8"));
	const current = JSON.parse(text), previous = JSON.parse(beforeRubyGdbCiSource(path, text));
	const record = JSON.parse(await readFile(rubyGdbCiHistoryPath, "utf8"));
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
	assert.equal(pins, 119);
	assert.deepEqual(current, previous);
});

test("Ruby GDB CI retains the reviewed two-file handoff and changes no ptrace policy", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.equal(sha256(workflow), "f65f2adfde627a7860f4de7449cc4409318c0882bf959c8805106d6337e9dc61");
	const source = await readFile("tests/documentation.test.mjs", "utf8");
	const addition = 'import "./helpers/ruby-gdb-ci-source-history-tests.mjs";\n';
	assert.equal(source.split(addition).length, 2);
	assert.equal(sha256(source.replace(addition, "")), "14d0c14c45c0bdd0437cab338306f0f3d71b0745153ec4a4bef682dd217f9d92");
	const step = workflow.split("      - name: Install dependencies for type_corpus_ruby\n")[1].split("      - name:")[0];
	assert.match(step, /timeout-minutes: 20/u);
	assert.match(step, /sudo apt-get install -y python3-venv pkg-config gdb\n/u);
	assert.match(step, /test -x \/usr\/bin\/gdb\n {10}\/usr\/bin\/gdb --version\n/u);
	assert.match(step, /cat \/proc\/sys\/kernel\/yama\/ptrace_scope\n/u);
	assert.doesNotMatch(step, /gdb[^\n]*\||sysctl|sudo tee|continue-on-error/u);
});

test("the Ruby GDB CI updater refuses another HEAD before any write", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-gdb-ci-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-ruby-gdb-ci-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Ruby GDB CI history is draft-only at its exact predecessor/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
