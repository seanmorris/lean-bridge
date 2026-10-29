/**
 * Authenticate the optional promotion-reader pin repair history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import { beforeFinRefinementSource }
	from "./fin-refinement-source-history.mjs";
import {
	beforeOptionalParameterPromotionIoPinRepairSource
	, optionalParameterPromotionIoPinRepairHistoryAdditions
	, optionalParameterPromotionIoPinRepairHistoryPath
	, optionalParameterPromotionIoPinRepairImplementation
	, optionalParameterPromotionIoPinRepairImplementationAdditions
	, optionalParameterPromotionIoPinRepairImplementationPaths
	, optionalParameterPromotionIoPinRepairIntegrationPaths
	, optionalParameterPromotionIoPinRepairPredecessor
	, reverseOptionalParameterPromotionIoPinRepairUpdate
} from "./optional-parameter-promotion-io-pin-repair-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const implementation = () => git([
	"rev-parse", optionalParameterPromotionIoPinRepairImplementation
]).trim();
const record = async () => JSON.parse(await readFile(
	optionalParameterPromotionIoPinRepairHistoryPath, "utf8"));

test("optional promotion-reader history records the exact repair", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "optional-parameter-promotion-io-pin-repair-v1");
	assert.equal(history.predecessorCommit
		, optionalParameterPromotionIoPinRepairPredecessor);
	assert.equal(history.implementationCommit, implementation());
	assert.deepEqual(history.updates.map(item => item.path).sort()
		, [...optionalParameterPromotionIoPinRepairImplementationPaths].sort());
	assert.deepEqual(history.implementationAdditions.map(item => item.path)
		, optionalParameterPromotionIoPinRepairImplementationAdditions);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, optionalParameterPromotionIoPinRepairIntegrationPaths);
	assert.equal(history.refreshedPins, 33);
	assert.equal(history.refreshedPaths, 1);
	assert.deepEqual(history.currentSourcePaths, []);
});

test("optional promotion-reader history reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			implementation(), update.path), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show", `${implementation()}:${update.path}`]);
		assert.equal(reverseOptionalParameterPromotionIoPinRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeOptionalParameterPromotionIoPinRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("optional promotion-reader history authenticates additions", async () => {
	const history = await record();
	for(const addition of history.implementationAdditions)
		assert.equal(addition.sha256, sha256(git(["show"
			, `${implementation()}:${addition.path}`])), addition.path);
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, optionalParameterPromotionIoPinRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("optional promotion-reader history rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show", `${implementation()}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.json" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseOptionalParameterPromotionIoPinRepairUpdate(current, forged));
});

test("optional promotion-reader history writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-optional-parameter-promotion-io-pin-repair-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /optional-parameter-promotion-io-pin-repair-source-history-20261029\.json/u);
});
