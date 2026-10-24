/**
 * Read exact immutable Git sources without buffering large inventory blobs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";

/**
 * Yield one exact Git blob and propagate producer failure. Early consumers
 * terminate only this owned Git reader and await its exit before returning.
 *
 * @param revision - Complete immutable Git commit identity.
 * @param path - Repository-relative regular-file path.
 * @param options - Git repository selection.
 * @param options.cwd - Repository working directory.
 */
export async function* gitSourceBytes(revision, path, { cwd = process.cwd() } = {})
{
	assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.ok(typeof path === "string" && !/[\\:\0]/u.test(path)
		&& path.split("/").every(part => part && part !== "." && part !== ".."));
	const child = spawn("git", ["show", `${revision}:${path}`]
		, { cwd, stdio: ["ignore", "pipe", "pipe"] });
	let stderr = "", finished = false;
	child.stderr.setEncoding("utf8");
	child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(0, 65_536); });
	const completed = new Promise((accept, reject) => {
		child.once("error", reject);
		child.once("close", (code, signal) => {
			if(code === 0) accept();
			else reject(new Error(`Git source read failed: ${code}/${signal}: ${stderr}`));
		});
	});
	// A parser may stop before awaiting the process result.
	void completed.catch(() => {});
	try
	{
		for await(const chunk of child.stdout) yield chunk;
		await completed;
		finished = true;
	}
	finally
	{
		if(!finished && child.exitCode === null) child.kill("SIGTERM");
		await completed.catch(() => {});
	}
}

/**
 * Collect only an explicitly bounded small source and verify its full identity.
 *
 * @param input - Original Git byte stream.
 * @param expected - Required byte count and SHA-256.
 * @param maximumBytes - Hard bound for small documentation/schema sources.
 */
export const readSmallHistorySource = async (input, expected, maximumBytes = 4 * 1024 * 1024) => {
	assert.ok(Number.isSafeInteger(maximumBytes) && maximumBytes > 0);
	assert.ok(Number.isSafeInteger(expected.bytes) && expected.bytes >= 0
		&& expected.bytes <= maximumBytes);
	assert.match(expected.sha256, /^[a-f0-9]{64}$/u);
	const digest = createHash("sha256"), chunks = [];
	let bytes = 0;
	for await(const chunk of input)
	{
		bytes += chunk.length;
		assert.ok(bytes <= expected.bytes, "Historical source exceeds recorded size");
		digest.update(chunk);
		chunks.push(chunk);
	}
	assert.equal(bytes, expected.bytes, "Historical source byte count changed");
	assert.equal(digest.digest("hex"), expected.sha256, "Historical source digest changed");
	return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
		.decode(Buffer.concat(chunks));
};

/**
 * Decode complete UTF-8 characters while authenticating the original bytes.
 *
 * @param input - Original source stream.
 * @param identity - Running digest and byte count.
 */
async function* decodedSource(input, identity)
{
	const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
	for await(const chunk of input)
	{
		identity.digest.update(chunk);
		identity.bytes += chunk.length;
		yield decoder.decode(chunk, { stream: true });
	}
	yield decoder.decode();
}

/**
 * Capture only requested line spans and their UTF-16 character positions.
 *
 * @param input - Original source stream.
 * @param ranges - Ordered half-open line spans from the exact Git diff.
 * @param limit - Maximum captured edit bytes and individual line bytes.
 */
const collectSourceRanges = async (input, ranges, limit) => {
	const identity = { digest: createHash("sha256"), bytes: 0 };
	const selected = ranges.map(range => ({ ...range, chunks: [] }));
	let next = 0, line = 0, offset = 0, retained = 0, pending = "";
	const boundary = () => {
		while(next < selected.length)
		{
			const range = selected[next];
			if(range.start === line) range.offset = offset;
			if(range.end !== line) break;
			assert.ok(range.offset !== undefined, "History range starts beyond EOF");
			next++;
		}
	};
	const consume = text => {
		boundary();
		assert.ok(Buffer.byteLength(text) <= limit, "History line limit exceeded");
		const range = selected[next];
		if(range && range.start <= line)
		{
			retained += Buffer.byteLength(text);
			assert.ok(retained <= limit, "History edit capture limit exceeded");
			range.chunks.push(text);
		}
		offset += text.length;
		line++;
	};
	for await(const text of decodedSource(input, identity))
	{
		pending += text;
		let newline;
		while((newline = pending.indexOf("\n")) !== -1)
		{
			consume(pending.slice(0, newline + 1));
			pending = pending.slice(newline + 1);
		}
		assert.ok(Buffer.byteLength(pending) <= limit, "History line limit exceeded");
	}
	if(pending) consume(pending);
	boundary();
	assert.equal(next, selected.length, "History range exceeds source lines");
	return { sha256: identity.digest.digest("hex"), bytes: identity.bytes
		, ranges: selected.map(range => ({ start: range.offset, text: range.chunks.join("") })) };
};

/**
 * Authenticate a recorded inverse transition without collecting the source.
 * Character positions match the existing source-history ledger format.
 *
 * @param input - Complete current source bytes.
 * @param update - Exact current/predecessor hashes and ordered changed spans.
 */
export const authenticateSourceHistoryReverse = async (input, update) => {
	assert.match(update.currentSha256, /^[a-f0-9]{64}$/u);
	assert.match(update.previousSha256, /^[a-f0-9]{64}$/u);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let end = 0, lastStart = -1;
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= end && edit.start > lastStart);
		assert.equal(typeof edit.current, "string");
		assert.equal(typeof edit.previous, "string");
		assert.notEqual(edit.current, edit.previous);
		end = edit.start + edit.current.length;
		lastStart = edit.start;
	}
	const identity = { digest: createHash("sha256"), bytes: 0 };
	const restored = createHash("sha256");
	let position = 0, next = 0, active, consumed = 0;
	const insert = () => {
		if(!active && update.edits[next]?.start === position)
		{
			active = update.edits[next++]; consumed = 0;
			restored.update(active.previous);
			if(active.current.length === 0) active = undefined;
		}
	};
	for await(const text of decodedSource(input, identity))
	{
		let cursor = 0;
		while(cursor < text.length)
		{
			insert();
			const amount = Math.min(text.length - cursor, active
				? active.current.length - consumed
				: (update.edits[next]?.start ?? Infinity) - position);
			assert.ok(amount > 0, "Invalid history edit coordinates");
			const piece = text.slice(cursor, cursor + amount);
			if(active)
			{
				assert.equal(piece, active.current.slice(consumed, consumed + amount)
					, "History current span changed");
				consumed += amount;
				if(consumed === active.current.length) active = undefined;
			}
			else restored.update(piece);
			position += amount; cursor += amount;
		}
	}
	insert();
	assert.equal(active, undefined, "Incomplete history edit span");
	assert.equal(next, update.edits.length, "Unreached history edit span");
	assert.equal(identity.digest.digest("hex"), update.currentSha256, "Current history endpoint changed");
	assert.equal(restored.digest("hex"), update.previousSha256, "Predecessor history endpoint changed");
	return true;
};

/**
 * Derive exact changed spans from an immutable single-file Git diff, then
 * authenticate both complete endpoints and a streamed inverse reconstruction.
 * No complete inventory string, JSON tree or temporary blob copy is needed.
 *
 * @param path - Exact repository-relative source path.
 * @param previous - Immutable predecessor revision.
 * @param current - Immutable current revision.
 * @param options - Repository and explicit changed-byte budget.
 * @param options.cwd - Repository directory.
 * @param options.maximumEditBytes - Maximum retained changed bytes per side.
 */
export const gitSourceHistoryTransition = async (
	path, previous, current, { cwd = process.cwd(), maximumEditBytes = 8 * 1024 * 1024 } = {}
) => {
	assert.match(previous, /^[a-f0-9]{40}$/u);
	assert.match(current, /^[a-f0-9]{40}$/u);
	assert.ok(Number.isSafeInteger(maximumEditBytes) && maximumEditBytes > 0);
	assert.match(path, /^[A-Za-z0-9_./-]+$/u);
	assert.ok(path.split("/").every(part => part && part !== "." && part !== ".."));
	const diff = execFileSync("git", ["diff", "--no-ext-diff", "--no-textconv"
		, "--no-color", "--unified=0", previous, current, "--", path]
	, { cwd, encoding: "utf8", maxBuffer: 2 * maximumEditBytes });
	assert.equal(diff.match(/^diff --git /gmu)?.length, 1, "Expected one modified text file");
	assert.ok(diff.startsWith(`diff --git a/${path} b/${path}\n`));
	assert.ok(diff.includes(`\n--- a/${path}\n+++ b/${path}\n`));
	const hunks = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu)]
		.map(match => {
			const oldCount = Number(match[2] ?? 1), newCount = Number(match[4] ?? 1);
			const oldStart = Number(match[1]) - (oldCount ? 1 : 0);
			const newStart = Number(match[3]) - (newCount ? 1 : 0);
			return { previous: { start: oldStart, end: oldStart + oldCount }
				, current: { start: newStart, end: newStart + newCount } };
		});
	assert.ok(hunks.length > 0);
	for(const side of ["previous", "current"])
	{
		let last = 0;
		for(const hunk of hunks)
		{
			const { start, end } = hunk[side];
			assert.ok(Number.isSafeInteger(start) && Number.isSafeInteger(end)
				&& start >= last && end >= start);
			last = end;
		}
	}
	const before = await collectSourceRanges(gitSourceBytes(previous, path, { cwd })
		, hunks.map(hunk => hunk.previous), maximumEditBytes);
	const after = await collectSourceRanges(gitSourceBytes(current, path, { cwd })
		, hunks.map(hunk => hunk.current), maximumEditBytes);
	const update = { path
		, previousSha256: before.sha256, currentSha256: after.sha256
		, edits: after.ranges.map((range, index) => ({ start: range.start
			, current: range.text, previous: before.ranges[index].text })) };
	await authenticateSourceHistoryReverse(gitSourceBytes(current, path, { cwd }), update);
	return update;
};
