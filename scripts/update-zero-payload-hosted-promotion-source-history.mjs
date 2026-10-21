#!/usr/bin/env node
/**
 * Record the hosted zero-payload language promotion.
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
	reverseZeroPayloadHostedPromotionUpdate
	, zeroPayloadHostedPromotionChangedPaths
	, zeroPayloadHostedPromotionHistoryPath
	, zeroPayloadHostedPromotionImplementation
	, zeroPayloadHostedPromotionIntegrationPaths
	, zeroPayloadHostedPromotionPredecessor
} from "../tests/helpers/zero-payload-hosted-promotion-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, zeroPayloadHostedPromotionImplementation
	, "Zero-payload hosted promotion history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, zeroPayloadHostedPromotionHistoryPath]).trim(), "");

const applicationAdditions = Object.freeze([
	"docs/evidence/zero-payload-checked-record-hosted-promotion-20261021.md"
	, "scripts/promote-zero-payload-checked-record-hosted.mjs"
	, "tests/helpers/zero-payload-checked-record-hosted-promotion.mjs"
	, "tests/zero-payload-checked-record-hosted-promotion.test.mjs"
]);
const historyAdditions = Object.freeze([
	"scripts/update-zero-payload-hosted-promotion-source-history.mjs"
	, "tests/helpers/zero-payload-hosted-promotion-source-history.mjs"
	, "tests/helpers/zero-payload-hosted-promotion-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(
	tmpdir(), "zero-payload-hosted-promotion-history-"));
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
				previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(
				currentStart, currentStart + currentCount).join("")
		};
	});
	const update = {
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reverseZeroPayloadHostedPromotionUpdate(current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of zeroPayloadHostedPromotionChangedPaths)
		updates.push(await transition(path, zeroPayloadHostedPromotionPredecessor));
	const integrationUpdates = [];
	for(const path of zeroPayloadHostedPromotionIntegrationPaths)
		integrationUpdates.push(await transition(
			path, zeroPayloadHostedPromotionImplementation));
	const additions = [];
	for(const path of [...applicationAdditions, ...historyAdditions])
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadHostedPromotionPredecessor, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, zeroPayloadHostedPromotionImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		...zeroPayloadHostedPromotionIntegrationPaths
		, "tests/zero-payload-checked-record-hosted-promotion.test.mjs"
	].sort());
	const record = {
		schemaVersion: 1
		, milestone: "zero-payload-hosted-promotion-source-v1"
		, predecessorCommit: zeroPayloadHostedPromotionPredecessor
		, implementationCommit: zeroPayloadHostedPromotionImplementation
		, reconciledTypeSurfacePointers: 140
		, scope: "Immutable npm/browser, native PHP, Python, Ruby, Perl and WIT/WASI packages promote exactly 40 copied zero-payload checked-record cells without inferring PHP-Wasm, fields, callbacks or owned positions."
		, updates, integrationUpdates, additions
	};
	await writeFile(zeroPayloadHostedPromotionHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, `
		+ `${integrationUpdates.length} integrations, `
		+ `${additions.length} additions and 140 source-pin advances.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
