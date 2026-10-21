#!/usr/bin/env node
/**
 * Record the exact generic-Subtype Python/Ruby/Rust transition.
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
	genericSubtypeLanguageChangedPaths
	, genericSubtypeLanguageHistoryPath
	, genericSubtypeLanguageImplementation
	, genericSubtypeLanguageImplementationAdditions
	, genericSubtypeLanguageIntegrationPaths
	, genericSubtypeLanguagePredecessor
	, reverseGenericSubtypeLanguageUpdate
} from "../tests/helpers/generic-subtype-language-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const implementation = genericSubtypeLanguageImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Generic Subtype language history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, genericSubtypeLanguageHistoryPath]).trim(), "");

const historyAdditions = Object.freeze([
	"scripts/update-generic-subtype-language-source-history.mjs"
	, "tests/helpers/generic-subtype-language-source-history.mjs"
	, "tests/helpers/generic-subtype-language-source-history-tests.mjs"
]);
const addedPaths = Object.freeze([
	...genericSubtypeLanguageImplementationAdditions, ...historyAdditions
]);
const directory = await mkdtemp(join(tmpdir(), "lean-generic-subtype-language-history-"));
const transition = async (path, revision) => {
	const previous = git(["show", `${revision}:${path}`]);
	const current = await readFile(path, "utf8");
	const previousPath = join(directory, "previous"), currentPath = join(directory, "current");
	await writeFile(previousPath, previous); await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = git(["diff", "--histogram", "--no-index", "--no-ext-diff"
			, "--no-textconv", "--no-color", "--unified=0", previousPath, currentPath]);
	}
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		diff = error.stdout;
	}
	const previousLines = previous.split(/(?<=\n)/u), currentLines = current.split(/(?<=\n)/u);
	const edits = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu)]
		.map(match => {
			const previousCount = Number(match[2] ?? 1), currentCount = Number(match[4] ?? 1);
			const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
			const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
			return { start: currentLines.slice(0, currentStart).join("").length
				, previous: previousLines.slice(previousStart, previousStart + previousCount).join("")
				, current: currentLines.slice(currentStart, currentStart + currentCount).join("") };
		});
	const update = { path, previousSha256: sha256(previous), currentSha256: sha256(current), edits };
	assert.ok(edits.length > 0, path);
	assert.equal(reverseGenericSubtypeLanguageUpdate(current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of genericSubtypeLanguageChangedPaths)
		updates.push(await transition(path, genericSubtypeLanguagePredecessor));
	const integrationUpdates = [];
	for(const path of genericSubtypeLanguageIntegrationPaths)
		integrationUpdates.push(await transition(path, implementation));
	const additions = [];
	for(const path of addedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", genericSubtypeLanguagePredecessor, "--", path]).trim(), "", path);
		if(genericSubtypeLanguageImplementationAdditions.includes(path))
			assert.notEqual(git(["ls-tree", "--name-only", implementation, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M", implementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [...genericSubtypeLanguageIntegrationPaths].sort());
	await writeFile(genericSubtypeLanguageHistoryPath, canonicalJson({
		schemaVersion: 1, milestone: "generic-subtype-language-source-v1"
		, predecessorCommit: genericSubtypeLanguagePredecessor
		, implementationCommit: implementation
		, scope: "Closed generic-record Subtype compositions reproduced from ordinary and independently reviewed sources, installed offline and replayed after relocation in Python, Ruby and Rust, including two Python floors and source-free Rust execution."
		, updates, integrationUpdates, additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, ${integrationUpdates.length} integrations and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
