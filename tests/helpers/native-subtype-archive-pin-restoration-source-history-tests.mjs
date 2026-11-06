/**
 * Authenticate the immutable native Subtype archive-pin restoration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertNativeSubtypeArchivePinRestoration
	, beforeNativeSubtypeArchivePinRestorationSource
	, nativeSubtypeArchivePinRestorationBehavior
	, nativeSubtypeArchivePinRestorationDigests
	, nativeSubtypeArchivePinRestorationHistoryAdditions
	, nativeSubtypeArchivePinRestorationHistoryPath
	, nativeSubtypeArchivePinRestorationImplementation
	, nativeSubtypeArchivePinRestorationImplementationPaths
	, nativeSubtypeArchivePinRestorationIntegrationPaths
	, nativeSubtypeArchivePinRestorationLivePath
	, nativeSubtypeArchivePinRestorationNormalizationPaths
	, nativeSubtypeArchivePinRestorationPredecessor
	, nativeSubtypeArchivePinRestorations
	, reverseNativeSubtypeArchivePinRestorationUpdate
} from "./native-subtype-archive-pin-restoration-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource
} from "./source-at-fin-history-milestone.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const record = async () => JSON.parse(await readFile(
	nativeSubtypeArchivePinRestorationHistoryPath, "utf8"));
const expectedResult = () => ({
	...nativeSubtypeArchivePinRestorationBehavior
	, restorations: { ...nativeSubtypeArchivePinRestorations }
});

test("archive-pin restoration records the failed candidates and exact scope"
	, async () => {
		const value = await record();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone
			, "native-subtype-archive-pin-restoration-v1");
		assert.equal(value.predecessorCommit
			, nativeSubtypeArchivePinRestorationPredecessor);
		assert.equal(value.implementationCommit
			, nativeSubtypeArchivePinRestorationImplementation);
		assert.equal(git(["rev-parse"
			, `${nativeSubtypeArchivePinRestorationImplementation}^`]).trim()
		, nativeSubtypeArchivePinRestorationPredecessor);
		assert.deepEqual(value.discovery, {
			failure: "stale source evidence"
			, runs: [
				{ commit: "d68bae2bd688777b7ae635534da962d2f40de80f"
					, run: 42282677223, job: 128116532126
					, lane: "Type-surface evidence authentication" }
				, { commit: nativeSubtypeArchivePinRestorationPredecessor
					, run: 42285130078, job: 128126678576
					, lane: "Type-surface evidence authentication" }
			]
		});
		assert.deepEqual(value.behavior
			, { ...nativeSubtypeArchivePinRestorationBehavior });
		assert.deepEqual(value.restorations
			, { ...nativeSubtypeArchivePinRestorations });
		assert.deepEqual(value.updates.map(update => update.path)
			, nativeSubtypeArchivePinRestorationImplementationPaths);
		assert.deepEqual(value.integrationUpdates.map(update => update.path)
			, nativeSubtypeArchivePinRestorationIntegrationPaths);
		assert.equal(value.changedSupportCells, 0);
		assert.equal(value.runtimeSemanticChanges, 0);
	}
);

test("archive-pin restoration binds seven paths, 18 pins and every other byte"
	, () => {
		const previous = blob(nativeSubtypeArchivePinRestorationPredecessor
			, inventoryPath);
		const current = blob(nativeSubtypeArchivePinRestorationImplementation
			, inventoryPath);
		assert.deepEqual(assertNativeSubtypeArchivePinRestoration(
			previous, current), expectedResult());
		const { archive, live } = nativeSubtypeArchivePinRestorationDigests;
		const livePin = `"path": "${nativeSubtypeArchivePinRestorationLivePath}"`
			+ `,\n          "sha256": "${live}"`;
		assert.ok(current.includes(livePin));
		for(const [label, mutate] of [
			["archive pin left stale", source => source.replace(archive, live)]
			, ["live pin restored", source => source.replace(livePin
				, livePin.replace(live, archive))]
			, ["unrelated byte changed", source => `${source} `]
			, ["predecessor already restored", () => current]
		]) {
			const changed = mutate(current);
			assert.throws(() => assertNativeSubtypeArchivePinRestoration(
				label === "predecessor already restored" ? current : previous
				, changed), { name: "AssertionError" }, label);
		}
	}
);

test("archive-pin restoration pins the immutable archive bytes", () => {
	const { archive, live } = nativeSubtypeArchivePinRestorationDigests;
	for(const path of Object.keys(nativeSubtypeArchivePinRestorations))
		assert.equal(sha256(blob(
			nativeSubtypeArchivePinRestorationImplementation, path)), archive, path);
	assert.equal(sha256(blob(nativeSubtypeArchivePinRestorationImplementation
		, nativeSubtypeArchivePinRestorationLivePath)), live);
	const exact = [nativeSubtypeArchivePinRestorationPredecessor
		, nativeSubtypeArchivePinRestorationImplementation].map(commit =>
		sha256(blob(commit, exactModelPath)));
	assert.deepEqual(exact, [
		"1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
		, "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
	]);
});

test("archive-pin restoration reverses implementation and integration"
	, async () => {
		const value = await record();
		for(const update of value.updates)
		{
			const current = blob(nativeSubtypeArchivePinRestorationImplementation
				, update.path);
			const previous = sha256(blob(
				nativeSubtypeArchivePinRestorationPredecessor, update.path));
			assert.equal(update.previousSha256, previous, update.path);
			assert.equal(sha256(reverseNativeSubtypeArchivePinRestorationUpdate(
				current, update)), previous, update.path);
			assert.equal(sha256(beforeNativeSubtypeArchivePinRestorationSource(
				update.path, current, update.previousSha256)), previous, update.path);
			assert.equal(sha256(beforeFinRefinementSource(
				update.path, current, update.previousSha256)), previous, update.path);
		}
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryRecordSource(
				nativeSubtypeArchivePinRestorationHistoryPath, update.path
				, update.currentSha256);
			const previous = blob(nativeSubtypeArchivePinRestorationImplementation
				, update.path);
			assert.equal(reverseNativeSubtypeArchivePinRestorationUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const path of nativeSubtypeArchivePinRestorationNormalizationPaths)
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("archive-pin restoration authenticates additions and rejects forgeries"
	, async () => {
		const value = await record();
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, nativeSubtypeArchivePinRestorationHistoryAdditions);
		for(const addition of value.historyAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${nativeSubtypeArchivePinRestorationImplementation}:`
					+ addition.path], { stdio: "ignore" }).status, 0, addition.path);
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		}
		const update = value.integrationUpdates[0];
		const current = await sourceAtFinHistoryRecordSource(
			nativeSubtypeArchivePinRestorationHistoryPath, update.path
			, update.currentSha256);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
		]) assert.throws(() => reverseNativeSubtypeArchivePinRestorationUpdate(
			current, forged));
		assert.equal(beforeNativeSubtypeArchivePinRestorationSource(
			"unknown.mjs", current), current);
		assert.equal(beforeNativeSubtypeArchivePinRestorationSource(update.path
			, `${current}unknown\n`), `${current}unknown\n`);
		const copy = spawnSync(process.execPath, [
			"scripts/update-native-subtype-archive-pin-restoration-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(copy.stdout + copy.stderr
			, /History already exists|Expected values to be strictly equal/u);
	}
);
