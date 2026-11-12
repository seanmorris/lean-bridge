/**
 * Authenticate the complete public-pin follow-up to the release-gate repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { typeSurfaceEvidenceFiles }
	from "../../src/adoption/type-surface-evidence-receipt.mjs";
import {
	beforeVo1220ReleaseGateSitePinSource
	, reverseVo1220ReleaseGateSitePinUpdate
	, vo1220ReleaseGateSitePinAddedPaths
	, vo1220ReleaseGateSitePinHistoryPath
	, vo1220ReleaseGateSitePinImplementation
	, vo1220ReleaseGateSitePinImplementationPaths
	, vo1220ReleaseGateSitePinIntegrationPaths
	, vo1220ReleaseGateSitePinNormalizationPaths
	, vo1220ReleaseGateSitePinPredecessor
} from "./vo1220-release-gate-site-pin-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const sourceAt = (commit, path) => git(["show", `${commit}:${path}`]);
const record = async () => JSON.parse(await readFile(
	vo1220ReleaseGateSitePinHistoryPath, "utf8"));

test("release-gate site-pin follow-up records the complete failed check", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "vo1220-release-gate-site-pin-v1");
	assert.equal(history.predecessorCommit
		, vo1220ReleaseGateSitePinPredecessor);
	assert.equal(history.implementationCommit
		, vo1220ReleaseGateSitePinImplementation);
	assert.deepEqual(history.failedRun, {
		workflow: 43282516514, job: 131407246879
		, failure: "three stale public citations for site/workflows.test.mjs"
	});
	assert.equal(history.refreshedPins, 3);
	assert.equal(history.liveSourcePaths, 2661);
	assert.equal(history.liveSourceOccurrences, 16326);
	assert.equal(history.remainingMismatches, 0);
	assert.deepEqual(history.updates.map(update => update.path)
		, vo1220ReleaseGateSitePinImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(update => update.path)
		, vo1220ReleaseGateSitePinIntegrationPaths);
});

test("release-gate site-pin follow-up reverses every authenticated source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(reverseVo1220ReleaseGateSitePinUpdate(
			sourceAt(vo1220ReleaseGateSitePinImplementation, update.path), update)
		, sourceAt(vo1220ReleaseGateSitePinPredecessor, update.path), update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = sourceAt(vo1220ReleaseGateSitePinImplementation
			, update.path);
		assert.equal(reverseVo1220ReleaseGateSitePinUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeVo1220ReleaseGateSitePinSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of vo1220ReleaseGateSitePinNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("release-gate site-pin follow-up leaves no stale live citation", async () => {
	const document = JSON.parse(await readFile("docs/type-surface.v1.json", "utf8"));
	const files = typeSurfaceEvidenceFiles(document).filter(file =>
		!file.path.startsWith("docs/evidence/"));
	const findings = [];
	for(const file of files)
	{
		const actual = createHash("sha256").update(
			await readFile(file.path)).digest("hex");
		if(actual !== file.sha256)
			findings.push({ path: file.path, actual, expected: file.sha256 });
	}
	assert.equal(files.length, 2661);
	assert.deepEqual(findings, []);
});

test("release-gate site-pin follow-up rejects forgeries and duplicate writers", async t => {
	const history = await record();
	assert.deepEqual(history.additions.map(addition => addition.path)
		, vo1220ReleaseGateSitePinAddedPaths);
	for(const addition of history.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const update = history.updates[0];
	const current = sourceAt(vo1220ReleaseGateSitePinImplementation, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseVo1220ReleaseGateSitePinUpdate(current, forged));
	const root = await mkdtemp(`${tmpdir()}/vo1220-release-gate-site-pin-guard-`);
	t.after(() => rm(root, { recursive: true }));
	const duplicate = spawnSync(process.execPath, [resolve(
		"scripts/update-vo1220-release-gate-site-pin-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(duplicate.status, 0);
	assert.equal(duplicate.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
