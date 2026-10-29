/**
 * Qualify the optional-parameter route-binder repair history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeOptionalParameterRouteBinderRepairSource
	, optionalParameterRouteBinderRepairHistoryAdditions
	, optionalParameterRouteBinderRepairHistoryPath
	, optionalParameterRouteBinderRepairImplementation
	, optionalParameterRouteBinderRepairImplementationAdditions
	, optionalParameterRouteBinderRepairImplementationCommits
	, optionalParameterRouteBinderRepairImplementationPaths
	, optionalParameterRouteBinderRepairIntegrationPaths
	, optionalParameterRouteBinderRepairNormalizationPaths
	, optionalParameterRouteBinderRepairPredecessor
	, reverseOptionalParameterRouteBinderRepairUpdate
} from "./optional-parameter-route-binder-repair-source-history.mjs";
import { beforeFinRefinementSource }
	from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean);
const record = async () => JSON.parse(await readFile(
	optionalParameterRouteBinderRepairHistoryPath, "utf8"));

test("optional route binders record their exact two-commit implementation"
	, async () => {
		const value = await record();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone
			, "optional-parameter-route-binder-repair-source-v1");
		assert.equal(value.predecessorCommit
			, optionalParameterRouteBinderRepairPredecessor);
		assert.equal(value.implementationCommit
			, optionalParameterRouteBinderRepairImplementation);
		assert.deepEqual(value.implementationCommits
			, [...optionalParameterRouteBinderRepairImplementationCommits]);
		assert.deepEqual(git(["rev-list", "--reverse"
			, `${optionalParameterRouteBinderRepairPredecessor}..`
				+ optionalParameterRouteBinderRepairImplementation])
			.trim().split("\n")
		, [...optionalParameterRouteBinderRepairImplementationCommits]);
		assert.deepEqual(value.updates.map(update => update.path)
			, [...optionalParameterRouteBinderRepairImplementationPaths]);
		assert.deepEqual(value.integrationUpdates.map(update => update.path)
			, [...optionalParameterRouteBinderRepairIntegrationPaths]);
		assert.deepEqual(value.currentSourcePaths, []);
		assert.equal(value.refreshedPins, 0);
	}
);

test("optional route binders reverse every authenticated source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${optionalParameterRouteBinderRepairImplementation}`
				+ `:${update.path}`]);
		const previous = git(["show"
			, `${optionalParameterRouteBinderRepairPredecessor}`
				+ `:${update.path}`]);
		assert.equal(reverseOptionalParameterRouteBinderRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeOptionalParameterRouteBinderRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${optionalParameterRouteBinderRepairImplementation}`
				+ `:${update.path}`]);
		assert.equal(reverseOptionalParameterRouteBinderRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("optional route binders authenticate registration without additions"
	, async () => {
		const value = await record();
		assert.deepEqual(value.implementationAdditions.map(item => item.path)
			, [...optionalParameterRouteBinderRepairImplementationAdditions]);
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, [...optionalParameterRouteBinderRepairHistoryAdditions]);
		for(const addition of value.historyAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${optionalParameterRouteBinderRepairImplementation}`
					+ `:${addition.path}`], { stdio: "ignore" }).status, 0);
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256))
				, addition.sha256, addition.path);
		}
		for(const path of [
			...optionalParameterRouteBinderRepairImplementationPaths
			, ...optionalParameterRouteBinderRepairIntegrationPaths
		]) assert.ok(optionalParameterRouteBinderRepairNormalizationPaths
			.includes(path), path);
	}
);

test("optional route binders retain exact PHP and npm distinctions", () => {
	const installed = git(["show"
		, `${optionalParameterRouteBinderRepairImplementation}`
			+ ":tests/helpers/optional-parameter-installed-contract.mjs"]);
	assert.match(installed
		, /return route === "ordinary" \? "arg0" : "value0"/u);
	assert.match(installed, /optionalParameterPhpPatterns = route/u);
	const fixture = git(["show"
		, `${optionalParameterRouteBinderRepairImplementation}`
			+ ":tests/helpers/optional-parameter-fixture.mjs"]);
	assert.match(fixture, /optionalParameterBinder = route/u);
	const packages = git(["show"
		, `${optionalParameterRouteBinderRepairImplementation}`
			+ ":tests/helpers/optional-parameter-packages.mjs"]);
	assert.match(packages, /assertOptionalParameterIr\(ir, \[binder\]\)/u);
	assert.match(packages, /item\.parameters\[0\]\.name, binder/u);
	const report = git(["show"
		, `${optionalParameterRouteBinderRepairImplementation}`
			+ ":tests/helpers/optional-parameter-npm-report.mjs"]);
	assert.match(report, /optionalParameterBinder\(options\.route\)/u);
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=AM"
		, optionalParameterRouteBinderRepairPredecessor
		, optionalParameterRouteBinderRepairImplementation, "--"])
	, [...optionalParameterRouteBinderRepairImplementationPaths]);
});

test("optional route binders reject forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${optionalParameterRouteBinderRepairImplementation}`
			+ `:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseOptionalParameterRouteBinderRepairUpdate(current, forged));
});
