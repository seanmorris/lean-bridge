/**
 * Authenticate the Perl supplemental Subtype result-projection repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertPerlRefinementResultProjectionRepair
	, beforePerlRefinementResultProjectionRepairSource
	, perlRefinementResultProjectionRepairBehavior
	, perlRefinementResultProjectionRepairHistoryAdditions
	, perlRefinementResultProjectionRepairHistoryPath
	, perlRefinementResultProjectionRepairImplementation
	, perlRefinementResultProjectionRepairImplementationPaths
	, perlRefinementResultProjectionRepairIntegrationPaths
	, perlRefinementResultProjectionRepairMarkers
	, perlRefinementResultProjectionRepairNormalizationPaths
	, perlRefinementResultProjectionRepairPredecessor
	, reversePerlRefinementResultProjectionRepairUpdate
} from "./perl-refinement-result-projection-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource
} from "./source-at-fin-history-milestone.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const record = async () => JSON.parse(await readFile(
	perlRefinementResultProjectionRepairHistoryPath, "utf8"));
const implementationSources = () => Object.fromEntries(
	perlRefinementResultProjectionRepairImplementationPaths.map(path => [
		path, blob(perlRefinementResultProjectionRepairImplementation, path)
	])
);

test("Perl result-projection repair records both exact hosted failures"
	, async () => {
		const value = await record();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone
			, "perl-refinement-result-projection-repair-v1");
		assert.equal(value.predecessorCommit
			, perlRefinementResultProjectionRepairPredecessor);
		assert.equal(value.implementationCommit
			, perlRefinementResultProjectionRepairImplementation);
		assert.equal(git(["rev-parse"
			, `${perlRefinementResultProjectionRepairImplementation}^`]).trim()
			, perlRefinementResultProjectionRepairPredecessor);
		assert.deepEqual(value.discovery, {
			candidate: perlRefinementResultProjectionRepairPredecessor
			, event: "workflow_dispatch", run: 42326602590
			, jobs: [128269443717, 128269443747]
			, profiles: [
				"Perl / Perl XS (5.36.3-unthreaded)"
				, "Perl / Perl XS (5.36.3-threaded)"
			]
			, failingTest: "relocated source-free CPAN packages check an unboxed word subtype and nested Fin 0 shapes"
		});
		assert.deepEqual(value.updates.map(update => update.path)
			, perlRefinementResultProjectionRepairImplementationPaths);
		assert.deepEqual(value.integrationUpdates.map(update => update.path)
			, perlRefinementResultProjectionRepairIntegrationPaths);
		assert.deepEqual(value.behavior
			, { ...perlRefinementResultProjectionRepairBehavior });
		assert.deepEqual(value.refreshed, {});
	}
);

test("Perl result-projection repair binds both directions and the regression"
	, () => {
		const sources = implementationSources();
		assert.deepEqual(assertPerlRefinementResultProjectionRepair(sources)
			, { ...perlRefinementResultProjectionRepairBehavior });
		const path = "tests/perl-refinements.test.mjs";
		const markers = perlRefinementResultProjectionRepairMarkers.current;
		for(const [label, marker] of markers.entries())
		{
			const changed = { ...sources
				, [path]: sources[path].replace(marker, "") };
			assert.notEqual(changed[path], sources[path], `${label}`);
			assert.throws(() => assertPerlRefinementResultProjectionRepair(changed)
				, { name: "AssertionError" }, `${label}`);
		}
		for(const marker of perlRefinementResultProjectionRepairMarkers.previous)
			assert.ok(blob(perlRefinementResultProjectionRepairPredecessor, path)
				.includes(marker), marker);
	}
);

test("Perl result-projection repair reverses implementation and integration"
	, async () => {
		const value = await record();
		for(const update of value.updates)
		{
			const current = blob(perlRefinementResultProjectionRepairImplementation
				, update.path);
			const previous = blob(perlRefinementResultProjectionRepairPredecessor
				, update.path);
			assert.equal(reversePerlRefinementResultProjectionRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforePerlRefinementResultProjectionRepairSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryRecordSource(
				perlRefinementResultProjectionRepairHistoryPath, update.path
					, update.currentSha256);
			const previous = blob(perlRefinementResultProjectionRepairImplementation
				, update.path);
			assert.equal(reversePerlRefinementResultProjectionRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const path of perlRefinementResultProjectionRepairNormalizationPaths)
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("Perl result-projection repair leaves live pins and the model unchanged"
	, async () => {
		const value = await record();
		const inventories = [perlRefinementResultProjectionRepairPredecessor
			, perlRefinementResultProjectionRepairImplementation].map(commit =>
				blob(commit, inventoryPath));
		assert.equal(sha256(inventories[0]), sha256(inventories[1]));
		assert.deepEqual(value.inventorySha256, {
			before: sha256(inventories[0]), after: sha256(inventories[1])
		});
		for(const path of perlRefinementResultProjectionRepairImplementationPaths)
			for(const commit of [perlRefinementResultProjectionRepairPredecessor
				, perlRefinementResultProjectionRepairImplementation])
				assert.equal(inventories[1].includes(sha256(blob(commit, path)))
					, false, `${commit}:${path}`);
		assert.deepEqual(value.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
	}
);

test("Perl result-projection repair authenticates additions and forgeries"
	, async () => {
		const value = await record();
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, perlRefinementResultProjectionRepairHistoryAdditions);
		for(const addition of value.historyAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${perlRefinementResultProjectionRepairImplementation}:`
					+ addition.path], { stdio: "ignore" }).status, 0, addition.path);
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		}
		const update = value.updates[0];
		const current = blob(perlRefinementResultProjectionRepairImplementation
			, update.path);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
		]) assert.throws(() => reversePerlRefinementResultProjectionRepairUpdate(
			current, forged));
		assert.equal(beforePerlRefinementResultProjectionRepairSource(
			"unknown.mjs", current), current);
		const copy = spawnSync(process.execPath, [
			"scripts/update-perl-refinement-result-projection-repair-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(copy.stdout + copy.stderr
			, /History already exists|Expected values to be strictly equal/u);
	}
);
