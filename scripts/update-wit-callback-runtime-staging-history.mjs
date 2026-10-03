/**
 * Record only the closed WIT runtime lineage and its latest-first reader hooks.
 * No inventory, package, workflow or runtime receipt is changed by this updater.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { witCallbackRuntimeHistoryPath, witCallbackRuntimeBaseline
	, witCallbackRuntimeIntegration, witCallbackRuntimeLineage
	, witCallbackRuntimePrevious, witCallbackRuntimeSourcePaths
	, witCallbackRuntimeIntroducedPaths, witCallbackRuntimeReaderPaths
	, witCallbackRuntimeSuccessorPaths, assertWitCallbackRuntimeHistory } from "../tests/helpers/wit-callback-runtime-staging-history.mjs";

const helper = "tests/helpers/wit-callback-runtime-staging-history.mjs";
const added = [helper, witCallbackRuntimeHistoryPath
	, "scripts/update-wit-callback-runtime-staging-history.mjs"
	, "tests/helpers/wit-callback-runtime-staging-history-tests.mjs"];
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const at = (revision, path) => git(["show", `${revision}:${path}`]);
assert.equal(git(["rev-parse", "HEAD"]).trim(), witCallbackRuntimeIntegration,
	"Updater is frozen at integration7d07f9b; later changes require a new chained stage.");
for(const [index, revision] of witCallbackRuntimeLineage.entries())
	assert.equal(git(["rev-parse", `${revision}^`]).trim(), index ? witCallbackRuntimeLineage[index - 1] : witCallbackRuntimeBaseline);
assert.equal(sha256(await readFile(witCallbackRuntimePrevious.path)), witCallbackRuntimePrevious.sha256);
assert.equal(sha256(at(witCallbackRuntimeIntegration, witCallbackRuntimePrevious.path)), witCallbackRuntimePrevious.sha256);
const end = witCallbackRuntimeLineage.at(-1);
const changes = git(["diff", "--name-status", "--no-renames", witCallbackRuntimeBaseline, end]).trim().split("\n").map(line => line.split("\t"));
assert.deepEqual(changes.filter(([status]) => status === "M").map(([, path]) => path), witCallbackRuntimeSourcePaths);
assert.deepEqual(changes.filter(([status]) => status === "A").map(([, path]) => path), witCallbackRuntimeIntroducedPaths);
assert.ok(changes.every(([status]) => ["A", "M"].includes(status)));
const successors = git(["diff", "--name-only", "--no-renames", "e5f7ae3dbc9ee8e85a5fd65a4fb68743aeccb0ed", witCallbackRuntimeIntegration]).trim().split("\n");
assert.deepEqual(successors, witCallbackRuntimeSuccessorPaths);
const local = git(["diff", "--name-status", "--no-renames", witCallbackRuntimeIntegration]).trim().split("\n").filter(Boolean).map(line => line.split("\t"));
for(const [status, path] of local)
	assert.ok(status === "M" && witCallbackRuntimeReaderPaths.includes(path) || status === "A" && added.includes(path), `Unreviewed local edit: ${status} ${path}`);
for(const path of git(["ls-files", "--others", "--exclude-standard"]).trim().split("\n").filter(Boolean))
	assert.ok(added.includes(path), `Unreviewed untracked source: ${path}`);
const update = (path, current, previous) => {
	assert.notEqual(current, previous, path);
	let start = 0;
	while(start < current.length && start < previous.length && current[start] === previous[start]) start++;
	let currentEnd = current.length, previousEnd = previous.length;
	while(currentEnd > start && previousEnd > start && current[currentEnd - 1] === previous[previousEnd - 1])
	{ currentEnd--; previousEnd--; }
	return { path, currentSha256: sha256(current)
		, previousSha256: sha256(previous), strategy: "spans"
		, edits: [{ start, current: current.slice(start, currentEnd), previous: previous.slice(start, previousEnd) }] };
};
const updates = [], readerUpdates = [], introducedSources = {}, successorInputs = {};
for(const path of witCallbackRuntimeSourcePaths)
{
	const current = at(end, path); assert.equal(await readFile(path, "utf8"), current, path);
	updates.push(update(path, current, at(witCallbackRuntimeBaseline, path)));
}
for(const path of witCallbackRuntimeReaderPaths)
	readerUpdates.push(update(path, await readFile(path, "utf8"), at(witCallbackRuntimeIntegration, path)));
for(const path of witCallbackRuntimeIntroducedPaths)
{
	const currentSha256 = sha256(await readFile(path)), integratedSha256 = sha256(at(end, path));
	assert.equal(currentSha256, integratedSha256, path); introducedSources[path] = { currentSha256, integratedSha256 };
}
for(const path of witCallbackRuntimeSuccessorPaths)
{
	assert.equal(await readFile(path, "utf8"), at(witCallbackRuntimeIntegration, path), path);
	successorInputs[path] = { sha256: sha256(at(witCallbackRuntimeIntegration, path)) };
}
const record = { schemaVersion: 1
	, kind: "wit-callback-runtime-staging-source-history"
	, baselineRevision: witCallbackRuntimeBaseline
	, integrationRevision: witCallbackRuntimeIntegration
	, lineage: [...witCallbackRuntimeLineage]
	, previous: witCallbackRuntimePrevious
	, updates, readerUpdates, introducedSources, successorInputs };
assertWitCallbackRuntimeHistory(record);
const bytes = JSON.stringify(record, null, 2) + "\n", source = await readFile(helper, "utf8");
const pattern = /export const witCallbackRuntimeHistorySha256 = "(?:PENDING|[a-f0-9]{64})";/gu;
assert.equal([...source.matchAll(pattern)].length, 1);
await writeFile(witCallbackRuntimeHistoryPath, bytes);
await writeFile(helper, source.replace(pattern, `export const witCallbackRuntimeHistorySha256 = "${sha256(bytes)}";`));
process.stdout.write(`Recorded ${updates.length} WIT transitions, ${readerUpdates.length} reader hooks, ${Object.keys(introducedSources).length} introduced files; ${Object.keys(successorInputs).length} Perl successors preserved.\n`);
