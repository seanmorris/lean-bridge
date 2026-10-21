#!/usr/bin/env node
/**
 * Record the hosted zero-payload PHP-Wasm promotion milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	reverseZeroPayloadPhpWasmPromotionUpdate
	, zeroPayloadPhpWasmPromotionChangedPaths
	, zeroPayloadPhpWasmPromotionHistoryPath
	, zeroPayloadPhpWasmPromotionImplementation
	, zeroPayloadPhpWasmPromotionIntegrationPaths
	, zeroPayloadPhpWasmPromotionPredecessor
} from "../tests/helpers/zero-payload-php-wasm-promotion-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const implementation = zeroPayloadPhpWasmPromotionImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Zero-payload PHP-Wasm promotion history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, zeroPayloadPhpWasmPromotionHistoryPath]).trim(), "");

const additions = Object.freeze([
	"scripts/update-zero-payload-php-wasm-promotion-source-history.mjs"
	, "tests/helpers/zero-payload-php-wasm-promotion-source-history.mjs"
	, "tests/helpers/zero-payload-php-wasm-promotion-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(
	tmpdir(), "zero-payload-php-wasm-promotion-history-"));
const transition = async (path, revision) => {
	const previous = git(["show", `${revision}:${path}`]);
	const current = await readFile(path, "utf8");
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
	const previousLines = previous.split(/(?<=\n)/u);
	const currentLines = current.split(/(?<=\n)/u);
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: currentLines.slice(0, currentStart).join("").length
			, previous: previousLines.slice(
				previousStart, previousStart + previousCount
			).join("")
			, current: currentLines.slice(
				currentStart, currentStart + currentCount
			).join("")
		};
	});
	const update = {
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reverseZeroPayloadPhpWasmPromotionUpdate(current, update)
		, previous);
	return update;
};

try
{
	const updates = [];
	for(const path of zeroPayloadPhpWasmPromotionChangedPaths)
		updates.push(await transition(
			path, zeroPayloadPhpWasmPromotionPredecessor));
	const integrationUpdates = [];
	for(const path of zeroPayloadPhpWasmPromotionIntegrationPaths)
		integrationUpdates.push(await transition(path, implementation));
	const added = [];
	for(const path of additions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, implementation, "--", path]).trim(), "", path);
		added.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, implementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		...zeroPayloadPhpWasmPromotionIntegrationPaths
		, "tests/zero-payload-checked-record-hosted-promotion.test.mjs"
	].sort());
	await writeFile(zeroPayloadPhpWasmPromotionHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "zero-payload-php-wasm-promotion-source-v1"
		, predecessorCommit: zeroPayloadPhpWasmPromotionPredecessor
		, implementationCommit: implementation
		, reconciledTypeSurfacePointers: 27
		, scope: "The independently archived PHP-Wasm lane extends hosted zero-payload acceptance to 28 exact route references and 44 copied parameter/result cells across the seven hosted lane groups, without inferring fields, callbacks, owned positions or another host."
		, updates, integrationUpdates, additions: added
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, `
		+ `${integrationUpdates.length} integrations, `
		+ `${added.length} additions and 27 source-pin advances.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
