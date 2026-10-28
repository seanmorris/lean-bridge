/**
 * Authenticate the Core historical-contract repair and its exact pin refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	beforeCoreHistoricalContractRepairSource
	, coreHistoricalContractRepairAddedPaths
	, coreHistoricalContractRepairChangedPaths
	, coreHistoricalContractRepairCommits
	, coreHistoricalContractRepairHistoryPath
	, coreHistoricalContractRepairImplementation
	, coreHistoricalContractRepairPredecessor
	, reverseCoreHistoricalContractRepairUpdate
} from "./core-historical-contract-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	coreHistoricalContractRepairHistoryPath, "utf8"
));
const digestSource = async input => {
	const digest = createHash("sha256");
	for await(const chunk of input) digest.update(chunk);
	return digest.digest("hex");
};

test("Core historical-contract repair records exactly its two implementation commits", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), ["additions"
		, "implementationCommit", "implementationCommits", "milestone"
		, "predecessorCommit", "schemaVersion", "scope", "updates"]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "core-historical-contract-repair-source-v1");
	assert.equal(record.predecessorCommit
		, coreHistoricalContractRepairPredecessor);
	assert.equal(record.implementationCommit
		, coreHistoricalContractRepairImplementation);
	assert.deepEqual(record.implementationCommits
		, coreHistoricalContractRepairCommits);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${coreHistoricalContractRepairPredecessor}..${coreHistoricalContractRepairImplementation}`])
		.trim().split("\n"), coreHistoricalContractRepairCommits);
	assert.deepEqual(git(["diff", "--name-only"
		, coreHistoricalContractRepairPredecessor
		, coreHistoricalContractRepairImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...coreHistoricalContractRepairChangedPaths].sort());
	assert.deepEqual(record.updates.map(item => item.path)
		, coreHistoricalContractRepairChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(await digestSource(gitSourceBytes(
			coreHistoricalContractRepairPredecessor, update.path))
		, update.previousSha256, update.path);
		await authenticateSourceHistoryReverse(gitSourceBytes(
			coreHistoricalContractRepairImplementation, update.path), update);
		if(update.path !== "docs/type-surface.v1.json")
		{
			const previous = git(["show"
				, `${coreHistoricalContractRepairPredecessor}:${update.path}`]);
			const current = git(["show"
				, `${coreHistoricalContractRepairImplementation}:${update.path}`]);
			assert.equal(reverseCoreHistoricalContractRepairUpdate(current, update)
				, previous, update.path);
			assert.equal(beforeCoreHistoricalContractRepairSource(
				update.path, current), previous, update.path);
			assert.equal(beforeCoreHistoricalContractRepairSource(
				update.path, current, update.currentSha256), current, update.path);
		}
	}
});

test("Core historical-contract repair additions restore exactly", async () => {
	const record = await readRecord();
	assert.deepEqual(record.additions.map(item => item.path)
		, coreHistoricalContractRepairAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await readFile(addition.path))
		, addition.currentSha256, addition.path);
});

test("Core historical-contract repair refuses altered transitions", async () => {
	const record = await readRecord();
	const selected = [record.updates[0], record.updates.at(-1)];
	for(const update of selected)
	{
		const current = git(["show"
			, `${coreHistoricalContractRepairImplementation}:${update.path}`]);
		for(const changed of [{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }])
			assert.throws(() => reverseCoreHistoricalContractRepairUpdate(
				current, changed));
		const unknown = `${current}unrelated\n`;
		assert.equal(beforeCoreHistoricalContractRepairSource(
			update.path, unknown), unknown);
		assert.throws(() => reverseCoreHistoricalContractRepairUpdate(
			unknown, update));
	}
});

const retainedPinPaths = async update => {
	const expected = new Map([
		["docs/php.md", 6], ["docs/consume/dotnet.md", 5]
		, ["docs/consume/java.md", 5], ["docs/consume/kotlin.md", 6]
		, ["docs/consume/perl.md", 1], ["docs/consume/python.md", 1]
		, ["docs/consume/ruby.md", 1], ["docs/consume/rust.md", 1]
		, ["docs/consume/wit-wasi.md", 2]
		, ["tests/callback-checked-record-native-ci.test.mjs", 2]
		, ["tests/helpers/wasm-entry-evidence.mjs", 16]
		, ["tests/helpers/wasm-entry-supplement.mjs", 16]
		, ["tests/wasm-entry-evidence.test.mjs", 16]
	]);
	const counts = new Map();
	const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
	let pending = "", offset = 0, previousLine = "", next = 0;
	const consume = line => {
		const edit = update.edits[next];
		if(edit?.start === offset)
		{
			assert.equal(line, edit.current);
			assert.match(edit.previous, /^ *"sha256": "[0-9a-f]{64}"\n$/u);
			assert.match(edit.current, /^ *"sha256": "[0-9a-f]{64}"\n$/u);
			const match = previousLine.match(/^ *"path": "([^"\n]+)",\n$/u);
			assert.ok(match);
			const filename = match[1];
			assert.ok(expected.has(filename), filename);
			assert.equal(edit.current.match(/[0-9a-f]{64}/u)[0]
				, sha256(git(["show"
					, `${coreHistoricalContractRepairImplementation}:${filename}`])));
			counts.set(filename, (counts.get(filename) ?? 0) + 1);
			next++;
		}
		else assert.ok(edit === undefined || edit.start >= offset + line.length);
		previousLine = line;
		offset += line.length;
	};
	const source = gitSourceBytes(
		coreHistoricalContractRepairImplementation, update.path);
	for await(const chunk of source)
	{
		pending += decoder.decode(chunk, { stream: true });
		let newline;
		while((newline = pending.indexOf("\n")) !== -1)
		{
			consume(pending.slice(0, newline + 1));
			pending = pending.slice(newline + 1);
		}
	}
	pending += decoder.decode();
	if(pending) consume(pending);
	assert.equal(next, update.edits.length);
	const sorted = entries => [...entries].sort(([left], [right]) =>
		left.localeCompare(right));
	assert.deepEqual(sorted(counts), sorted(expected));
	return counts;
};

test("Core historical-contract repair refreshes only 78 exact evidence pins", async () => {
	const record = await readRecord();
	const update = record.updates.find(item =>
		item.path === "docs/type-surface.v1.json");
	const counts = await retainedPinPaths(update);
	assert.equal([...counts.values()].reduce((sum, count) => sum + count, 0), 78);
});

test("Core historical-contract repair changes only each generated Fin row", async () => {
	const record = await readRecord();
	const documents = record.updates.filter(item => item.path.endsWith(".md"));
	assert.equal(documents.length, 10);
	for(const update of documents)
	{
		assert.equal(update.edits.length, 1, update.path);
		const [edit] = update.edits;
		assert.ok(edit.previous.startsWith("| `Fin n` |"), update.path);
		assert.ok(edit.current.startsWith("| `Fin n` |"), update.path);
		assert.ok(edit.previous.includes("callback input, callback result")
			, update.path);
		assert.ok(!edit.current.includes("Not audited (callback input, callback result)")
			, update.path);
	}
});

test("Core historical-contract repair writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-core-historical-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = arguments_ => execFileSync("git", arguments_, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-historical-contract-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
