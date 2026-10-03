/**
 * Record the closed PHP installed-package evidence and bookkeeping transition.
 * The updater is pinned to the two integration commits and never runs producers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { assertPhpCallbackInstalledHistory, phpCallbackInstalledAdministrativePaths
	, phpCallbackInstalledBaseline, phpCallbackInstalledCompletedPredecessor
	, phpCallbackInstalledHistoryPath, phpCallbackInstalledIntegration
	, phpCallbackInstalledIntroducedPaths, phpCallbackInstalledLineage
	, phpCallbackInstalledPrevious, phpCallbackInstalledReaderPaths } from "../tests/helpers/php-callback-installed-staging-history.mjs";

const helperPath = "tests/helpers/php-callback-installed-staging-history.mjs";
const testsPath = "tests/helpers/php-callback-installed-staging-history-tests.mjs";
const updaterPath = "scripts/update-php-callback-installed-staging-history.mjs";
const inventoryPath = "docs/type-surface.v1.json";
const added = new Set([helperPath, testsPath, updaterPath, phpCallbackInstalledHistoryPath]);
const userUntracked = new Set([".writing-rules.md", "bad-ledge-fill.png"]);
const modifiedBeforeInventory = new Set([
	"src/adoption/test-profiles.mjs", ...phpCallbackInstalledReaderPaths
]);
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const at = (revision, path) => git(["show", `${revision}:${path}`]);

assert.equal(git(["rev-parse", "HEAD"]).trim(), phpCallbackInstalledIntegration,
	"Stage is frozen at the PHP evidence integration; later changes need a new chained ledger.");
for(const [index, revision] of phpCallbackInstalledLineage.entries())
	assert.equal(git(["rev-parse", `${revision}^`]).trim(), index ? phpCallbackInstalledLineage[index - 1] : phpCallbackInstalledBaseline);
for(const predecessor of [phpCallbackInstalledPrevious, phpCallbackInstalledCompletedPredecessor])
{
	assert.equal(sha256(await readFile(predecessor.path)), predecessor.sha256);
	assert.equal(sha256(at(phpCallbackInstalledBaseline, predecessor.path)), predecessor.sha256);
}
const integrated = git(["diff", "--name-status", "--no-renames", phpCallbackInstalledBaseline, phpCallbackInstalledIntegration])
	.trim().split("\n").filter(Boolean).map(line => line.split("\t"));
assert.deepEqual(integrated.map(([status, path]) => [status, path]), phpCallbackInstalledIntroducedPaths.map(path => ["A", path]));

const local = git(["diff", "--name-status", "--no-renames", phpCallbackInstalledIntegration])
	.trim().split("\n").filter(Boolean).map(line => line.split("\t"));
const localPaths = new Set(local.map(([, path]) => path));
for(const path of modifiedBeforeInventory) assert.ok(localPaths.has(path), `Missing staged source: ${path}`);
for(const path of localPaths) assert.ok(modifiedBeforeInventory.has(path) || path === inventoryPath,
	`Unreviewed staged source: ${path}`);
assert.ok(local.every(([status]) => status === "M"));
for(const path of git(["ls-files", "--others", "--exclude-standard"]).trim().split("\n").filter(Boolean))
	assert.ok(added.has(path) || userUntracked.has(path), `Unreviewed untracked source: ${path}`);

const profilePath = "src/adoption/test-profiles.mjs";
const oldProfile = at(phpCallbackInstalledIntegration, profilePath);
const currentProfile = await readFile(profilePath, "utf8");
const oldProfileSha256 = sha256(oldProfile), currentProfileSha256 = sha256(currentProfile);
const addedTests = ["owned-php-callback-result-package-evidence", "owned-php-callback-result-packaging"];
let reversedProfile = currentProfile;
for(const name of addedTests)
{
	const line = `\t\t, "${name}"\n`; assert.equal(reversedProfile.split(line).length, 2, name);
	reversedProfile = reversedProfile.replace(line, "");
}
assert.equal(reversedProfile, oldProfile, "Test-profile transition contains only the two declared registrations.");

const oldInventory = at(phpCallbackInstalledIntegration, inventoryPath);
const oldInventoryDocument = JSON.parse(oldInventory), inventory = structuredClone(oldInventoryDocument);
const sourceIdentities = new Map();
for(const path of [profilePath, ...phpCallbackInstalledReaderPaths]) sourceIdentities.set(path, {
	path
	, previous: sha256(at(phpCallbackInstalledIntegration, path))
	, current: sha256(await readFile(path))
});
const refreshes = [];
for(const identity of sourceIdentities.values())
{
	let count = 0;
	for(const evidence of inventory.evidence) for(const file of evidence.files)
		if(file.path === identity.path)
		{
			assert.equal(file.sha256, identity.previous); file.sha256 = identity.current; count++;
		}
	if(count > 0) refreshes.push({ ...identity, count });
}
refreshes.sort((left, right) => left.path.localeCompare(right.path));
assert.ok(refreshes.some(refresh => refresh.path === profilePath && refresh.count > 0), "No test-profile evidence hashes found.");
assert.equal(new Set(refreshes.map(refresh => refresh.current)).size, refreshes.length);
const replacements = refreshes.reduce((sum, refresh) => sum + refresh.count, 0);
const inventoryBytes = JSON.stringify(inventory, null, 2) + "\n";
assert.notEqual(inventoryBytes, oldInventory);
const presentInventory = JSON.parse(await readFile(inventoryPath, "utf8"));
for(const evidence of presentInventory.evidence) for(const file of evidence.files)
	if(sourceIdentities.has(file.path))
	{
		const identity = sourceIdentities.get(file.path);
		assert.ok([identity.previous, identity.current].includes(file.sha256), `Unreviewed inventory hash: ${file.path}`);
		file.sha256 = identity.previous;
	}
assert.deepEqual(presentInventory, oldInventoryDocument, "Inventory contains changes beyond exact source-hash refreshes.");

const spanUpdate = (path, current, previous) => {
	assert.notEqual(current, previous, path); let start = 0;
	while(start < current.length && start < previous.length && current[start] === previous[start]) start++;
	let currentEnd = current.length, previousEnd = previous.length;
	while(currentEnd > start && previousEnd > start && current[currentEnd - 1] === previous[previousEnd - 1])
	{ currentEnd--; previousEnd--; }
	return { path
		, category: "reader"
		, currentSha256: sha256(current)
		, previousSha256: sha256(previous)
		, strategy: "spans"
		, edits: [{ start, current: current.slice(start, currentEnd), previous: previous.slice(start, previousEnd) }] };
};
const updates = [
	{ path: profilePath
		, category: "administrative"
		, currentSha256: currentProfileSha256
		, previousSha256: oldProfileSha256, strategy: "registrations", addedTests }
	, { path: inventoryPath
		, category: "administrative"
		, currentSha256: sha256(inventoryBytes)
		, previousSha256: sha256(oldInventory), strategy: "replace-all"
		, edits: refreshes }
];
for(const path of phpCallbackInstalledReaderPaths)
	updates.push(spanUpdate(path, await readFile(path, "utf8"), at(phpCallbackInstalledIntegration, path)));
updates.sort((left, right) => left.path.localeCompare(right.path));
assert.deepEqual(updates.map(update => update.path), [...phpCallbackInstalledAdministrativePaths, ...phpCallbackInstalledReaderPaths].sort());

const introducedSources = {};
for(const path of phpCallbackInstalledIntroducedPaths)
{
	const integrationSha256 = sha256(at(phpCallbackInstalledIntegration, path));
	const stagedSha256 = sha256(await readFile(path));
	introducedSources[path] = { integrationSha256, stagedSha256 };
}
const record = { schemaVersion: 1
	, kind: "php-callback-installed-staging-source-history"
	, baselineRevision: phpCallbackInstalledBaseline
	, integrationRevision: phpCallbackInstalledIntegration
	, lineage: [...phpCallbackInstalledLineage]
	, previous: phpCallbackInstalledPrevious
	, completedPredecessor: phpCallbackInstalledCompletedPredecessor
	, scope: { stage: "installed-package-evidence"
		, acceptanceReceipt: false
		, ciRequired: false
		, documentationPublished: false
		, producerRerun: false
		, registryPublication: false
		, supportPromotions: 0 }
	, updates, introducedSources };
assertPhpCallbackInstalledHistory(record);
const bytes = JSON.stringify(record, null, 2) + "\n", helper = await readFile(helperPath, "utf8");
const pattern = /export const phpCallbackInstalledHistorySha256 = "(?:PENDING|[a-f0-9]{64})";/gu;
assert.equal([...helper.matchAll(pattern)].length, 1);
await writeFile(inventoryPath, inventoryBytes);
await writeFile(phpCallbackInstalledHistoryPath, bytes);
await writeFile(helperPath, helper.replace(pattern,
	`export const phpCallbackInstalledHistorySha256 = "${sha256(bytes)}";`));
process.stdout.write(`Recorded ${updates.length} exact PHP staging updates, ${phpCallbackInstalledIntroducedPaths.length} introduced sources and ${replacements} inventory hash references; predecessor receipts unchanged.\n`);
