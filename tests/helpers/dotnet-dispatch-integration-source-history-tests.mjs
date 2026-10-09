/**
 * Register the .NET dispatch integration without changing support claims or rewriting earlier evidence.
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
import { beforeAuthorRefinementDocsSource } from "./author-refinement-docs-source-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeDotnetDispatchIntegrationSource, dotnetDispatchIntegrationChangedPaths, dotnetDispatchIntegrationHistoryPath, dotnetDispatchIntegrationPredecessor, reverseDotnetDispatchIntegrationUpdate } from "./dotnet-dispatch-integration-source-history.mjs";

test(".NET dispatch integration history authenticates exact predecessors and refuses unknown edits", async () => {
	const record = JSON.parse(await readFile(dotnetDispatchIntegrationHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "dotnet-dispatch-integration-v1");
	assert.equal(record.predecessorCommit, dotnetDispatchIntegrationPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), dotnetDispatchIntegrationChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeAuthorRefinementDocsSource(update.path, await readFile(update.path, "utf8")), previous = reverseDotnetDispatchIntegrationUpdate(source, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforeDotnetDispatchIntegrationSource(update.path, source), previous);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), previous);
		assert.equal(beforeDotnetDispatchIntegrationSource(update.path, source, update.currentSha256), source);
		assert.equal(beforeFinRefinementSource(update.path, source), beforeFinRefinementSource(update.path, previous));
		const changed = source + "\n// unrecorded change\n";
		assert.equal(beforeDotnetDispatchIntegrationSource(update.path, changed), changed);
		assert.throws(() => reverseDotnetDispatchIntegrationUpdate(changed, update));
		assert.throws(() => reverseDotnetDispatchIntegrationUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseDotnetDispatchIntegrationUpdate(source, { ...update, path: "unknown.mjs" }));
		assert.throws(() => reverseDotnetDispatchIntegrationUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test(".NET dispatch integration refreshes exactly 218 source pins without promoting any support cell", async () => {
	const path = "docs/type-surface.v1.json", text = beforeAuthorRefinementDocsSource(path, await readFile(path, "utf8"));
	const current = JSON.parse(text), previous = JSON.parse(beforeDotnetDispatchIntegrationSource(path, text));
	const record = JSON.parse(await readFile(dotnetDispatchIntegrationHistoryPath));
	const updates = new Map(record.updates.map(update => [update.path, update]));
	let pins = 0;
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		const update = updates.get(file.path);
		if(update && file.sha256 === update.previousSha256)
		{
			assert.equal(sha256(beforeAuthorRefinementDocsSource(file.path, await readFile(file.path, "utf8"))), update.currentSha256);
			file.sha256 = update.currentSha256; pins++;
		}
	}
	assert.equal(pins, 218);
	assert.deepEqual(current, previous);
});

test("the .NET dispatch integration retains the reviewed source and managed CI handoffs", async () => {
	const digests = {
		"tests/dotnet-fin.test.mjs": "0e875c02e5ec5a1e6c4b00c3d51d919b3db5aabd1037945b3cc613686e787b63"
		, "tests/helpers/native-fin-dispatch-gdb-run.mjs": "edbbfc38de53667bbd09b435ee5d1c73fdf9ce247625f139abe2dcf4b10c4690"
		, ".github/workflows/consumer-matrix.yml": "f556c4f9d990fe4c56a94888cab214607e00f831350b12d9a98675e87bef05ed"
		, "tests/documentation.test.mjs": "1e3b78d25deabb4128c10549620528e5239bf23644bdd1d744a11804619aeba6"
	};
	for(const [path, digest] of Object.entries(digests)) assert.equal(sha256(await readFile(path)), digest, path);
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const host of ["dotnet", "jvm"])
	{
		const step = workflow.split(`      - name: Install dependencies for type_corpus_${host}\n`)[1].split("      - name:")[0];
		assert.match(step, /test -x \/usr\/bin\/gdb\n {10}\/usr\/bin\/gdb --version\n/u);
		assert.match(step, /cat \/proc\/sys\/kernel\/yama\/ptrace_scope\n/u);
		assert.doesNotMatch(step, /gdb[^\n]*\||sysctl|sudo tee|continue-on-error/u);
	}
});

test("the .NET dispatch integration updater refuses another HEAD before any write", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-dispatch-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-dotnet-dispatch-integration-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1); assert.match(result.stderr, /.NET dispatch integration history is draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
