/**
 * Authenticate the non-vacuous nominal C guard ordering repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertNominalGuardDispatchMarkerRepair
	, beforeNominalGuardDispatchMarkerSource
	, nominalGuardDispatchMarkerBehavior
	, nominalGuardDispatchMarkerHistoryAdditions
	, nominalGuardDispatchMarkerHistoryPath
	, nominalGuardDispatchMarkerImplementation
	, nominalGuardDispatchMarkerImplementationPaths
	, nominalGuardDispatchMarkerIntegrationPaths
	, nominalGuardDispatchMarkers
	, nominalGuardDispatchMarkerNormalizationPaths
	, nominalGuardDispatchMarkerPredecessor
	, reverseNominalGuardDispatchMarkerUpdate
} from "./nominal-guard-dispatch-marker-source-history.mjs";
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
	nominalGuardDispatchMarkerHistoryPath, "utf8"));
const implementationSources = () => Object.fromEntries(
	nominalGuardDispatchMarkerImplementationPaths.map(path => [
		path, blob(nominalGuardDispatchMarkerImplementation, path)
	])
);

test("nominal guard marker repair records its exact candidate and scope"
	, async () => {
		const value = await record();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone, "nominal-guard-dispatch-marker-v1");
		assert.equal(value.predecessorCommit
			, nominalGuardDispatchMarkerPredecessor);
		assert.equal(value.implementationCommit
			, nominalGuardDispatchMarkerImplementation);
		assert.equal(git(["rev-parse"
			, `${nominalGuardDispatchMarkerImplementation}^`]).trim()
		, nominalGuardDispatchMarkerPredecessor);
		assert.deepEqual(value.discovery, {
			candidate: nominalGuardDispatchMarkerPredecessor
			, gotcha: 18
			, hostedFailure: false
			, test: "nominal C and Perl guards check Fin first and only enter the active variant case"
			, location: "tests/helpers/nominal-subtype-native-tests.mjs:127-132"
			, vacuousBound: { marker: "lean_object *checked = ", index: -1 }
			, missedExport: { filtered: "eventFirst", publicName: "event_first" }
		});
		assert.deepEqual(value.behavior
			, { ...nominalGuardDispatchMarkerBehavior });
		assert.deepEqual(value.updates.map(update => update.path)
			, nominalGuardDispatchMarkerImplementationPaths);
		assert.deepEqual(value.integrationUpdates.map(update => update.path)
			, nominalGuardDispatchMarkerIntegrationPaths);
		assert.deepEqual(value.refreshed, {});
		assert.equal(value.changedSupportCells, 0);
		assert.equal(value.runtimeSemanticChanges, 0);
	}
);

test("nominal guard marker repair binds the marker, existence checks and coverage"
	, () => {
		const sources = implementationSources();
		assert.deepEqual(assertNominalGuardDispatchMarkerRepair(sources)
			, { ...nominalGuardDispatchMarkerBehavior });
		const path = "tests/helpers/nominal-subtype-native-tests.mjs";
		const [dispatch, helper, dispatchExists, ordered, coverage, covered
			, mutation] = nominalGuardDispatchMarkers.current;
		const [oldDispatch, oldCoverage] = nominalGuardDispatchMarkers.previous;
		for(const [label, mutate] of [
			["stale dispatch marker restored", source => source.replace(dispatch
				, dispatch.replace("_lb_checked", "checked"))]
			, ["dispatch existence check dropped", source =>
				source.replace(dispatchExists, "")]
			, ["helper existence check dropped", source =>
				source.replace(helper, "")]
			, ["position ordering dropped", source => source.replace(ordered, "")]
			, ["eventFirst filter restored", source =>
				source.replace(coverage, oldCoverage)]
			, ["coverage count dropped", source => source.replace(covered, "")]
			, ["negative mutations dropped", source => source.replace(mutation, "")]
			, ["vacuous slice restored", source => `${source}\n// ${oldDispatch}\n`]
			, ["ordering check weakened", source => source.replace(
				nominalGuardDispatchMarkers.ordering, "item.publicName);")]
		]) {
			const changed = { ...sources, [path]: mutate(sources[path]) };
			assert.notEqual(changed[path], sources[path], label);
			assert.throws(() => assertNominalGuardDispatchMarkerRepair(changed)
				, { name: "AssertionError" }, label);
		}
		const previous = blob(nominalGuardDispatchMarkerPredecessor, path);
		assert.equal(nominalGuardDispatchMarkers.previous.every(marker =>
			previous.includes(marker)), true);
	}
);

test("nominal guard marker repair reverses implementation and integration"
	, async () => {
		const value = await record();
		for(const update of value.updates)
		{
			const current = blob(nominalGuardDispatchMarkerImplementation
				, update.path);
			const previous = blob(nominalGuardDispatchMarkerPredecessor
				, update.path);
			assert.equal(reverseNominalGuardDispatchMarkerUpdate(current, update)
				, previous, update.path);
			assert.equal(beforeNominalGuardDispatchMarkerSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryRecordSource(
				nominalGuardDispatchMarkerHistoryPath, update.path
				, update.currentSha256);
			const previous = blob(nominalGuardDispatchMarkerImplementation
				, update.path);
			assert.equal(reverseNominalGuardDispatchMarkerUpdate(current, update)
				, previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const path of nominalGuardDispatchMarkerNormalizationPaths)
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("nominal guard marker repair leaves every live pin and the model unchanged"
	, async () => {
		const value = await record();
		const inventories = [nominalGuardDispatchMarkerPredecessor
			, nominalGuardDispatchMarkerImplementation].map(commit =>
			blob(commit, inventoryPath));
		assert.equal(sha256(inventories[0]), sha256(inventories[1]));
		assert.deepEqual(value.inventorySha256, {
			before: sha256(inventories[0]), after: sha256(inventories[1])
		});
		for(const path of nominalGuardDispatchMarkerImplementationPaths)
			for(const commit of [nominalGuardDispatchMarkerPredecessor
				, nominalGuardDispatchMarkerImplementation])
				assert.equal(inventories[1].includes(sha256(blob(commit, path)))
					, false, `${commit}:${path}`);
		assert.deepEqual(value.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
	}
);

test("nominal guard marker repair authenticates additions and rejects forgeries"
	, async () => {
		const value = await record();
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, nominalGuardDispatchMarkerHistoryAdditions);
		for(const addition of value.historyAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${nominalGuardDispatchMarkerImplementation}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		}
		const update = value.updates[0];
		const current = blob(nominalGuardDispatchMarkerImplementation
			, update.path);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
		]) assert.throws(() => reverseNominalGuardDispatchMarkerUpdate(
			current, forged));
		assert.equal(beforeNominalGuardDispatchMarkerSource(
			"unknown.mjs", current), current);
		assert.equal(beforeNominalGuardDispatchMarkerSource(update.path
			, `${current}unknown\n`), `${current}unknown\n`);
		const copy = spawnSync(process.execPath, [
			"scripts/update-nominal-guard-dispatch-marker-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(copy.stdout + copy.stderr
			, /History already exists|Expected values to be strictly equal/u);
	}
);
