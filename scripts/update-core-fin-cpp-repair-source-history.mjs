#!/usr/bin/env node
/**
 * Record the explicit Core Fin/C++ repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	coreFinCppRepairAddedPaths
	, coreFinCppRepairHistoryAddedPaths
	, coreFinCppRepairImplementationAddedPaths
	, coreFinCppRepairImplementationPaths
	, coreFinCppRepairChangedPaths
	, coreFinCppRepairCommits
	, coreFinCppRepairHistoryPath
	, coreFinCppRepairImplementation
	, coreFinCppRepairIntegrationBase
	, coreFinCppRepairIntegrationPaths
	, coreFinCppRepairPredecessor
	, coreFinCppRepairPins
	, reverseCoreFinCppRepairUpdate
} from "../tests/helpers/core-fin-cpp-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = coreFinCppRepairPredecessor;
const implementation = coreFinCppRepairImplementation;
const integrationBase = coreFinCppRepairIntegrationBase;
assert.equal(git(["rev-parse", "HEAD"]).trim(), integrationBase
	, "Core Fin/C++ repair history requires its exact integration base");
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, coreFinCppRepairCommits);
for(const [index, revision] of coreFinCppRepairCommits.entries())
	assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
		, index === 0 ? predecessor : coreFinCppRepairCommits[index - 1]);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...coreFinCppRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", predecessor, implementation])
	, [...coreFinCppRepairChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A", predecessor, implementation])
	, [...coreFinCppRepairImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=DRCT", predecessor, implementation]), []);
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, coreFinCppRepairHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...coreFinCppRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreFinCppRepairHistoryAddedPaths])
, [...coreFinCppRepairHistoryAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-core-fin-cpp-repair-history-"
));
// Retain only requested hunk boundaries, not millions of per-line strings.
const lineOffsets = (source, boundaries) => {
	const result = new Map();
	let line = 0;
	let offset = 0;
	for(const boundary of [...new Set(boundaries)].sort((a, b) => a - b))
	{
		assert.ok(Number.isSafeInteger(boundary) && boundary >= 0);
		while(line < boundary)
		{
			assert.ok(offset < source.length, "Diff line exceeds source");
			const newline = source.indexOf("\n", offset);
			offset = newline === -1 ? source.length : newline + 1;
			line++;
		}
		result.set(boundary, offset);
	}
	return result;
};
const transition = async (path, previous, current) => {
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous);
	await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = git(["diff", "--histogram", "--no-index", "--no-ext-diff"
			, "--no-textconv", "--no-color", "--unified=0"
			, previousPath, currentPath]);
	}
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		diff = error.stdout;
	}
	const hunks = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			previousStart, previousEnd: previousStart + previousCount
			, currentStart, currentEnd: currentStart + currentCount
		};
	});
	const previousOffsets = lineOffsets(previous, hunks.flatMap(hunk =>
		[hunk.previousStart, hunk.previousEnd]));
	const currentOffsets = lineOffsets(current, hunks.flatMap(hunk =>
		[hunk.currentStart, hunk.currentEnd]));
	const edits = hunks.map(hunk => ({
		start: currentOffsets.get(hunk.currentStart)
		, previous: previous.slice(previousOffsets.get(hunk.previousStart)
			, previousOffsets.get(hunk.previousEnd))
		, current: current.slice(currentOffsets.get(hunk.currentStart)
			, currentOffsets.get(hunk.currentEnd))
	}));
	const update = {
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reverseCoreFinCppRepairUpdate(
		current, update), previous, path);
	return update;
};

/**
 * Read one committed blob without retaining the complete inventory.
 *
 * @param revision - Exact Git revision.
 * @param path - Exact repository-relative path.
 */
const blob = (revision, path) => {
	const process = spawn("git", ["show", revision + ":" + path]
		, { stdio: ["ignore", "pipe", "pipe"] });
	let stderr = "";
	process.stderr.setEncoding("utf8");
	process.stderr.on("data", chunk => { stderr += chunk; });
	const completed = new Promise((accept, reject) => {
		process.once("error", reject);
		process.once("close", (code, signal) => {
			if(code === 0) accept();
			else reject(new Error("Git blob failed: " + code + "/" + signal + " " + stderr));
		});
	});
	return { process, completed };
};

/**
 * Record only the one exact hash-line edit and authenticate both whole blobs.
 * Memory is bounded by stream chunks and the small changed-span list.
 */
const inventoryTransition = async () => {
	const path = "docs/type-surface.v1.json";
	const pins = new Map(coreFinCppRepairPins.map(pin => [pin.path, pin]));
	const counts = new Map();
	const prior = blob(predecessor, path);
	const priorHash = createHash("sha256");
	for await(const chunk of prior.process.stdout) priorHash.update(chunk);
	await prior.completed;
	const previousSha256 = priorHash.digest("hex");
	const selected = blob(implementation, path);
	const currentHash = createHash("sha256");
	const restoredHash = createHash("sha256");
	selected.process.stdout.on("data", chunk => currentHash.update(chunk));
	const edits = [];
	let offset = 0;
	let pending;
	const lines = createInterface({ input: selected.process.stdout
		, crlfDelay: Infinity });
	for await(const line of lines)
	{
		let previous = line;
		if(pending)
		{
			assert.equal(line, '          "sha256": "' + pending.currentSha256 + '"');
			previous = '          "sha256": "' + pending.previousSha256 + '"';
			edits.push({ start: offset, current: line + "\n", previous: previous + "\n" });
			counts.set(pending.path, (counts.get(pending.path) ?? 0) + 1);
		}
		const match = line.match(/^ {10}"path": "([^"]+)",$/u);
		pending = match ? pins.get(match[1]) : undefined;
		restoredHash.update(previous + "\n");
		offset += line.length + 1;
	}
	await selected.completed;
	assert.equal(restoredHash.digest("hex"), previousSha256
		, "Only the named source pins may change; preserve every other byte");
	assert.equal(edits.length, 1);
	for(const pin of pins.values())
	{
		assert.equal(counts.get(pin.path), pin.count, pin.path);
		assert.equal(sha256(git(["show", implementation + ":" + pin.path]))
			, pin.currentSha256, pin.path);
	}
	return { path, currentSha256: currentHash.digest("hex")
		, previousSha256, edits };
};

try
{
	assert.equal(implementation, integrationBase);
	const updates = [];
	for(const path of coreFinCppRepairChangedPaths)
		updates.push(path === "docs/type-surface.v1.json"
			? await inventoryTransition()
			: await transition(path, git(["show", predecessor + ":" + path])
				, git(["show", implementation + ":" + path])));
	const integrationUpdates = [];
	for(const path of coreFinCppRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${integrationBase}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of coreFinCppRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		const bytes = await readFile(path);
		if(coreFinCppRepairImplementationAddedPaths.includes(path))
			assert.equal(bytes.toString(), git(["show", `${implementation}:${path}`]), path);
		additions.push({ path, currentSha256: sha256(bytes) });
	}
	await writeFile(coreFinCppRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "core-fin-cpp-repair-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, implementationCommits: coreFinCppRepairCommits
			, integrationBaseCommit: integrationBase
			, scope: "Repair the callback-Fin coverage guard for the four already-promoted PHP-Wasm ordinary/reviewed parameter/result cells, require all five stages, and authenticate their unchanged hosted index. Bind the twelve archived C++ callback runtime, installed-package and combined-release reports to producer 93589825d4b4c028724390e4c8d886213cbc92d8 with 87 authenticated imports, including a separately pinned Boost data asset omitted from the original source map. Authenticate deferred text and binary CLI sources without UTF-8 corruption. Preserve fresh generation on current code and check valid report controls before all 25 ownership/installation mutations. Refresh one named live source hash only. No original receipt, archive, runtime implementation, support cell or installed acceptance claim changes. Full historical acceptance remains a hosted gate; .NET, Python, JVM and PHP-Wasm callback replay repairs remain separate."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
