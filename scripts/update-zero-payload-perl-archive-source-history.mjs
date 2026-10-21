#!/usr/bin/env node
/**
 * Record the zero-payload Perl verifier and archiver milestone.
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
	reverseZeroPayloadPerlArchiveUpdate
	, zeroPayloadPerlArchiveChangedPaths, zeroPayloadPerlArchiveHistoryPath
	, zeroPayloadPerlArchiveImplementation
	, zeroPayloadPerlArchiveIntegrationPaths
	, zeroPayloadPerlArchivePredecessor
} from "../tests/helpers/zero-payload-perl-archive-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, zeroPayloadPerlArchiveImplementation
	, "Zero-payload Perl archive history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, zeroPayloadPerlArchiveHistoryPath]).trim(), "");

const applicationAdditions = Object.freeze([
	"scripts/archive-zero-payload-checked-record-perl-evidence.mjs"
]);
const historyAdditions = Object.freeze([
	"scripts/update-zero-payload-perl-archive-source-history.mjs"
	, "tests/helpers/zero-payload-perl-archive-source-history.mjs"
	, "tests/helpers/zero-payload-perl-archive-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(
	tmpdir(), "zero-payload-perl-archive-history-"));
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
	assert.equal(reverseZeroPayloadPerlArchiveUpdate(current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of zeroPayloadPerlArchiveChangedPaths)
		updates.push(await transition(path, zeroPayloadPerlArchivePredecessor));
	const integrationUpdates = [];
	for(const path of zeroPayloadPerlArchiveIntegrationPaths)
		integrationUpdates.push(await transition(
			path, zeroPayloadPerlArchiveImplementation
		));
	const additions = [];
	for(const path of applicationAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadPerlArchivePredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	for(const path of historyAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadPerlArchiveImplementation, "--", path]
		).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, zeroPayloadPerlArchiveImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		...zeroPayloadPerlArchiveIntegrationPaths
		, "tests/zero-payload-checked-record-perl.test.mjs"
	].sort());
	const record = {
		schemaVersion: 1, milestone: "zero-payload-perl-archive-source-v1"
		, predecessorCommit: zeroPayloadPerlArchivePredecessor
		, implementationCommit: zeroPayloadPerlArchiveImplementation
		, reconciledTypeSurfacePointers: 0
		, scope: "Hosted zero-payload CPAN evidence binds both author routes, the independent Perl caller, four ABI identities, both offline installation modes and the checker to Git, and can be frozen only from authenticated successful GitHub records."
		, updates, integrationUpdates, additions
	};
	await writeFile(zeroPayloadPerlArchiveHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, `
		+ `${integrationUpdates.length} integrations and `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
