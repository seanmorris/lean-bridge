/**
 * Authenticate the removal of the stray default-value runtime copy and its pin refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import {
	beforeNpmRuntimeDefaultValueCopyRepairSource
	, npmRuntimeDefaultValueCopyRepairAddedPaths
	, npmRuntimeDefaultValueCopyRepairCommits
	, npmRuntimeDefaultValueCopyRepairHistoryPath
	, npmRuntimeDefaultValueCopyRepairHistoryTestPath
	, npmRuntimeDefaultValueCopyRepairImplementation
	, npmRuntimeDefaultValueCopyRepairImplementationPaths
	, npmRuntimeDefaultValueCopyRepairIntegrationPaths
	, npmRuntimeDefaultValueCopyRepairPackagePath
	, npmRuntimeDefaultValueCopyRepairPinCount
	, npmRuntimeDefaultValueCopyRepairPredecessor
	, npmRuntimeDefaultValueCopyRepairSourceCommit
	, npmRuntimeDefaultValueCopyRepairSourcePaths
	, npmRuntimeDefaultValueCopyRepairTestPath
	, npmRuntimeDefaultValueCopyRepairTypeSurfacePath
	, reverseNpmRuntimeDefaultValueCopyRepairUpdate
} from "./npm-runtime-default-value-copy-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	npmRuntimeDefaultValueCopyRepairHistoryPath, "utf8"
));
const digestPattern = /[0-9a-f]{64}/gu;
const sourceAt = (commit, path) => git(["show", `${commit}:${path}`]);
const copyListBefore = "\tfor(const name of [\"canonical\", \"contract\", \"default-value\", \"sha256\"])\n";
const copyListAfter = "\tfor(const name of [\"canonical\", \"contract\", \"sha256\"])\n";
const removedAssertions = "\t\tawait access(join(runtimeRoot, \"internal/binding-ir/default-value.mjs\"));\n"
	+ "\t\tfor(const name of [\"component-callables\", \"component-copied\", \"component-structured-callables\"])\n"
	+ "\t\t\tassert.match(await readFile(join(runtimeRoot, `internal/${name}.mjs`), \"utf8\"), /from \"\\.\\/binding-ir\\/default-value\\.mjs\"/u);\n";

test("default-value copy repair records its exact source range", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "npm-runtime-default-value-copy-repair-source-v1");
	assert.equal(value.predecessorCommit, npmRuntimeDefaultValueCopyRepairPredecessor);
	assert.equal(value.implementationCommit, npmRuntimeDefaultValueCopyRepairImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, npmRuntimeDefaultValueCopyRepairImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, npmRuntimeDefaultValueCopyRepairIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, npmRuntimeDefaultValueCopyRepairAddedPaths);
	const range = `${npmRuntimeDefaultValueCopyRepairPredecessor}`
		+ `..${npmRuntimeDefaultValueCopyRepairImplementation}`;
	assert.deepEqual(git(["rev-list", "--reverse", range]).trim().split("\n")
	, npmRuntimeDefaultValueCopyRepairCommits);
	assert.deepEqual(git(["diff", "--name-only"
		, npmRuntimeDefaultValueCopyRepairPredecessor
		, npmRuntimeDefaultValueCopyRepairSourceCommit]).trim().split("\n")
	, npmRuntimeDefaultValueCopyRepairSourcePaths);
	assert.deepEqual(git(["diff", "--name-only"
		, npmRuntimeDefaultValueCopyRepairSourceCommit
		, npmRuntimeDefaultValueCopyRepairImplementation]).trim().split("\n")
	, [npmRuntimeDefaultValueCopyRepairTypeSurfacePath]);
});

test("default-value copy repair reverses every source transition", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		if(update.path === npmRuntimeDefaultValueCopyRepairTypeSurfacePath)
		{
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				npmRuntimeDefaultValueCopyRepairImplementation, update.path), update), true);
			continue;
		}
		const current = sourceAt(npmRuntimeDefaultValueCopyRepairImplementation, update.path);
		const previous = sourceAt(npmRuntimeDefaultValueCopyRepairPredecessor, update.path);
		assert.equal(reverseNpmRuntimeDefaultValueCopyRepairUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeNpmRuntimeDefaultValueCopyRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = sourceAt(npmRuntimeDefaultValueCopyRepairImplementation, update.path);
		assert.equal(reverseNpmRuntimeDefaultValueCopyRepairUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const addition of value.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("default-value copy repair refreshes only the npm runtime package pins", async () => {
	const update = (await record()).updates.find(item =>
		item.path === npmRuntimeDefaultValueCopyRepairTypeSurfacePath);
	const before = sha256(sourceAt(npmRuntimeDefaultValueCopyRepairPredecessor
		, npmRuntimeDefaultValueCopyRepairPackagePath));
	const after = sha256(sourceAt(npmRuntimeDefaultValueCopyRepairImplementation
		, npmRuntimeDefaultValueCopyRepairPackagePath));
	assert.notEqual(before, after);
	let pins = 0;
	for(const edit of update.edits)
	{
		assert.equal(edit.current.replace(digestPattern, "")
			, edit.previous.replace(digestPattern, ""));
		for(const digest of edit.current.match(digestPattern))
		{
			assert.equal(digest, after);
			++pins;
		}
		for(const digest of edit.previous.match(digestPattern)) assert.equal(digest, before);
	}
	assert.equal(pins, npmRuntimeDefaultValueCopyRepairPinCount);
});

test("default-value copy repair removes only the stray copy entry, its assertions and the HostNull live reads", () => {
	const previousPackage = sourceAt(npmRuntimeDefaultValueCopyRepairPredecessor
		, npmRuntimeDefaultValueCopyRepairPackagePath);
	const currentPackage = sourceAt(npmRuntimeDefaultValueCopyRepairImplementation
		, npmRuntimeDefaultValueCopyRepairPackagePath);
	assert.equal(previousPackage.replace(copyListBefore, copyListAfter), currentPackage);
	assert.doesNotMatch(currentPackage, /default-value/u);
	const previousTest = sourceAt(npmRuntimeDefaultValueCopyRepairPredecessor
		, npmRuntimeDefaultValueCopyRepairTestPath);
	const currentTest = sourceAt(npmRuntimeDefaultValueCopyRepairImplementation
		, npmRuntimeDefaultValueCopyRepairTestPath);
	assert.equal(previousTest.split(removedAssertions).length, 2);
	assert.equal(previousTest.replace(removedAssertions, ""), currentTest);
	assert.doesNotMatch(currentTest, /default-value/u);
	const previousHistoryTest = sourceAt(npmRuntimeDefaultValueCopyRepairPredecessor
		, npmRuntimeDefaultValueCopyRepairHistoryTestPath);
	const currentHistoryTest = sourceAt(npmRuntimeDefaultValueCopyRepairImplementation
		, npmRuntimeDefaultValueCopyRepairHistoryTestPath);
	let expectedHistoryTest = previousHistoryTest;
	for(const [before, after] of [
		["import { createReadStream } from \"node:fs\";\n", ""]
		, ["import { join, resolve } from \"node:path\";\n"
			, "import { join, resolve } from \"node:path\";\nimport { Readable } from \"node:stream\";\n"]
		, ["import { sha256 } from \"./source-history-digest.mjs\";\n"
			, "import { sha256 } from \"./source-history-digest.mjs\";\n"
				+ "import { sourceAtFinHistoryMilestone } from \"./source-at-fin-history-milestone.mjs\";\n"]
		, ["\t\t\t: await readFile(addition.path);\n"
			, "\t\t\t: await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256);\n"]
		, ["\t\tassert.equal(await authenticateSourceHistoryReverse(\n\t\t\tcreateReadStream(update.path), update), true);\n"
			+ "\t\tconst current = await readFile(update.path, \"utf8\");\n"
			, "\t\tconst current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);\n"
				+ "\t\tassert.equal(await authenticateSourceHistoryReverse(\n"
				+ "\t\t\tReadable.from([Buffer.from(current)]), update), true);\n"]
	]) {
		assert.equal(expectedHistoryTest.split(before).length, 2, before);
		expectedHistoryTest = expectedHistoryTest.replace(before, after);
	}
	assert.equal(currentHistoryTest, expectedHistoryTest);
	assert.equal(currentHistoryTest.match(/^test\(/gmu).length, previousHistoryTest.match(/^test\(/gmu).length);
	assert.equal(currentHistoryTest.match(/assert\./gu).length, previousHistoryTest.match(/assert\./gu).length);
	const endpoints = [npmRuntimeDefaultValueCopyRepairPredecessor
		, npmRuntimeDefaultValueCopyRepairImplementation];
	for(const commit of endpoints)
	{
		assert.throws(() => git(["cat-file", "-e", `${commit}:src/binding-ir/default-value.mjs`]));
		for(const name of ["component-callables", "component-copied", "component-structured-callables"])
			assert.doesNotMatch(sourceAt(commit, `src/abi/${name}.mjs`), /default-value/u, name);
	}
});

test("default-value copy repair changes no record, support inventory, configuration or other source", () => {
	const unchanged = ["docs/evidence", "src/abi", "src/binding-ir", "poc"
		, "config", "schema", "scripts", ".github"
		, "docs/consumer-support.v1.json", "package.json"];
	for(const path of unchanged)
		assert.equal(git(["rev-parse", `${npmRuntimeDefaultValueCopyRepairPredecessor}:${path}`])
			, git(["rev-parse", `${npmRuntimeDefaultValueCopyRepairImplementation}:${path}`]), path);
});

test("default-value copy repair rejects forged transitions", async () => {
	const update = (await record()).updates.find(item =>
		item.path === npmRuntimeDefaultValueCopyRepairPackagePath);
	const current = sourceAt(npmRuntimeDefaultValueCopyRepairImplementation, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseNpmRuntimeDefaultValueCopyRepairUpdate(current, forged));
	assert.equal(beforeNpmRuntimeDefaultValueCopyRepairSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});
