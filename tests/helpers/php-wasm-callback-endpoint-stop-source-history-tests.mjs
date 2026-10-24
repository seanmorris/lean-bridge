/**
 * Authenticate the PHP-Wasm callback-result bridge's own-endpoint stop.
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
import {
	beforePhpWasmCallbackEndpointStopSource
	, phpWasmCallbackEndpointStopAddedPaths
	, phpWasmCallbackEndpointStopChangedPaths
	, phpWasmCallbackEndpointStopHistoryPath
	, phpWasmCallbackEndpointStopImplementation
	, phpWasmCallbackEndpointStopPredecessor
	, reversePhpWasmCallbackEndpointStopUpdate
} from "./php-wasm-callback-endpoint-stop-source-history.mjs";
import {
	beforePhpWasmCallbackResultAcceptance, readPhpWasmCallbackResultHistory
} from "./php-wasm-callback-result-acceptance-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	phpWasmCallbackEndpointStopHistoryPath, "utf8"
));
// A small successor-reader path recorded by the bridge, and a path it does not record.
const recordedPath = "tests/helpers/wit-owned-projection-history.mjs";
const unrecordedPath = "tests/owned-ruby-transfers.test.mjs";

test("PHP-Wasm endpoint stop records exactly its one implementation transition", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), ["additions"
		, "implementationCommit", "milestone", "predecessorCommit"
		, "schemaVersion", "scope", "updates"]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "php-wasm-callback-endpoint-stop-source-v1");
	assert.equal(record.predecessorCommit, phpWasmCallbackEndpointStopPredecessor);
	assert.equal(record.implementationCommit
		, phpWasmCallbackEndpointStopImplementation);
	assert.equal(git(["rev-parse", `${phpWasmCallbackEndpointStopImplementation}^`])
		.trim(), phpWasmCallbackEndpointStopPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmCallbackEndpointStopPredecessor
		, phpWasmCallbackEndpointStopImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...phpWasmCallbackEndpointStopChangedPaths].sort());
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmCallbackEndpointStopChangedPaths);
	for(const update of record.updates)
	{
		const previous = git(["show"
			, `${phpWasmCallbackEndpointStopPredecessor}:${update.path}`]);
		const current = git(["show"
			, `${phpWasmCallbackEndpointStopImplementation}:${update.path}`]);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reversePhpWasmCallbackEndpointStopUpdate(current, update)
			, previous, update.path);
		assert.equal(beforePhpWasmCallbackEndpointStopSource(update.path, current)
			, previous, update.path);
		assert.equal(beforePhpWasmCallbackEndpointStopSource(
			update.path, current, update.currentSha256), current, update.path);
	}
});

test("PHP-Wasm endpoint stop additions restore exactly", async () => {
	const record = await readRecord();
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmCallbackEndpointStopAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256, addition.path);
});

test("PHP-Wasm endpoint stop rejects altered transitions and unknown content", async () => {
	const record = await readRecord();
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${phpWasmCallbackEndpointStopImplementation}:${update.path}`]);
		for(const changed of [{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reversePhpWasmCallbackEndpointStopUpdate(current, changed));
		const shifted = structuredClone(update);
		shifted.edits[0].start += 1;
		assert.throws(() => reversePhpWasmCallbackEndpointStopUpdate(current, shifted));
		const unknown = `${current}unrelated\n`;
		assert.equal(beforePhpWasmCallbackEndpointStopSource(update.path, unknown), unknown);
		assert.throws(() => reversePhpWasmCallbackEndpointStopUpdate(unknown, update));
		assert.equal(beforePhpWasmCallbackEndpointStopSource("docs/unrelated.md", current)
			, current);
	}
});

test("PHP-Wasm bridge stops newer history at its own recorded endpoint", async () => {
	const acceptance = readPhpWasmCallbackResultHistory();
	const own = acceptance.readerUpdates.find(item => item.path === recordedPath);
	assert.ok(own, recordedPath);
	assert.equal(acceptance.updates.some(item => item.path === recordedPath), false);
	const live = await readFile(recordedPath, "utf8");
	assert.notEqual(sha256(live), own.currentSha256, "the control must cross newer history");
	// Without a stop, the bridge peels exactly its own transition after newer history.
	assert.equal(sha256(beforePhpWasmCallbackResultAcceptance(recordedPath, live))
		, own.previousSha256);
	// An explicit stop keeps the caller's identity.
	const endpoint = beforeFinRefinementSource(recordedPath, live, own.currentSha256);
	assert.equal(sha256(endpoint), own.currentSha256);
	assert.equal(beforePhpWasmCallbackResultAcceptance(
		recordedPath, live, own.currentSha256), endpoint);
	// Unknown bytes stay byte-identical.
	const unknown = `${live}\n// unrecorded change\n`;
	assert.equal(beforePhpWasmCallbackResultAcceptance(recordedPath, unknown), unknown);
});

test("PHP-Wasm bridge leaves unrecorded paths to the hub unchanged", async () => {
	const acceptance = readPhpWasmCallbackResultHistory();
	for(const category of ["readerUpdates", "updates"])
		assert.equal(acceptance[category].some(item => item.path === unrecordedPath)
			, false, category);
	const live = await readFile(unrecordedPath, "utf8");
	assert.equal(beforePhpWasmCallbackResultAcceptance(unrecordedPath, live)
		, beforeFinRefinementSource(unrecordedPath, live));
});

test("PHP-Wasm endpoint stop writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-wasm-endpoint-stop-"));
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
		"scripts/update-php-wasm-callback-endpoint-stop-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
