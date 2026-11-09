/**
 * Authenticate the bounded aggregate-history comparison optimization.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "espree";
import { authenticateSourceHistoryReverse, gitSourceBytes }
	from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	beforeVo1220BoundedHistoryComparisonSource
	, reverseVo1220BoundedHistoryComparisonUpdate
	, vo1220BoundedHistoryComparisonHistoryAdditions
	, vo1220BoundedHistoryComparisonHistoryPath
	, vo1220BoundedHistoryComparisonImplementation
	, vo1220BoundedHistoryComparisonImplementationAdditions
	, vo1220BoundedHistoryComparisonImplementationPaths
	, vo1220BoundedHistoryComparisonIntegrationPaths
	, vo1220BoundedHistoryComparisonPredecessor
} from "./vo1220-bounded-history-comparison-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	vo1220BoundedHistoryComparisonHistoryPath, "utf8"));
const implementationSources = new Map();
const implementationSource = path => {
	if(!implementationSources.has(path)) implementationSources.set(
		path, git(["show"
			, `${vo1220BoundedHistoryComparisonImplementation}:${path}`])
	);
	return implementationSources.get(path);
};
const walk = (value, accept) => {
	if(value === null || typeof value !== "object") return;
	if(typeof value.type === "string") accept(value);
	for(const child of Object.values(value))
		if(Array.isArray(child)) for(const item of child) walk(item, accept);
		else walk(child, accept);
};
const identifier = (node, names) => node?.type === "Identifier"
	&& names.includes(node.name);
const parsedCurrent = node => node?.type === "CallExpression"
	&& node.callee?.type === "MemberExpression"
	&& node.callee.object?.name === "JSON"
	&& node.callee.property?.name === "parse"
	&& node.arguments.length === 1
	&& identifier(node.arguments[0], ["current"]);

test("bounded history comparison records its exact scope and measurements", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "vo1220-bounded-history-comparison-source-v1");
	assert.equal(history.predecessorCommit
		, vo1220BoundedHistoryComparisonPredecessor);
	assert.equal(history.implementationCommit
		, vo1220BoundedHistoryComparisonImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, vo1220BoundedHistoryComparisonImplementationPaths);
	assert.deepEqual(history.implementationAdditions.map(item => item.path)
		, vo1220BoundedHistoryComparisonImplementationAdditions);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, vo1220BoundedHistoryComparisonIntegrationPaths);
	assert.deepEqual(history.behavior, {
		modifiedFiles: 164, addedFiles: 2
		, mechanicallyMigratedAssertions: 161
		, mechanicallyMigratedFiles: 160
		, sharedComparatorConsumerFiles: 161
		, sharedComparatorCallSites: 162
		, boundedComparatorTests: 3
		, remainingDangerousWholeDocumentAssertions: 0
		, sharedPerlComparator: true, directRevisionReader: true
		, productionFilesChanged: 0, packageFilesChanged: 0
	});
	assert.deepEqual(history.measurements.focusedDirectRevision, {
		beforeMs: 612342.186, afterMs: 5828.481
		, savedMs: 606513.705, speedup: 105.06033836260254
	});
	assert.deepEqual(history.measurements.checkedJavascriptPartition12, {
		beforeMs: 1322739.069698, afterMs: 968891.904086
		, savedMs: 353847.165612
		, savedPercent: 26.7510935238942
		, tests: 186, passed: 186, failed: 0, skipped: 0
	});
	assert.deepEqual(history.gates, {
		typecheck: "pass", eslint: "pass", diffCheck: "pass"
		, focusedDirectRevision: "8/8"
		, focusedPerlContract: "3/3"
		, partition12: "186/186"
	});
});

test("bounded history comparison reverses every modified source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			vo1220BoundedHistoryComparisonImplementation, update.path), update)
			, true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = implementationSource(update.path);
		assert.equal(reverseVo1220BoundedHistoryComparisonUpdate(
			current, update), previous, update.path);
		assert.equal(beforeVo1220BoundedHistoryComparisonSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("bounded history comparison authenticates additions and unchanged model", async () => {
	const history = await record();
	for(const addition of history.implementationAdditions)
		assert.equal(sha256(implementationSource(addition.path))
			, addition.sha256, addition.path);
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, vo1220BoundedHistoryComparisonHistoryAdditions);
	for(const addition of history.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const typeSurfacePath = "docs/type-surface.v1.json";
	const predecessor = git(["show"
		, `${vo1220BoundedHistoryComparisonPredecessor}:${typeSurfacePath}`]);
	const implementation = git(["show"
		, `${vo1220BoundedHistoryComparisonImplementation}:${typeSurfacePath}`]);
	assert.equal(implementation, predecessor);
	assert.deepEqual(history.typeSurface, {
		path: typeSurfacePath, changed: false, sha256: sha256(implementation)
	});
});

test("bounded history comparison binds every migrated assertion", () => {
	let helperImportFiles = 0;
	let helperCalls = 0;
	let dangerousAssertions = 0;
	for(const path of vo1220BoundedHistoryComparisonImplementationPaths)
	{
		const source = implementationSource(path);
		const tree = parse(source, {
			ecmaVersion: "latest", sourceType: "module"
		});
		let importsHelper = false;
		walk(tree, node => {
			if(node.type === "ImportDeclaration"
				&& /(?:^|\/)bounded-json-equality\.mjs$/u.test(
					node.source.value)) importsHelper = true;
			if(node.type !== "CallExpression") return;
			if(node.callee?.type === "Identifier"
				&& node.callee.name === "assertJsonEqual") helperCalls += 1;
			if(node.callee?.type === "MemberExpression"
				&& node.callee.object?.name === "assert"
				&& ["deepEqual", "deepStrictEqual"].includes(
					node.callee.property?.name)
				&& (identifier(node.arguments[0], ["current"])
					|| parsedCurrent(node.arguments[0]))
				&& identifier(node.arguments[1]
					, ["prior", "previous", "expected"]))
				dangerousAssertions += 1;
		});
		if(importsHelper) helperImportFiles += 1;
	}
	assert.equal(helperImportFiles, 161);
	assert.equal(helperCalls, 162);
	assert.equal(dangerousAssertions, 0);
	assert.ok(vo1220BoundedHistoryComparisonImplementationPaths.every(
		path => path.startsWith("tests/")
	));
});

test("bounded history comparison binds direct reads and bounded diagnostics", () => {
	const helper = implementationSource(
		"tests/helpers/bounded-json-equality.mjs");
	const helperTests = implementationSource(
		"tests/helpers/bounded-json-equality-tests.mjs");
	const revisionReader = implementationSource(
		"tests/helpers/source-at-fin-history-milestone.mjs");
	const directTests = implementationSource(
		"tests/helpers/core-evidence-repair-integration-source-history-tests.mjs");
	const perl = implementationSource(
		"tests/perl-contract-repair-evidence.test.mjs");
	const partition = implementationSource(
		"tests/checked-javascript-partition-12.test.mjs");
	assert.match(helper, /Return the first bounded structural difference/u);
	assert.match(helper, /maximumValuePreview = 120/u);
	assert.match(helperTests, /Array\.from\(\{ length: 100_000 \}/u);
	assert.match(helperTests, /message\.length < 256/u);
	assert.equal((helperTests.match(/^test\(/gmu) ?? []).length, 3);
	assert.match(revisionReader
		, /export const sourceAtFinHistoryRevision = async/u);
	assert.match(revisionReader, /revision-source/u);
	assert.match(directTests
		, /direct revision reads reject unauthenticated history coordinates/u);
	assert.match(directTests
		, /coreEvidenceRepairIntegrationLeftParent, path, sha256\(left\)/u);
	assert.match(directTests
		, /coreEvidenceRepairIntegrationRightParent, path, sha256\(right\)/u);
	assert.match(perl
		, /import \{ assertJsonEqual \} from "\.\/helpers\/bounded-json-equality\.mjs"/u);
	assert.doesNotMatch(perl, /const firstJsonDifference/u);
	assert.match(partition
		, /import "\.\/helpers\/bounded-json-equality-tests\.mjs";/u);
});

test("bounded history comparison rejects forged transitions", async () => {
	const update = (await record()).updates.find(item =>
		item.edits.some(edit => edit.current.length > 0));
	assert.ok(update);
	const current = implementationSource(update.path);
	const duplicate = {
		...update, edits: [update.edits[0], update.edits[0]]
	};
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }, duplicate
	]) assert.throws(() =>
		reverseVo1220BoundedHistoryComparisonUpdate(current, forged));
});

test("bounded history comparison ignores unrelated and binary sources", () => {
	const text = "unchanged";
	const binary = Buffer.from([0, 1, 2, 255]);
	assert.equal(beforeVo1220BoundedHistoryComparisonSource(
		"unrelated.mjs", text), text);
	assert.equal(beforeVo1220BoundedHistoryComparisonSource(
		vo1220BoundedHistoryComparisonImplementationPaths[0], binary), binary);
});

test("bounded history comparison writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-vo1220-bounded-history-comparison-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /vo1220-bounded-history-comparison-source-history-20261109\.json/u);
});
