/**
 * Authenticate every HostNull JavaScript/browser implementation and
 * registration state.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import {
	beforeHostNullJavaScriptSource
	, hostNullJavaScriptAddedPaths
	, hostNullJavaScriptChangedPaths
	, hostNullJavaScriptCommits
	, hostNullJavaScriptFoundation
	, hostNullJavaScriptHistoryAddedPaths
	, hostNullJavaScriptHistoryPath
	, hostNullJavaScriptImplementation
	, hostNullJavaScriptImplementationAddedPaths
	, hostNullJavaScriptIntegrationPaths
	, hostNullJavaScriptNormalizationPaths
	, hostNullJavaScriptPinCount
	, hostNullJavaScriptPinCounts
	, hostNullJavaScriptPinRefresh
	, hostNullJavaScriptPredecessor
	, hostNullJavaScriptWorkflow
	, reverseHostNullJavaScriptUpdate
} from "./host-null-javascript-source-history.mjs";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const sourceAt = (commit, path) => git(["show", `${commit}:${path}`]);
const record = async () => JSON.parse(await readFile(
	hostNullJavaScriptHistoryPath, "utf8"
));

test("HostNull JavaScript history records all four first-parent commits", async () => {
	const value = await record();
	assert.deepEqual(Object.keys(value).sort(), [
		"additions", "commits", "implementationCommit", "integrationUpdates"
		, "milestone", "predecessorCommit", "reconciledTypeSurfacePointers"
		, "schemaVersion", "scope", "updates"
	].sort());
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "host-null-javascript-source-v1");
	assert.equal(value.predecessorCommit, hostNullJavaScriptPredecessor);
	assert.equal(value.implementationCommit, hostNullJavaScriptPinRefresh);
	assert.equal(value.reconciledTypeSurfacePointers, hostNullJavaScriptPinCount);
	assert.deepEqual(value.commits.map(item => item.commit)
		, hostNullJavaScriptCommits);
	assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
		, `${hostNullJavaScriptPredecessor}..${hostNullJavaScriptPinRefresh}`])
		.trim().split("\n"), hostNullJavaScriptCommits);
	for(const [index, item] of value.commits.entries())
	{
		assert.equal(item.parent, index === 0 ? hostNullJavaScriptPredecessor
			: hostNullJavaScriptCommits[index - 1]);
		assert.equal(item.subject, git(["show", "-s", "--format=%s"
			, item.commit]).trim());
		assert.deepEqual(item.modified, names(["diff-tree", "--no-commit-id"
			, "--name-only", "--diff-filter=M", "-r", item.commit]));
		assert.deepEqual(item.added, names(["diff-tree", "--no-commit-id"
			, "--name-only", "--diff-filter=A", "-r", item.commit]));
	}
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
		, hostNullJavaScriptPredecessor, hostNullJavaScriptPinRefresh, "--"])
		, [...hostNullJavaScriptChangedPaths].sort());
});

test("HostNull JavaScript history reverses every intermediate source state", async () => {
	const value = await record();
	const expected = value.commits.flatMap(item => item.modified.map(path =>
		`${item.commit}\0${path}`));
	assert.deepEqual(value.updates.map(item => `${item.commit}\0${item.path}`)
		, expected);
	for(const update of value.updates)
	{
		if(update.path === "docs/type-surface.v1.json")
		{
			assert.equal(await authenticateSourceHistoryReverse(
				gitSourceBytes(update.commit, update.path), update), true);
			continue;
		}
		const current = sourceAt(update.commit, update.path);
		const previous = sourceAt(update.parent, update.path);
		assert.equal(reverseHostNullJavaScriptUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeHostNullJavaScriptSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("HostNull JavaScript additions and newest-first registration are exact", async () => {
	const value = await record();
	assert.deepEqual(value.additions.map(item => item.path)
		, hostNullJavaScriptAddedPaths);
	for(const addition of value.additions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, hostNullJavaScriptPredecessor, "--", addition.path]).trim(), "");
		const source = hostNullJavaScriptImplementationAddedPaths.includes(addition.path)
			? sourceAt(hostNullJavaScriptPinRefresh, addition.path)
			: await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256);
		assert.equal(sha256(source), addition.currentSha256, addition.path);
	}
	assert.deepEqual(hostNullJavaScriptHistoryAddedPaths
		, hostNullJavaScriptAddedPaths.filter(path =>
			!hostNullJavaScriptImplementationAddedPaths.includes(path)));
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, hostNullJavaScriptIntegrationPaths);
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		assert.equal(await authenticateSourceHistoryReverse(
			Readable.from([Buffer.from(current)]), update), true);
		const previous = sourceAt(hostNullJavaScriptPinRefresh, update.path);
		assert.equal(reverseHostNullJavaScriptUpdate(current, update), previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
	}
	for(const path of hostNullJavaScriptNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("HostNull foundation changes only the explicit constructor contract", () => {
	const path = "docs/type-surface.v1.json";
	const diff = git(["diff", "--no-ext-diff", "--no-color", "--unified=0"
		, hostNullJavaScriptPredecessor, hostNullJavaScriptFoundation, "--", path]);
	const changes = diff.split("\n").filter(line => /^[+-]/u.test(line)
		&& !/^(?:---|\+\+\+)/u.test(line));
	const expected = [
		"+      \"host-null\","
		, "-      \"ir\": null,"
		, "+      \"ir\": \"constructor:host-null\","
	];
	assert.deepEqual(changes, expected);
	const configuration = sourceAt(hostNullJavaScriptFoundation
		, "schema/lean-export-configuration.schema.json");
	assert.match(configuration, /"hostProjections"/u);
	assert.match(configuration, /"name".*"nullConstructor".*"valueConstructor"/su);
	const reviewed = sourceAt(hostNullJavaScriptFoundation
		, "tests/reviewed-host-null.test.mjs");
	assert.match(reviewed, /reconcile only with the authenticated projection/u);
	assert.match(reviewed, /HostNull\.missing/u);
});

test("HostNull implementation retains direct null ABI and both callable contracts", () => {
	const copied = sourceAt(hostNullJavaScriptImplementation
		, "src/abi/component-copied.mjs");
	assert.match(copied, /"host-null": 38/u);
	const runtime = sourceAt(hostNullJavaScriptImplementation
		, "poc/lean-link-spike/component_scalar.cpp");
	assert.match(runtime, /kind >= 32 && slot->kind <= 38/u);
	assert.match(runtime, /kind < 32 \|\| kind > 38 \|\| kind == 37/u);
	assert.match(runtime, /kind == 34 \|\| kind == 38/u);
	const packageSource = sourceAt(hostNullJavaScriptImplementation
		, "src/release/component-npm-package.mjs");
	for(const name of ["component-callables.mjs", "component-copied.mjs"
		, "component-structured-callables.mjs", "default-value"])
		assert.match(packageSource, new RegExp(name.replaceAll(".", "\\."), "u"));
	const callableTests = sourceAt(hostNullJavaScriptImplementation
		, "tests/component-structured-callable-lean.test.mjs");
	assert.match(callableTests
		, /shared nominal Fin callback keeps source functions separate/u);
	assert.match(callableTests
		, /exact compiler-authenticated HostNull wrapper and constructors/u);
	const installed = sourceAt(hostNullJavaScriptImplementation
		, "tests/host-null-npm-installed.test.mjs");
	assert.match(installed, /null and nested Option across all JavaScript\/browser positions/u);
});

test("HostNull recurring acceptance is mandatory and retains complete observations", () => {
	const path = ".github/workflows/consumer-matrix.yml";
	const previous = sourceAt(hostNullJavaScriptImplementation, path);
	const current = sourceAt(hostNullJavaScriptWorkflow, path);
	assert.doesNotMatch(previous, /host_null_npm|host-null-node-browser/u);
	assert.equal(current.match(/id: host_null_npm/gu)?.length, 1);
	assert.equal(current.match(/steps\.host_null_npm\.outcome/gu)?.length, 3);
	assert.equal(current.match(/tests\/host-null-npm-installed\.test\.mjs/gu)?.length, 3);
	assert.match(current, /LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: chromium,firefox,webkit/u);
	assert.match(current, /name: host-null-node-browser-\$\{\{ github\.sha \}\}/u);
	assert.match(current, /path: build\/host-null\/npm\//u);
	assert.match(current, /if-no-files-found: error/u);
	assert.match(current, /retention-days: 30/u);
});

test("HostNull pin refresh changes exactly 975 live digest references", async () => {
	assert.equal(Object.keys(hostNullJavaScriptPinCounts).length, 48);
	assert.equal(hostNullJavaScriptPinCount, 975);
	const value = await record();
	const update = value.updates.find(item => item.commit === hostNullJavaScriptPinRefresh
		&& item.path === "docs/type-surface.v1.json");
	assert.ok(update);
	const transitions = new Map(Object.keys(hostNullJavaScriptPinCounts).map(path => [
		sha256(sourceAt(hostNullJavaScriptPinRefresh, path))
		, { path, previous: sha256(sourceAt(hostNullJavaScriptPredecessor, path))
			, pins: 0 }
	]));
	const digestPattern = /[0-9a-f]{64}/gu;
	for(const edit of update.edits)
	{
		assert.equal(edit.current.replace(digestPattern, "")
			, edit.previous.replace(digestPattern, ""));
		const current = edit.current.match(digestPattern) ?? [];
		const previous = edit.previous.match(digestPattern) ?? [];
		assert.equal(current.length, previous.length);
		for(const [index, digest] of current.entries())
		{
			const transition = transitions.get(digest);
			assert.ok(transition, digest);
			assert.equal(previous[index], transition.previous, transition.path);
			++transition.pins;
		}
	}
	for(const transition of transitions.values())
		assert.equal(transition.pins
			, hostNullJavaScriptPinCounts[transition.path], transition.path);
});

test("HostNull rollout changes no retained evidence, support cells or other backends", () => {
	for(const path of ["docs/evidence", "docs/consumer-support.v1.json"
		, "package.json", "src/backends/c", "src/backends/cpp"
		, "src/backends/dotnet", "src/backends/jvm", "src/backends/perl"
		, "src/backends/php", "src/backends/python", "src/backends/ruby"
		, "src/backends/rust", "src/backends/wit"])
		assert.equal(git(["rev-parse", `${hostNullJavaScriptPredecessor}:${path}`])
			, git(["rev-parse", `${hostNullJavaScriptPinRefresh}:${path}`]), path);
});

test("HostNull JavaScript history rejects forged transitions", async () => {
	const update = (await record()).updates.find(item =>
		item.path === "src/abi/component-copied.mjs");
	const current = sourceAt(update.commit, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseHostNullJavaScriptUpdate(current, forged));
	assert.equal(beforeHostNullJavaScriptSource("unknown.mjs", current), current);
	assert.equal(beforeHostNullJavaScriptSource(
		update.path, `${current}forged`), `${current}forged`);
});

test("HostNull history writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-host-null-history-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-host-null-javascript-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
