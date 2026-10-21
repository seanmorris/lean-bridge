#!/usr/bin/env node
/**
 * Record the dependent generic-Subtype CI evidence-pin reconciliation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { dependentGenericSubtypeImplementation } from "../tests/helpers/dependent-generic-subtype-source-history.mjs";
import {
	dependentGenericSubtypeCiPinReconciliationChangedPaths
	, dependentGenericSubtypeCiPinReconciliationHistoryPath
	, dependentGenericSubtypeCiPinReconciliationImplementation
	, dependentGenericSubtypeCiPinReconciliationIntegrationPaths
	, dependentGenericSubtypeCiPinReconciliationPredecessor
	, reverseDependentGenericSubtypeCiPinReconciliationUpdate
} from "../tests/helpers/dependent-generic-subtype-ci-pin-reconciliation-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const implementation = dependentGenericSubtypeCiPinReconciliationImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Dependent generic Subtype CI pin reconciliation is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, dependentGenericSubtypeCiPinReconciliationHistoryPath]).trim(), "");

const additions = Object.freeze([
	"scripts/update-dependent-generic-subtype-ci-pin-reconciliation-source-history.mjs"
	, "tests/helpers/dependent-generic-subtype-ci-pin-reconciliation-source-history.mjs"
	, "tests/helpers/dependent-generic-subtype-ci-pin-reconciliation-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(
	tmpdir(), "dependent-generic-subtype-ci-pin-history-"));
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
	assert.equal(reverseDependentGenericSubtypeCiPinReconciliationUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of dependentGenericSubtypeCiPinReconciliationChangedPaths)
		updates.push(await transition(path
			, dependentGenericSubtypeCiPinReconciliationPredecessor));
	const integrationUpdates = [];
	for(const path of dependentGenericSubtypeCiPinReconciliationIntegrationPaths)
		integrationUpdates.push(await transition(path, implementation));
	const added = [];
	for(const path of additions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, implementation, "--", path]).trim(), "", path);
		added.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, implementation, "--"]).trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified
		, [...dependentGenericSubtypeCiPinReconciliationIntegrationPaths].sort());
	const predecessor = JSON.parse(git(["show"
		, `${dependentGenericSubtypeCiPinReconciliationPredecessor}:docs/type-surface.v1.json`]));
	const current = JSON.parse(git(["show"
		, `${implementation}:docs/type-surface.v1.json`]));
	const oldDigest = sha256(git(["show"
		, `${dependentGenericSubtypeImplementation}:tests/native-subtype.test.mjs`]));
	const newDigest = sha256(git(["show"
		, `${implementation}:tests/native-subtype.test.mjs`]));
	const count = (value, digest) => {
		if(!value || typeof value !== "object") return 0;
		const own = !Array.isArray(value)
			&& value.path === "tests/native-subtype.test.mjs"
			&& value.sha256 === digest ? 1 : 0;
		return own + Object.values(value).reduce(
			(sum, child) => sum + count(child, digest), 0);
	};
	assert.equal(count(predecessor, oldDigest), 8);
	assert.equal(count(current, newDigest), 8);
	await writeFile(dependentGenericSubtypeCiPinReconciliationHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "dependent-generic-subtype-ci-pin-reconciliation-source-v1"
			, predecessorCommit: dependentGenericSubtypeCiPinReconciliationPredecessor
			, implementationCommit: implementation
			, reconciledTypeSurfacePointers: 8
			, scope: "Eight existing native Subtype evidence references advance to the recurring dependent-generic CI registration bytes without changing commands, artifacts, observations or support claims."
			, updates, integrationUpdates, additions: added
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} update, `
		+ `${integrationUpdates.length} integrations, `
		+ `${added.length} additions and 8 source-pin advances.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
