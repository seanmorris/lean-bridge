/**
 * Reverse the dc8f1a7 Span qualification in generated copied .NET runtimes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedDotnetSpanRuntimeHistoryPath
	= "docs/evidence/owned-dotnet-span-runtime-history-20261018.json";
export const ownedDotnetSpanRuntimeTransition
	= "dc8f1a7151f3259e7e217449a8385559cd7e1d36";
export const ownedDotnetSpanRuntimePaths = Object.freeze([
	"src/LeanBridge.Aliases/Runtime.cs"
	, "src/LeanBridge.Callables/Runtime.cs"
	, "src/LeanBridge.Collections/Runtime.cs"
	, "src/LeanBridge.Compounds/Runtime.cs"
	, "src/LeanBridge.Lists/Runtime.cs"
	, "src/LeanBridge.Variants/Runtime.cs"
]);
let cached;
const record = () => cached ??= JSON.parse(readFileSync(
	new URL(`../../${ownedDotnetSpanRuntimeHistoryPath}`, import.meta.url), "utf8"
));

/**
 * Restore one exact pre-dc8f1a7 runtime after authenticating both whole texts.
 *
 * @param source - Complete current generated runtime.
 * @param entry - Authenticated generated-text transition.
 */
export const reverseOwnedDotnetSpanRuntime = (source, entry) => {
	assert.ok(ownedDotnetSpanRuntimePaths.includes(entry.path), entry.path);
	assert.equal(sha256(source), entry.currentSha256, entry.path);
	assert.ok(Array.isArray(entry.edits) && entry.edits.length === 4, entry.path);
	const chunks = []; let end = 0;
	for(const { start, current, previous } of entry.edits)
	{
		assert.ok(Number.isSafeInteger(start) && start >= end);
		assert.equal(current, "global::System.Span<byte>");
		assert.equal(previous, "Span<byte>");
		assert.equal(source.slice(start, start + current.length), current);
		chunks.push(source.slice(end, start), previous); end = start + current.length;
	}
	chunks.push(source.slice(end)); const restored = chunks.join("");
	assert.equal(sha256(restored), entry.previousSha256, entry.path);
	return restored;
};

/**
 * Undo only the recorded Span qualification; every other input is unchanged.
 *
 * @param path - Generated package-relative filename.
 * @param source - Complete current or historical generated text.
 * @param expected - Optional exact identity at which restoration stops.
 */
export const beforeOwnedDotnetSpanRuntime = (path, source, expected) => {
	if(typeof source !== "string" || !ownedDotnetSpanRuntimePaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const entry = record().entries.find(item => item.path === path && item.currentSha256 === digest);
	return entry ? reverseOwnedDotnetSpanRuntime(source, entry) : source;
};
