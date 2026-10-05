/**
 * Record the closed direct-WIT callback acceptance source transition.
 * The updater is pinned to the completed receipt commit and changes no support
 * state or runtime observation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { assertWitCallbackAcceptanceHistory, witCallbackAcceptanceBaseline
	, witCallbackAcceptanceHistoryPath, witCallbackAcceptanceIntegration
	, witCallbackAcceptanceIntegrationModifiedPaths
	, witCallbackAcceptanceIntroducedPaths, witCallbackAcceptanceLineage
	, witCallbackAcceptancePrevious, witCallbackAcceptanceReaderPaths
	, witCallbackAcceptanceReceipt } from "../tests/helpers/wit-callback-acceptance-history.mjs";

const helperPath = "tests/helpers/wit-callback-acceptance-history.mjs";
const testsPath = "tests/helpers/wit-callback-acceptance-history-tests.mjs";
const updaterPath = "scripts/update-wit-callback-acceptance-history.mjs";
const newPaths = new Set([helperPath, testsPath, updaterPath, witCallbackAcceptanceHistoryPath]);
const userUntracked = new Set([".writing-rules.md", "bad-ledge-fill.png"]);
const categories = new Map([
	[".github/workflows/consumer-matrix.yml", "administrative"]
	, ["docs/consume/wit-wasi.md", "documentation"]
	, ["package.json", "administrative"]
	, ["tests/helpers/owned-perl-callback-result-variant-acceptance.mjs", "reader"]
	, ["tests/helpers/owned-wit-callback-result-acceptance.mjs", "reader"]
	, ["tests/helpers/php-callback-acceptance-history.mjs", "reader"]
	, ["tests/helpers/php-callback-acceptance-history-tests.mjs", "reader"]
]);
const git = arguments_ => execFileSync("git", arguments_, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const at = (revision, path) => git(["show", `${revision}:${path}`]);

assert.equal(git(["rev-parse", "HEAD"]).trim(), witCallbackAcceptanceIntegration,
	"Acceptance updater is pinned to the completed direct-WIT receipt commit.");
assert.equal(git(["rev-parse", `${witCallbackAcceptanceIntegration}^`]).trim()
	, witCallbackAcceptanceBaseline);
assert.deepEqual(witCallbackAcceptanceLineage, [witCallbackAcceptanceIntegration]);
assert.equal(sha256(await readFile(witCallbackAcceptancePrevious.path)), witCallbackAcceptancePrevious.sha256);
assert.equal(sha256(await readFile(witCallbackAcceptanceReceipt.path)), witCallbackAcceptanceReceipt.sha256);

const integrated = git(["diff", "--name-status", "--no-renames"
	, witCallbackAcceptanceBaseline, witCallbackAcceptanceIntegration])
	.trim().split("\n").filter(Boolean).map(line => line.split("\t"));
const expectedIntegration = [
	...witCallbackAcceptanceIntegrationModifiedPaths.map(path => ["M", path])
	, ...witCallbackAcceptanceIntroducedPaths.map(path => ["A", path])
].sort((left, right) => left[1].localeCompare(right[1]));
assert.deepEqual(integrated.sort((left, right) => left[1].localeCompare(right[1])), expectedIntegration);

const local = git(["diff", "--name-status", "--no-renames", witCallbackAcceptanceIntegration])
	.trim().split("\n").filter(Boolean).map(line => line.split("\t"));
for(const [status, path] of local)
	assert.ok(status === "M" && witCallbackAcceptanceReaderPaths.includes(path)
		|| status === "A" && newPaths.has(path), `Unreviewed local edit: ${status} ${path}`);
for(const path of witCallbackAcceptanceReaderPaths)
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
const updates = witCallbackAcceptanceIntegrationModifiedPaths.map(path =>
	update(path, at(witCallbackAcceptanceIntegration, path), at(witCallbackAcceptanceBaseline, path)));
const readerUpdates = [];
for(const path of witCallbackAcceptanceReaderPaths)
	readerUpdates.push(update(path, await readFile(path, "utf8"), at(witCallbackAcceptanceIntegration, path)));
const introducedSources = {};
for(const path of witCallbackAcceptanceIntroducedPaths)
	introducedSources[path] = {
		integrationSha256: sha256(at(witCallbackAcceptanceIntegration, path))
		, currentSha256: sha256(await readFile(path))
	};
const record = { schemaVersion: 1
	, kind: "wit-callback-acceptance-source-history"
	, baselineRevision: witCallbackAcceptanceBaseline
	, integrationRevision: witCallbackAcceptanceIntegration
	, lineage: witCallbackAcceptanceLineage
	, previous: witCallbackAcceptancePrevious
	, completedReceipt: witCallbackAcceptanceReceipt
	, scope: { stage: "direct-wit-callback-acceptance", acceptanceReceipt: true
		, compiledLean: true, wasmtimeExecution: true, ciRequired: true
		, documentationPublished: true, producerRerun: false
		, installedPackage: false, registryPublication: false, supportPromotions: 0 }
	, updates, readerUpdates, introducedSources };
assertWitCallbackAcceptanceHistory(record);
const bytes = JSON.stringify(record, null, 2) + "\n", helper = await readFile(helperPath, "utf8");
const pattern = /export const witCallbackAcceptanceHistorySha256 = "(?:PENDING|[a-f0-9]{64})";/gu;
assert.equal([...helper.matchAll(pattern)].length, 1);
await writeFile(witCallbackAcceptanceHistoryPath, bytes);
await writeFile(helperPath, helper.replace(pattern
	, `export const witCallbackAcceptanceHistorySha256 = "${sha256(bytes)}";`));
process.stdout.write(`Recorded ${updates.length} WIT acceptance updates, ${readerUpdates.length} reader updates and ${Object.keys(introducedSources).length} introduced sources; support states unchanged.\n`);
