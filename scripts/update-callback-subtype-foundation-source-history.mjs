#!/usr/bin/env node
/**
 * Record the exact directional callback Subtype foundation and advance only
 * the current-source pointers made stale by that transition.
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
	callbackSubtypeFoundationChangedPaths
	, callbackSubtypeFoundationHistoryPath
	, callbackSubtypeFoundationImplementation
	, callbackSubtypeFoundationPredecessor
	, reverseCallbackSubtypeFoundationUpdate
} from "../tests/helpers/callback-subtype-foundation-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackSubtypeFoundationImplementation
	, "Callback Subtype history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackSubtypeFoundationHistoryPath]).trim(), ""
, "Never rewrite committed callback Subtype foundation history");

const addedPaths = Object.freeze([
	"scripts/update-callback-subtype-foundation-source-history.mjs"
	, "tests/callback-subtype-extractor.test.mjs"
	, "tests/callback-subtype-foundation.test.mjs"
	, "tests/fixtures/onboarding/callback-subtypes/CallbackSubtypes.lean"
	, "tests/helpers/callback-subtype-foundation-source-history.mjs"
	, "tests/helpers/callback-subtype-foundation-source-history-tests.mjs"
]);

const sourceTransitions = new Map();
for(const path of callbackSubtypeFoundationChangedPaths)
{
	if(path === "docs/type-surface.v1.json") continue;
	const previous = git(["show"
		, `${callbackSubtypeFoundationPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sourceTransitions.set(path, {
		previous: sha256(previous), current: sha256(current)
	});
}

const pinSpecifications = [
	{
		path: "docs/type-surface.v1.json"
		, sources: [...sourceTransitions.keys()]
		, minimum: 1
	}
	, {
		path: "docs/evidence/core-first-run-residual-repair-source-history-20261019.json"
		, sources: ["tests/helpers/component-nominal-subtype-tests.mjs"]
		, exact: 1
	}
	, {
		path: "docs/evidence/checked-record-value-index-matrix-evidence-pin-repair-source-history-20261020.json"
		, replacements: [{
			sourcePath: "tests/helpers/fin-refinement-source-history.mjs"
			, previous: "d307adaee39c24b9ba54eafdd392c3bbcce54cf04478d5a1f72a2a156e056308"
			, current: "7869b6c0707b95a367aec4a35654979b5acedad1b7eacd95b96c7cead017280a"
		}]
		, exact: 1
	}
	, {
		path: "docs/evidence/nominal-subtype-entry-measurement-source-history-20261020.json"
		, sources: ["tests/helpers/nominal-subtype-entry-measurement-source-history-tests.mjs"]
		, exact: 1
	}
];
const pinContainers = [];
for(const specification of pinSpecifications)
{
	const previous = git(["show", `HEAD:${specification.path}`]);
	let current = previous;
	const replacements = [];
	const selectedReplacements = specification.replacements
		?? specification.sources.map(sourcePath => {
			const transition = sourceTransitions.get(sourcePath);
			assert.ok(transition, sourcePath);
			return { sourcePath, previous: transition.previous
				, current: transition.current };
		});
	for(const selected of selectedReplacements)
	{
		const count = current.split(selected.previous).length - 1;
		if(count === 0) continue;
		current = current.replaceAll(selected.previous, selected.current);
		replacements.push({ ...selected, count });
	}
	const count = replacements.reduce((sum, item) => sum + item.count, 0);
	if(specification.exact !== undefined)
		assert.equal(count, specification.exact, specification.path);
	else assert.ok(count >= specification.minimum, specification.path);
	const existing = await readFile(specification.path, "utf8");
	assert.ok(existing === previous || existing === current
		, `${specification.path} is neither baseline nor repaired`);
	if(existing === previous) await writeFile(specification.path, current);
	pinContainers.push({ path: specification.path
		, previousSha256: sha256(previous), currentSha256: sha256(current)
		, replacements });
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-subtype-history-"
));
const transition = async path => {
	const previous = git(["show"
		, `${callbackSubtypeFoundationPredecessor}:${path}`]);
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
			, previous: previousLines.slice(previousStart
				, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart
				, currentStart + currentCount).join("")
		};
	});
	assert.ok(edits.length > 0, path);
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.equal(reverseCallbackSubtypeFoundationUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackSubtypeFoundationChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of addedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callbackSubtypeFoundationPredecessor, "--", path]).trim(), ""
		, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, callbackSubtypeFoundationImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	const expected = [...new Set([
		"docs/type-surface.v1.json"
		, "tests/callback-subtype-foundation.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, "tests/helpers/nominal-subtype-entry-measurement-source-history-tests.mjs"
		, ...pinContainers.map(item => item.path)
	])].sort();
	assert.deepEqual(modified, expected);
	const record = {
		schemaVersion: 1
		, milestone: "callback-subtype-foundation-source-v1"
		, predecessorCommit: callbackSubtypeFoundationPredecessor
		, implementationCommit: callbackSubtypeFoundationImplementation
		, updates, additions, pinContainers
	};
	await writeFile(callbackSubtypeFoundationHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, ${additions.length} additions and ${pinContainers.length} repaired pointer containers.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
