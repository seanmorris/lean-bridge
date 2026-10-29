/**
 * Qualify the optional-parameter installed-acceptance repair history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeOptionalParameterInstalledAcceptanceRepairSource
	, optionalParameterInstalledAcceptanceRepairHistoryAdditions
	, optionalParameterInstalledAcceptanceRepairHistoryPath
	, optionalParameterInstalledAcceptanceRepairImplementation
	, optionalParameterInstalledAcceptanceRepairImplementationAdditions
	, optionalParameterInstalledAcceptanceRepairImplementationCommits
	, optionalParameterInstalledAcceptanceRepairImplementationPaths
	, optionalParameterInstalledAcceptanceRepairIntegrationPaths
	, optionalParameterInstalledAcceptanceRepairNormalizationPaths
	, optionalParameterInstalledAcceptanceRepairPredecessor
	, reverseOptionalParameterInstalledAcceptanceRepairUpdate
} from "./optional-parameter-installed-acceptance-repair-source-history.mjs";
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
	optionalParameterInstalledAcceptanceRepairHistoryPath, "utf8"));

test("optional installed acceptance records its exact implementation"
	, async () => {
		const value = await record();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone
			, "optional-parameter-installed-acceptance-repair-source-v1");
		assert.equal(value.predecessorCommit
			, optionalParameterInstalledAcceptanceRepairPredecessor);
		assert.equal(value.implementationCommit
			, optionalParameterInstalledAcceptanceRepairImplementation);
		assert.deepEqual(value.implementationCommits
			, [...optionalParameterInstalledAcceptanceRepairImplementationCommits]);
		assert.deepEqual(git(["rev-list", "--reverse"
			, `${optionalParameterInstalledAcceptanceRepairPredecessor}..`
				+ optionalParameterInstalledAcceptanceRepairImplementation])
			.trim().split("\n")
		, [...optionalParameterInstalledAcceptanceRepairImplementationCommits]);
		assert.deepEqual(value.updates.map(update => update.path)
			, [...optionalParameterInstalledAcceptanceRepairImplementationPaths]);
		assert.deepEqual(value.integrationUpdates.map(update => update.path)
			, [...optionalParameterInstalledAcceptanceRepairIntegrationPaths]);
		assert.deepEqual(value.currentSourcePaths
			, ["src/backends/c/gmp-projection.mjs"]);
		assert.equal(value.refreshedPins, 8);
	}
);

test("optional installed acceptance reverses every authenticated source"
	, async () => {
		const value = await record();
		for(const update of value.updates)
		{
			const current = git(["show"
				, `${optionalParameterInstalledAcceptanceRepairImplementation}`
					+ `:${update.path}`]);
			const previous = git(["show"
				, `${optionalParameterInstalledAcceptanceRepairPredecessor}`
					+ `:${update.path}`]);
			assert.equal(
				reverseOptionalParameterInstalledAcceptanceRepairUpdate(
					current, update), previous, update.path);
			assert.equal(beforeOptionalParameterInstalledAcceptanceRepairSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, `${optionalParameterInstalledAcceptanceRepairImplementation}`
					+ `:${update.path}`]);
			assert.equal(
				reverseOptionalParameterInstalledAcceptanceRepairUpdate(
					current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("optional installed acceptance authenticates additions and registration"
	, async () => {
		const value = await record();
		assert.deepEqual(value.implementationAdditions.map(item => item.path)
			, [...optionalParameterInstalledAcceptanceRepairImplementationAdditions]);
		for(const addition of value.implementationAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${optionalParameterInstalledAcceptanceRepairPredecessor}`
					+ `:${addition.path}`], { stdio: "ignore" }).status, 0);
			assert.equal(sha256(git(["show"
				, `${optionalParameterInstalledAcceptanceRepairImplementation}`
					+ `:${addition.path}`])), addition.sha256, addition.path);
		}
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, [...optionalParameterInstalledAcceptanceRepairHistoryAdditions]);
		for(const addition of value.historyAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${optionalParameterInstalledAcceptanceRepairImplementation}`
					+ `:${addition.path}`], { stdio: "ignore" }).status, 0);
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256))
				, addition.sha256, addition.path);
		}
		for(const path of [
			...optionalParameterInstalledAcceptanceRepairImplementationPaths
			, ...optionalParameterInstalledAcceptanceRepairIntegrationPaths
		]) assert.ok(
			optionalParameterInstalledAcceptanceRepairNormalizationPaths
				.includes(path), path);
	}
);

test("optional installed acceptance keeps exact semantic controls", () => {
	const contract = git(["show"
		, `${optionalParameterInstalledAcceptanceRepairImplementation}`
			+ ":tests/helpers/optional-parameter-installed-contract.mjs"]);
	assert.match(contract, /details\?\.stdout, error\?\.details\?\.stderr/u);
	assert.match(contract, /route === "ordinary" \? "arg0" : "value0"/u);
	assert.match(contract, /null can\(\?:not\| not\)/u);
	const language = git(["show"
		, `${optionalParameterInstalledAcceptanceRepairImplementation}`
			+ ":tests/optional-parameter-language-installed.test.mjs"]);
	assert.match(language, /receiptSha256: context\.receiptSha256/u);
	const report = git(["show"
		, `${optionalParameterInstalledAcceptanceRepairImplementation}`
			+ ":tests/helpers/optional-parameter-language-report.mjs"]);
	assert.match(report
		, /validateOptionalParameterLanguageClosure\(profile, item\.closure\)/u);
	const facade = git(["show"
		, `${optionalParameterInstalledAcceptanceRepairImplementation}`
			+ ":src/backends/c/gmp-projection.mjs"]);
	assert.match(facade, /const defaultWrappers = fn =>/u);
	assert.match(facade, /mpz_init\(\$\{name\}\)/u);
	assert.match(facade, /defaults\.slice\(\)\.reverse\(\)/u);
	const cConsumer = git(["show"
		, `${optionalParameterInstalledAcceptanceRepairImplementation}`
			+ ":tests/fixtures/optional-parameter-consumers/c.c"]);
	assert.match(cConsumer, /mpz_t large_input, eleven_input, natural;/u);
	assert.match(cConsumer
		, /defaults_present\(NULL, &option, &error\).*INVALID_ARGUMENT/u);
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=AM"
		, optionalParameterInstalledAcceptanceRepairPredecessor
		, optionalParameterInstalledAcceptanceRepairImplementation, "--"])
	, [...optionalParameterInstalledAcceptanceRepairImplementationPaths
		, ...optionalParameterInstalledAcceptanceRepairImplementationAdditions]
		.sort());
});

test("optional installed acceptance rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${optionalParameterInstalledAcceptanceRepairImplementation}`
			+ `:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseOptionalParameterInstalledAcceptanceRepairUpdate(current, forged));
});
