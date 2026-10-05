/**
 * Record the installed-WIT callback acceptance source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { assertWitCallbackInstalledHistory, witCallbackInstalledBaseline
	, witCallbackInstalledHistoryPath, witCallbackInstalledIntegration
	, witCallbackInstalledIntroducedPaths, witCallbackInstalledLineage
	, witCallbackInstalledModifiedPaths, witCallbackInstalledPrevious
	, witCallbackInstalledReaderPaths, witCallbackInstalledReceipt } from "../tests/helpers/wit-callback-installed-acceptance-history.mjs";

const helperPath = "tests/helpers/wit-callback-installed-acceptance-history.mjs";
const testsPath = "tests/helpers/wit-callback-installed-acceptance-history-tests.mjs";
const updaterPath = "scripts/update-wit-callback-installed-acceptance-history.mjs";
const newPaths = new Set([helperPath, testsPath, updaterPath, witCallbackInstalledHistoryPath]);
const userUntracked = new Set([".writing-rules.md", "bad-ledge-fill.png"]);
const categories = new Map([
	...[".github/workflows/consumer-matrix.yml", "package.json"].map(path => [path, "administrative"])
	, ...["docs/consume/wit-wasi.md"
		, "docs/lean/existing-package.md"
		, "docs/lean/export-decisions.md"
		, "docs/publish/wit-wasi.md"].map(path => [path, "documentation"])
	, ...["src/analyze/export-configuration.mjs"
		, "src/backends/wit/copied-model.mjs"
		, "src/build/elaborated-component.mjs"
		, "src/build/multi-profile-project.mjs"
		, "src/build/native-c-projection.mjs"
		, "src/build/native-project.mjs"].map(path => [path, "implementation"])
	, ...["tests/helpers/wit-owned-callback-result-probe.mjs"
		, "tests/native-wit.test.mjs"].map(path => [path, "test"])
	, ...witCallbackInstalledReaderPaths.map(path => [path, "reader"])
]);
const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const at = (revision, path) => git(["show", `${revision}:${path}`]);

assert.equal(git(["rev-parse", "HEAD"]).trim(), witCallbackInstalledIntegration);
assert.deepEqual(witCallbackInstalledLineage, [
	git(["rev-parse", `${witCallbackInstalledIntegration}^`]).trim()
	, witCallbackInstalledIntegration
]);
assert.equal(git(["rev-parse", `${witCallbackInstalledLineage[0]}^`]).trim()
	, witCallbackInstalledBaseline);
for(const reference of [witCallbackInstalledPrevious, witCallbackInstalledReceipt])
	assert.equal(sha256(await readFile(reference.path)), reference.sha256);

const integrated = git(["diff", "--name-status", "--no-renames"
	, witCallbackInstalledBaseline, witCallbackInstalledIntegration])
	.trim().split("\n").filter(Boolean).map(line => line.split("\t"));
const expected = [
	...witCallbackInstalledModifiedPaths.map(path => ["M", path])
	, ...witCallbackInstalledIntroducedPaths.map(path => ["A", path])
].sort((left, right) => left[1].localeCompare(right[1]));
assert.deepEqual(integrated.sort((left, right) => left[1].localeCompare(right[1])), expected);

const local = git(["diff", "--name-status", "--no-renames", witCallbackInstalledIntegration])
	.trim().split("\n").filter(Boolean).map(line => line.split("\t"));
for(const [status, path] of local)
	assert.ok(status === "M" && witCallbackInstalledReaderPaths.includes(path)
		|| status === "A" && newPaths.has(path), `Unreviewed local edit: ${status} ${path}`);
for(const path of witCallbackInstalledReaderPaths)
	assert.ok(local.some(([, value]) => value === path), `Missing reader update: ${path}`);
for(const path of git(["ls-files", "--others", "--exclude-standard"]).trim().split("\n").filter(Boolean))
	assert.ok(newPaths.has(path) || userUntracked.has(path), `Unreviewed untracked source: ${path}`);

const update = (path, current, previous) => {
	assert.notEqual(current, previous, path); let start = 0;
	while(start < current.length && start < previous.length && current[start] === previous[start]) start++;
	let currentEnd = current.length, previousEnd = previous.length;
	while(currentEnd > start && previousEnd > start && current[currentEnd - 1] === previous[previousEnd - 1])
	{ currentEnd--; previousEnd--; }
	return { path, category: categories.get(path), currentSha256: sha256(current)
		, previousSha256: sha256(previous), strategy: "spans"
		, edits: [{ start, current: current.slice(start, currentEnd), previous: previous.slice(start, previousEnd) }] };
};
const updates = witCallbackInstalledModifiedPaths.map(path =>
	update(path, at(witCallbackInstalledIntegration, path), at(witCallbackInstalledBaseline, path)));
const readerUpdates = [];
for(const path of witCallbackInstalledReaderPaths)
	readerUpdates.push(update(path, await readFile(path, "utf8")
		, at(witCallbackInstalledIntegration, path)));
const introducedSources = {};
for(const path of witCallbackInstalledIntroducedPaths)
	introducedSources[path] = { integrationSha256: sha256(at(witCallbackInstalledIntegration, path))
		, currentSha256: sha256(await readFile(path)) };
const record = { schemaVersion: 1
	, kind: "wit-callback-installed-acceptance-source-history"
	, baselineRevision: witCallbackInstalledBaseline
	, integrationRevision: witCallbackInstalledIntegration
	, lineage: witCallbackInstalledLineage
	, previous: witCallbackInstalledPrevious
	, completedReceipt: witCallbackInstalledReceipt
	, scope: { stage: "installed-wit-callback-result-acceptance"
		, acceptanceReceipt: true, compiledLean: true, actualWasmtime: true
		, sourceFreeConsumption: true, relocatedPublicReruns: true
		, dependencyTamperChecks: true, ciRequired: true
		, documentationPublished: true, registryPublication: false
		, phpWasmPromotion: false }
	, updates, readerUpdates, introducedSources };
assertWitCallbackInstalledHistory(record);
const bytes = JSON.stringify(record, null, 2) + "\n", helper = await readFile(helperPath, "utf8");
const pattern = /export const witCallbackInstalledHistorySha256 = "(?:PENDING|[a-f0-9]{64})";/gu;
assert.equal([...helper.matchAll(pattern)].length, 1);
await writeFile(witCallbackInstalledHistoryPath, bytes);
await writeFile(helperPath, helper.replace(pattern
	, `export const witCallbackInstalledHistorySha256 = "${sha256(bytes)}";`));
process.stdout.write(`Recorded ${updates.length} installed WIT updates and ${readerUpdates.length} reader updates.\n`);
