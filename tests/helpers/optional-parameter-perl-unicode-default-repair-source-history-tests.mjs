/**
 * Qualify the optional-parameter Perl Unicode-default repair history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeOptionalParameterPerlUnicodeDefaultRepairSource
	, optionalParameterPerlUnicodeDefaultRepairHistoryAdditions
	, optionalParameterPerlUnicodeDefaultRepairHistoryPath
	, optionalParameterPerlUnicodeDefaultRepairImplementation
	, optionalParameterPerlUnicodeDefaultRepairImplementationAdditions
	, optionalParameterPerlUnicodeDefaultRepairImplementationCommits
	, optionalParameterPerlUnicodeDefaultRepairImplementationPaths
	, optionalParameterPerlUnicodeDefaultRepairIntegrationPaths
	, optionalParameterPerlUnicodeDefaultRepairNormalizationPaths
	, optionalParameterPerlUnicodeDefaultRepairPredecessor
	, reverseOptionalParameterPerlUnicodeDefaultRepairUpdate
} from "./optional-parameter-perl-unicode-default-repair-source-history.mjs";
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
	optionalParameterPerlUnicodeDefaultRepairHistoryPath, "utf8"));

test("optional Perl Unicode defaults record their exact implementation"
	, async () => {
		const value = await record();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone
			, "optional-parameter-perl-unicode-default-repair-source-v1");
		assert.equal(value.predecessorCommit
			, optionalParameterPerlUnicodeDefaultRepairPredecessor);
		assert.equal(value.implementationCommit
			, optionalParameterPerlUnicodeDefaultRepairImplementation);
		assert.deepEqual(value.implementationCommits
			, [...optionalParameterPerlUnicodeDefaultRepairImplementationCommits]);
		assert.deepEqual(git(["rev-list", "--reverse"
			, `${optionalParameterPerlUnicodeDefaultRepairPredecessor}..`
				+ optionalParameterPerlUnicodeDefaultRepairImplementation])
			.trim().split("\n")
		, [...optionalParameterPerlUnicodeDefaultRepairImplementationCommits]);
		assert.deepEqual(value.updates.map(update => update.path)
			, [...optionalParameterPerlUnicodeDefaultRepairImplementationPaths]);
		assert.deepEqual(value.integrationUpdates.map(update => update.path)
			, [...optionalParameterPerlUnicodeDefaultRepairIntegrationPaths]);
		assert.deepEqual(value.currentSourcePaths
			, ["src/backends/perl/generate.mjs"]);
		assert.equal(value.refreshedPins, 15);
	}
);

test("optional Perl Unicode defaults reverse every authenticated source"
	, async () => {
		const value = await record();
		for(const update of value.updates)
		{
			const current = git(["show"
				, `${optionalParameterPerlUnicodeDefaultRepairImplementation}`
					+ `:${update.path}`]);
			const previous = git(["show"
				, `${optionalParameterPerlUnicodeDefaultRepairPredecessor}`
					+ `:${update.path}`]);
			assert.equal(
				reverseOptionalParameterPerlUnicodeDefaultRepairUpdate(
					current, update), previous, update.path);
			assert.equal(beforeOptionalParameterPerlUnicodeDefaultRepairSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, `${optionalParameterPerlUnicodeDefaultRepairImplementation}`
					+ `:${update.path}`]);
			assert.equal(
				reverseOptionalParameterPerlUnicodeDefaultRepairUpdate(
					current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("optional Perl Unicode defaults authenticate additions and registration"
	, async () => {
		const value = await record();
		assert.deepEqual(value.implementationAdditions.map(item => item.path)
			, [...optionalParameterPerlUnicodeDefaultRepairImplementationAdditions]);
		for(const addition of value.implementationAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${optionalParameterPerlUnicodeDefaultRepairPredecessor}`
					+ `:${addition.path}`], { stdio: "ignore" }).status, 0);
			assert.equal(sha256(git(["show"
				, `${optionalParameterPerlUnicodeDefaultRepairImplementation}`
					+ `:${addition.path}`])), addition.sha256, addition.path);
		}
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, [...optionalParameterPerlUnicodeDefaultRepairHistoryAdditions]);
		for(const addition of value.historyAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${optionalParameterPerlUnicodeDefaultRepairImplementation}`
					+ `:${addition.path}`], { stdio: "ignore" }).status, 0);
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256))
				, addition.sha256, addition.path);
		}
		for(const path of [
			...optionalParameterPerlUnicodeDefaultRepairImplementationPaths
			, ...optionalParameterPerlUnicodeDefaultRepairIntegrationPaths
		]) assert.ok(
			optionalParameterPerlUnicodeDefaultRepairNormalizationPaths
				.includes(path), path);
	}
);

test("optional Perl Unicode defaults retain source and runtime controls", () => {
	const generator = git(["show"
		, `${optionalParameterPerlUnicodeDefaultRepairImplementation}`
			+ ":src/backends/perl/generate.mjs"]);
	assert.match(generator, /"use warnings;"\n\t\t, "use utf8;"/u);
	const contract = git(["show"
		, `${optionalParameterPerlUnicodeDefaultRepairImplementation}`
			+ ":tests/perl-contract.test.mjs"]);
	assert.match(contract
		, /Perl wrappers compile authenticated Unicode defaults as characters/u);
	assert.match(contract, /ord\(\$omitted->\[0\]\) == 0x3bb/u);
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=AM"
		, optionalParameterPerlUnicodeDefaultRepairPredecessor
		, optionalParameterPerlUnicodeDefaultRepairImplementation, "--"])
	, [...optionalParameterPerlUnicodeDefaultRepairImplementationPaths
		, ...optionalParameterPerlUnicodeDefaultRepairImplementationAdditions]
		.sort());
});

test("optional Perl Unicode defaults reject forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${optionalParameterPerlUnicodeDefaultRepairImplementation}`
			+ `:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseOptionalParameterPerlUnicodeDefaultRepairUpdate(current, forged));
});
