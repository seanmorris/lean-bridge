/**
 * Preserve the host reply evidence (#1453): the installed, fresh Lean, wrapper and failed-attempt outputs,
 * the expanded C caller and each producer's selected sources as text.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { finReplyCompilerModel } from "../tests/helpers/fin-reply-model.mjs";
import { finReplyConsumerNames, finReplyConsumerSource } from "../tests/helpers/fin-reply-install.mjs";
import { assertFinReplyArchive, finReplyArchiveDirectory, finReplyCallerPath, finReplyInstalledRevision, finReplyInstalledSourcePaths, finReplyOriginals, finReplyReceipt, finReplySnapshot, finReplyWrapperRevision, finReplyWrapperSourcePaths, writeFinReplyArtifact } from "../tests/helpers/native-fin-reply-evidence.mjs";

const options = process.argv.slice(2);
assert.ok(options.every(option => option === "--check" || option.startsWith("--from=")), "Only --check and --from=<producing checkout> are accepted");
const from = options.find(option => option.startsWith("--from="))?.slice("--from=".length) ?? ".";
const pending = new Map();
const add = (path, bytes, originalPath) => {
	pending.set(path, bytes);
	return { path, originalPath, sha256: sha256(bytes), bytes: bytes.length };
};
const artifacts = [];
for(const [name, file] of Object.entries(finReplyOriginals))
{
	const bytes = await readFile(join(from, file.original));
	assert.equal(sha256(bytes), file.sha256, file.original);
	artifacts.push(add(`${finReplyArchiveDirectory}/${name}`, bytes, file.original));
}
const show = (revision, path) => execFileSync("git", ["show", `${revision}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
const snapshot = (revision, path) => {
	const bytes = show(revision, path), item = { path, sha256: sha256(bytes), snapshot: finReplySnapshot(revision, path) };
	artifacts.push(add(item.snapshot, bytes, `git:${revision}:${path}`));
	return item;
};
const installed = finReplyInstalledSourcePaths.map(path => snapshot(finReplyInstalledRevision, path));
// A wrapper source identical to its 5459b7f bytes shares that snapshot; any other is archived at 65f7dd7.
const wrapper = finReplyWrapperSourcePaths.map(path => {
	const same = installed.find(item => item.path === path);
	return same && same.sha256 === sha256(show(finReplyWrapperRevision, path)) ? same : snapshot(finReplyWrapperRevision, path);
});
// The C caller the installed run compiled: generated callback macros, then the consumer source.
assert.equal(execFileSync("git", ["rev-parse", "HEAD:tests/fixtures/fin-reply-consumers/c.c"], { encoding: "utf8" }).trim()
	, execFileSync("git", ["rev-parse", `${finReplyInstalledRevision}:tests/fixtures/fin-reply-consumers/c.c`], { encoding: "utf8" }).trim());
const names = finReplyConsumerNames(finReplyCompilerModel("FinReplies").bindingIr);
const caller = Buffer.from(await finReplyConsumerSource("c", "c", names));
artifacts.push(add(finReplyCallerPath, caller, "generated at 5459b7f: finReplyConsumerNames(finReplyCompilerModel(\"FinReplies\").bindingIr) macros followed by tests/fixtures/fin-reply-consumers/c.c"));
const receipt = finReplyReceipt(artifacts, { installed, wrapper });
await assertFinReplyArchive(receipt, async path => pending.get(path));
const bytes = Buffer.from(JSON.stringify(receipt, null, 2) + "\n");
if(!options.includes("--check"))
{
	for(const [path, content] of pending) await writeFinReplyArtifact(path, content);
	await writeFinReplyArtifact(`${finReplyArchiveDirectory}/receipt.json`, bytes);
}
process.stdout.write(`${options.includes("--check") ? "Validated" : "Archived"} ${artifacts.length} files for the installed, fresh Lean and wrapper producers and three failed attempts. Receipt SHA-256 ${sha256(bytes)}\n`);
