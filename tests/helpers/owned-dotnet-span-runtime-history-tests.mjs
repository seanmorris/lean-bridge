/**
 * Prove the dc8f1a7 Span qualification is reversed exactly and fails closed.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateCopiedDotnetPackage } from "../../src/backends/dotnet/copied-values.mjs";
import { dotnetStructuredRegressionFixtures } from "./dotnet-structured-callable-regression.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	beforeOwnedDotnetSpanRuntime, ownedDotnetSpanRuntimeHistoryPath
	, ownedDotnetSpanRuntimePaths, ownedDotnetSpanRuntimeTransition
	, reverseOwnedDotnetSpanRuntime
} from "./owned-dotnet-span-runtime-history.mjs";

const record = async () => JSON.parse(await readFile(ownedDotnetSpanRuntimeHistoryPath, "utf8"));
const runtimes = () => {
	const result = new Map();
	for(const fixture of Object.values(dotnetStructuredRegressionFixtures))
		for(const [path, source] of Object.entries(generateCopiedDotnetPackage(fixture())))
			if(ownedDotnetSpanRuntimePaths.includes(path)) result.set(path, source);
	return result;
};

test("owned .NET Span runtime history names exactly six generated runtimes", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "owned-dotnet-span-runtime-v1");
	assert.equal(history.transitionCommit, ownedDotnetSpanRuntimeTransition);
	execFileSync("git", ["merge-base", "--is-ancestor", ownedDotnetSpanRuntimeTransition, "HEAD"]);
	assert.deepEqual(history.entries.map(entry => entry.path), ownedDotnetSpanRuntimePaths);
	assert.equal(new Set(history.entries.map(entry => entry.currentSha256)).size, 6);
});

test("current copied runtimes reverse exactly to their pre-dc8f1a7 identities", async () => {
	const history = await record(), generated = runtimes();
	assert.deepEqual([...generated.keys()].sort(), [...ownedDotnetSpanRuntimePaths].sort());
	for(const entry of history.entries)
	{
		const source = generated.get(entry.path);
		assert.equal(sha256(source), entry.currentSha256, entry.path);
		const previous = reverseOwnedDotnetSpanRuntime(source, entry);
		assert.equal(sha256(previous), entry.previousSha256, entry.path);
		assert.equal(previous.split("global::System.Span<byte>").length
			, source.split("global::System.Span<byte>").length - 4, entry.path);
		assert.equal(beforeOwnedDotnetSpanRuntime(entry.path, source), previous);
		assert.equal(beforeOwnedDotnetSpanRuntime(entry.path, source, entry.currentSha256), source);
		assert.equal(beforeOwnedDotnetSpanRuntime(entry.path, previous), previous);
	}
});

test("unknown runtimes, paths and forged transitions fail closed", async () => {
	const history = await record(), generated = runtimes();
	const entry = history.entries[0], source = generated.get(entry.path);
	for(const unknown of [source + "\n", "", source.replace("Span<byte>", "Span<char>")])
		assert.equal(beforeOwnedDotnetSpanRuntime(entry.path, unknown), unknown);
	assert.equal(beforeOwnedDotnetSpanRuntime("src/LeanBridge.Other/Runtime.cs", source), source);
	const bytes = Buffer.from(source);
	assert.equal(beforeOwnedDotnetSpanRuntime(entry.path, bytes), bytes);
	for(const mutate of [
		item => { item.path = "src/LeanBridge.Other/Runtime.cs"; }
		, item => { item.currentSha256 = "0".repeat(64); }
		, item => { item.previousSha256 = "0".repeat(64); }
		, item => { item.edits.pop(); }
		, item => { item.edits[1].start += 1; }
		, item => { item.edits[0].current = "Span<byte>"; }
		, item => { item.edits[0].previous = "global::Span<byte>"; }
		, item => { item.edits = [item.edits[1], item.edits[0], ...item.edits.slice(2)]; }
	]) {
		const changed = structuredClone(entry); mutate(changed);
		assert.throws(() => reverseOwnedDotnetSpanRuntime(source, changed));
	}
});
