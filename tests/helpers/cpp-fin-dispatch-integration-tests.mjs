/**
 * Authenticate C++ scalar entry-counter integration without changing support claims.
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
import { beforeCppFinDispatchIntegrationSource, cppFinDispatchIntegrationChangedPaths, cppFinDispatchIntegrationHistoryPath, cppFinDispatchIntegrationPredecessor, reverseCppFinDispatchIntegrationUpdate } from "./cpp-fin-dispatch-integration-source-history.mjs";

test("C++ Fin dispatch integration history authenticates exact predecessors and rejects unrecorded edits", async () => {
	const record = JSON.parse(await readFile(cppFinDispatchIntegrationHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "cpp-fin-dispatch-integration-v1");
	assert.equal(record.predecessorCommit, cppFinDispatchIntegrationPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), cppFinDispatchIntegrationChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8"), previous = reverseCppFinDispatchIntegrationUpdate(source, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforeCppFinDispatchIntegrationSource(update.path, source), previous);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), previous);
		assert.equal(beforeCppFinDispatchIntegrationSource(update.path, source, update.currentSha256), source);
		assert.equal(beforeFinRefinementSource(update.path, source), beforeFinRefinementSource(update.path, previous));
		const changed = source + "\n// unknown edit\n";
		assert.equal(beforeCppFinDispatchIntegrationSource(update.path, changed), changed);
		assert.throws(() => reverseCppFinDispatchIntegrationUpdate(changed, update));
		assert.throws(() => reverseCppFinDispatchIntegrationUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseCppFinDispatchIntegrationUpdate(source, { ...update, path: "unknown.mjs" }));
		assert.throws(() => reverseCppFinDispatchIntegrationUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("C++ Fin dispatch integration refreshes source pins without changing any observation or support claim", async () => {
	const path = "docs/type-surface.v1.json", source = await readFile(path, "utf8");
	const current = JSON.parse(source), previous = JSON.parse(beforeCppFinDispatchIntegrationSource(path, source));
	const history = JSON.parse(await readFile(cppFinDispatchIntegrationHistoryPath));
	let pins = 0;
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		const update = history.updates.find(update => update.path === file.path && update.previousSha256 === file.sha256);
		if(update)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	assert.equal(pins, 2); assert.deepEqual(current, previous);
	for(const evidence of current.evidence) for(const file of evidence.files)
		assert.equal(sha256(await readFile(file.path)), file.sha256, file.path);
});

test("C++ Fin dispatch integration history updater refuses another HEAD before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-cpp-fin-dispatch-integration-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-cpp-fin-dispatch-integration-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1); assert.match(result.stderr, /C\+\+ Fin dispatch integration history is draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});

test("C++ Fin integration preserves the independently reviewed producer sources exactly", async () => {
	const sources = {
		"tests/native-fin.test.mjs": "6641496c3a13b6bb0512c6c5757ebc8bb04be0f9545f67861812c25d4bf78b31"
		, "tests/helpers/cpp-fin-dispatch.mjs": "f19610c6f710366a0ca458eed771810fe7c3f2168c2ced2aff57003e7a1950d3"
		, "tests/helpers/cpp-fin-dispatch-tests.mjs": "3b69bdbcc7f46c22f0525342764537601b46c3c0ae6a4a1eaf8a459acfca8d00"
	};
	for(const [path, expected] of Object.entries(sources)) assert.equal(sha256(await readFile(path)), expected, path);
	const root = await readFile("tests/native-fin.test.mjs", "utf8");
	assert.ok(root.includes('import "./helpers/cpp-fin-dispatch-tests.mjs";'));
	assert.ok(root.includes('const relocation = await relocate(profile, consumer, packages, observation);\n\t\t\tif(profile === "cpp") dispatch = await observeCppFinDispatch({ consumer, packages, model });'));
	assert.ok(root.includes('t => checkInstalledFin(t));'));
	assert.ok(root.includes('t => checkInstalledFin(t, true));'));
});
