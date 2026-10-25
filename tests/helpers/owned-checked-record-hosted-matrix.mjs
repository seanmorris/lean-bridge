/**
 * Require the complete committed owned checked-record matrix before promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	ownedCheckedRecordHostedLaneNames, ownedCheckedRecordHostedLanes
	, ownedCheckedRecordHostedRoutes
} from "./owned-checked-record-hosted-contracts.mjs";
import { checkOwnedCheckedRecordHostedEvidence } from "./owned-checked-record-hosted-evidence.mjs";

const git = (arguments_, repository = process.cwd()) => execFileSync(
	"git", ["-C", repository, ...arguments_]
	, { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }
);
const keys = (value, expected) => {
	assert.ok(value && typeof value === "object" && !Array.isArray(value));
	assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
};

/**
 * Reject partial, duplicate, widened or ambiguous archive selections.
 *
 * @param selection - Explicit manifest of immutable capture index identities.
 */
export const assertOwnedCheckedRecordMatrixSelection = selection => {
	keys(selection, ["schemaVersion", "kind", "archives"]);
	assert.equal(selection.schemaVersion, 1);
	assert.equal(selection.kind, "owned-checked-record-matrix-selection");
	assert.ok(Array.isArray(selection.archives));
	assert.deepEqual(selection.archives.map(item => item.lane)
		, ownedCheckedRecordHostedLaneNames, "Select every lane exactly once in contract order");
	for(const entry of selection.archives)
	{
		keys(entry, ["lane", "index"]);
		keys(entry.index, ["path", "sha256"]);
		assert.match(entry.index.path, new RegExp(
			"^docs/evidence/owned-checked-record-" + entry.lane + "-hosted-[0-9]{8}/index\\.json$", "u"
		));
		assert.match(entry.index.sha256, /^[a-f0-9]{64}$/u);
	}
};

/**
 * Bind all selected index bytes before starting expensive archive replay.
 * This structural preflight alone does not establish hosted acceptance.
 *
 * @param selection - Complete closed archive selection.
 * @param indexBytes - Original index bytes in selection order.
 */
export const assertOwnedCheckedRecordMatrixIndexes = (selection, indexBytes) => {
	assertOwnedCheckedRecordMatrixSelection(selection);
	assert.equal(indexBytes.length, selection.archives.length);
	const indexes = indexBytes.map((bytes, position) => {
		assert.ok(Buffer.isBuffer(bytes));
		const entry = selection.archives[position];
		assert.equal(sha256(bytes), entry.index.sha256, entry.index.path);
		const index = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(index));
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.lane, entry.lane);
		assert.equal(index.kind, `owned-checked-record-${entry.lane}-hosted-v1`);
		assert.deepEqual(index.targets, ownedCheckedRecordHostedLanes[entry.lane].targets);
		assert.match(index.producerCommit, /^[a-f0-9]{40}$/u);
		assert.equal(index.consumerCommit, index.producerCommit);
		assert.equal(index.accepted.lane, entry.lane);
		assert.equal(index.accepted.producerCommit, index.producerCommit);
		assert.deepEqual(index.accepted.routes.map(route => route.route)
			, ownedCheckedRecordHostedRoutes);
		return index;
	});
	assert.equal(new Set(indexes.filter(index => !["javascript", "php-wasm"].includes(index.lane))
		.map(index => index.producerCommit)).size, 1
	, "The nine native/managed lanes must share one authenticated producer revision");
	return indexes;
};

/**
 * Stream every indexed Git blob, including the index, at one fixed revision.
 * The archive subtree must contain exactly these regular files.
 *
 * @param revision - Full commit identity, never a moving branch name.
 * @param root - Closed repository-relative hosted archive directory.
 * @param indexBytes - Index bytes authenticated by the selection.
 * @param repository - Git repository location for isolated tests.
 */
export const assertOwnedCheckedRecordCommittedArchive = async (
	revision, root, indexBytes, repository = process.cwd()
) => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.match(root, /^docs\/evidence\/owned-checked-record-[a-z-]+-hosted-[0-9]{8}$/u);
	const index = JSON.parse(indexBytes);
	const files = [...index.files, { path: "index.json", bytes: indexBytes.length
		, sha256: sha256(indexBytes) }];
	const expected = new Map();
	for(const file of files)
	{
		assert.equal(typeof file.path, "string");
		assert.ok(file.path.split("/").every(part => part && part !== "." && part !== ".."));
		assert.ok(!file.path.includes("\\") && !file.path.includes("\0"));
		assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
		assert.match(file.sha256, /^[a-f0-9]{64}$/u);
		expected.set(root + "/" + file.path, file);
	}
	assert.equal(expected.size, files.length, "Duplicate indexed file");
	const entries = git(["ls-tree", "-rz", "--full-tree", revision, "--", root], repository)
		.split("\0").filter(Boolean).map(line => {
			const match = /^100644 blob ([a-f0-9]{40})\t(.+)$/u.exec(line);
			assert.ok(match, "Retained evidence must be committed regular files");
			return { object: match[1], path: match[2] };
		});
	assert.deepEqual(entries.map(entry => entry.path).sort(), [...expected.keys()].sort()
		, "Every indexed byte must be committed, with no unindexed files");
	const child = spawn("git", ["-C", repository, "cat-file", "--batch"]
		, { stdio: ["pipe", "pipe", "pipe"] });
	let errorText = "";
	child.stderr.setEncoding("utf8");
	child.stderr.on("data", text => { errorText = (errorText + text).slice(-4096); });
	const completed = new Promise((accept, reject) => {
		child.once("error", reject);
		child.once("close", (code, signal) => accept({ code, signal }));
	});
	// Attach a handler immediately; process failure is rethrown after draining.
	completed.catch(() => {});
	child.stdin.on("error", () => {});
	child.stdin.end(entries.map(entry => entry.object).join("\n") + "\n");
	let buffer = Buffer.alloc(0), stage = "header", position = 0, remaining = 0, hash;
	try
	{
		for await(const chunk of child.stdout)
		{
			buffer = Buffer.concat([buffer, chunk]);
			while(buffer.length)
			{
				const entry = entries[position];
				assert.ok(entry, "Unexpected Git batch output");
				const file = expected.get(entry.path);
				if(stage === "header")
				{
					const end = buffer.indexOf(10);
					if(end < 0)
					{
						assert.ok(buffer.length < 1024);
						break;
					}
					assert.deepEqual(buffer.subarray(0, end).toString().split(" ")
						, [entry.object, "blob", String(file.bytes)], entry.path);
					remaining = file.bytes; hash = createHash("sha256");
					buffer = buffer.subarray(end + 1); stage = "body";
				}
				if(stage === "body")
				{
					const size = Math.min(buffer.length, remaining);
					hash.update(buffer.subarray(0, size));
					buffer = buffer.subarray(size); remaining -= size;
					if(remaining) break;
					assert.equal(hash.digest("hex"), file.sha256, entry.path);
					stage = "newline";
				}
				if(stage === "newline")
				{
					if(!buffer.length) break;
					assert.equal(buffer[0], 10);
					buffer = buffer.subarray(1); position++; stage = "header";
				}
			}
		}
		assert.deepEqual(await completed, { code: 0, signal: null }, errorText);
		assert.equal(stage, "header"); assert.equal(buffer.length, 0);
		assert.equal(position, entries.length);
	}
	finally
	{
		child.stdin.destroy(); child.stdout.destroy();
		if(child.exitCode === null) child.kill();
		await completed.catch(() => {});
	}
	return { files: files.length, bytes: files.reduce((total, file) => total + file.bytes, 0) };
};

/**
 * Replay one authenticated Git archive in an isolated temporary directory.
 * Sparse checkouts need not retain all eleven multi-gigabyte archive trees.
 * The callback still performs the full API/ZIP/package/source verification.
 *
 * @param revision - Exact committed revision.
 * @param root - Closed repository-relative archive root.
 * @param indexBytes - Selected original index bytes.
 * @param inspect - Archive consumer, never a replacement for the Git audit.
 * @param repository - Git repository location for isolated tests.
 */
export const withOwnedCheckedRecordCommittedArchive = async (
	revision, root, indexBytes, inspect, repository = process.cwd()
) => {
	assert.equal(typeof inspect, "function");
	const committed = await assertOwnedCheckedRecordCommittedArchive(
		revision, root, indexBytes, repository
	);
	const temporary = await mkdtemp(join(tmpdir(), "lean-owned-matrix-"));
	const children = [], completions = [];
	const start = (command, arguments_) => {
		const child = spawn(command, arguments_, { stdio: ["pipe", "pipe", "pipe"] });
		children.push(child);
		let errors = "";
		child.stderr.setEncoding("utf8");
		child.stderr.on("data", text => { errors = (errors + text).slice(-4096); });
		const completed = new Promise((accept, reject) => {
			child.once("error", reject);
			child.once("close", (code, signal) => {
				if(code === 0) accept();
				else reject(new Error(`${command} failed: ${code}/${signal}: ${errors}`));
			});
		});
		completed.catch(() => {});
		completions.push(completed);
		return child;
	};
	try
	{
		const source = start("git", ["-C", repository, "archive", "--format=tar", revision, "--", root]);
		// Read through the final padding to EOF before closing the pipe.
		const extract = start("tar", ["-x", "-i", "-f", "-", "-C", temporary]);
		source.stdin.end(); extract.stdout.resume();
		const outcomes = await Promise.allSettled([
			...completions, pipeline(source.stdout, extract.stdin)
		]);
		const failures = outcomes.filter(outcome => outcome.status === "rejected")
			.map(outcome => outcome.reason);
		if(failures.length) throw new AggregateError(failures, "Committed archive extraction failed");
		const result = await inspect(join(temporary, root));
		return { committed, result };
	}
	finally
	{
		for(const child of children)
		{
			child.stdin.destroy(); child.stdout.destroy();
			if(child.exitCode === null) child.kill();
		}
		await Promise.allSettled(completions);
		await rm(temporary, { recursive: true });
	}
};

/**
 * Authenticate committed bytes and independently replay all eleven captures.
 * This reports capture verification only; it never edits support claims.
 *
 * @param selection - Complete capture manifest.
 * @param onLane - Optional progress observer; cannot replace verification.
 */
export const verifyOwnedCheckedRecordHostedMatrix = async (selection, onLane = () => {}) => {
	assertOwnedCheckedRecordMatrixSelection(selection);
	assert.equal(typeof onLane, "function");
	const bytes = [];
	for(const entry of selection.archives) bytes.push(await readFile(entry.index.path));
	const indexes = assertOwnedCheckedRecordMatrixIndexes(selection, bytes);
	assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]), ""
		, "Matrix verification requires a clean committed checkout");
	const revision = git(["rev-parse", "HEAD"]).trim();
	const captures = [];
	for(const [position, entry] of selection.archives.entries())
	{
		const root = dirname(entry.index.path);
		const { committed, result: index } = await withOwnedCheckedRecordCommittedArchive(
			revision, root, bytes[position]
			, temporary => checkOwnedCheckedRecordHostedEvidence(entry.lane, temporary)
		);
		assert.deepEqual(index, indexes[position], "Index changed after matrix preflight");
		captures.push({ lane: entry.lane, index: { ...entry.index }
			, producerCommit: index.producerCommit, archiveCommit: index.archiveCommit
			, runId: index.hostedRun.runId, jobId: index.hostedRun.job.id
			, artifactId: index.hostedRun.artifact.id
			, committed, accepted: index.accepted });
		await onLane({ lane: entry.lane, ...committed });
	}
	assert.equal(git(["rev-parse", "HEAD"]).trim(), revision, "Checkout changed during verification");
	assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]), ""
		, "Checkout changed during verification");
	return { schemaVersion: 1, kind: "owned-checked-record-hosted-matrix-replay"
		, revision, selectionSha256: sha256(canonicalJson(selection)), captures
		, lanes: captures.length
		, routes: captures.reduce((sum, item) => sum + item.accepted.routes.length, 0)
		, supportPromoted: false };
};
