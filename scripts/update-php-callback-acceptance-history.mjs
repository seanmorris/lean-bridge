/**
 * Record the closed native-PHP callback acceptance source transition.
 * The updater is pinned to the completed acceptance commit and never runs a
 * producer or changes a support state.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { assertPhpCallbackAcceptanceHistory, phpCallbackAcceptanceBaseline
	, phpCallbackAcceptanceHistoryPath, phpCallbackAcceptanceIntegration
	, phpCallbackAcceptanceIntegrationModifiedPaths
	, phpCallbackAcceptanceIntroducedPaths, phpCallbackAcceptanceModifiedPaths
	, phpCallbackAcceptanceLineage, phpCallbackAcceptanceReaderPaths
	, phpCallbackAcceptancePrevious, phpCallbackAcceptanceReceipt
} from "../tests/helpers/php-callback-acceptance-history.mjs";

const helperPath = "tests/helpers/php-callback-acceptance-history.mjs";
const testsPath = "tests/helpers/php-callback-acceptance-history-tests.mjs";
const updaterPath = "scripts/update-php-callback-acceptance-history.mjs";
const inventoryPath = "docs/type-surface.v1.json";
const newPaths = new Set([helperPath, testsPath, updaterPath, phpCallbackAcceptanceHistoryPath]);
const userUntracked = new Set([".writing-rules.md", "bad-ledge-fill.png"]);
const categories = new Map([
	[".github/workflows/consumer-matrix.yml", "administrative"]
	, ["docs/php.md", "documentation"]
	, [inventoryPath, "administrative"]
	, ["package.json", "administrative"]
	, ["src/adoption/test-profiles.mjs", "administrative"]
	, ["tests/copied-fixture-source-history.test.mjs", "reader"]
	, ["tests/helpers/owned-perl-callback-result-variant-acceptance.mjs", "reader"]
	, ["tests/helpers/owned-php-callback-result-acceptance.mjs", "reader"]
	, ["tests/helpers/owned-php-callback-result-package-evidence.mjs", "reader"]
	, ["tests/helpers/php-callback-installed-staging-history.mjs", "reader"]
	, ["tests/helpers/php-callback-installed-staging-history-tests.mjs", "reader"]
]);
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const at = (revision, path) => git(["show", `${revision}:${path}`]);

assert.equal(git(["rev-parse", "HEAD"]).trim(), phpCallbackAcceptanceIntegration,
	"Stage is frozen at the native-PHP acceptance commit; later changes need a successor ledger.");
for(const [index, revision] of phpCallbackAcceptanceLineage.entries())
	assert.equal(git(["rev-parse", `${revision}^`]).trim()
		, index ? phpCallbackAcceptanceLineage[index - 1] : phpCallbackAcceptanceBaseline);
assert.equal(sha256(await readFile(phpCallbackAcceptancePrevious.path)), phpCallbackAcceptancePrevious.sha256);
assert.equal(sha256(at(phpCallbackAcceptanceBaseline, phpCallbackAcceptancePrevious.path))
	, phpCallbackAcceptancePrevious.sha256);
assert.equal(sha256(await readFile(phpCallbackAcceptanceReceipt.path)), phpCallbackAcceptanceReceipt.sha256);
assert.equal(sha256(at(phpCallbackAcceptanceIntegration, phpCallbackAcceptanceReceipt.path))
	, phpCallbackAcceptanceReceipt.sha256);

const integrated = git(["diff", "--name-status", "--no-renames"
	, phpCallbackAcceptanceBaseline, phpCallbackAcceptanceIntegration])
	.trim().split("\n").filter(Boolean).map(line => line.split("\t"));
const expectedIntegration = [
	...phpCallbackAcceptanceIntegrationModifiedPaths.map(path => ["M", path])
	, ...phpCallbackAcceptanceIntroducedPaths.map(path => ["A", path])
].sort((left, right) => left[1].localeCompare(right[1]));
assert.deepEqual(integrated.sort((left, right) => left[1].localeCompare(right[1])), expectedIntegration);

const local = git(["diff", "--name-status", "--no-renames", phpCallbackAcceptanceIntegration])
	.trim().split("\n").filter(Boolean).map(line => line.split("\t"));
const allowedLocal = new Set([
	".github/workflows/consumer-matrix.yml", "package.json"
	, "tests/helpers/owned-perl-callback-result-variant-acceptance.mjs"
	, "tests/helpers/owned-php-callback-result-acceptance.mjs"
	, "tests/helpers/php-callback-installed-staging-history.mjs"
	, "tests/helpers/php-callback-installed-staging-history-tests.mjs"
]);
for(const [status, path] of local)
{
	assert.equal(status, "M", `Unsupported local transition: ${status} ${path}`);
	assert.ok(allowedLocal.has(path) || path === inventoryPath, `Unreviewed local source: ${path}`);
}
for(const path of allowedLocal) assert.ok(local.some(([, value]) => value === path), `Missing reader update: ${path}`);
for(const path of git(["ls-files", "--others", "--exclude-standard"]).trim().split("\n").filter(Boolean))
	assert.ok(newPaths.has(path) || userUntracked.has(path), `Unreviewed untracked source: ${path}`);

const baselineInventory = JSON.parse(at(phpCallbackAcceptanceBaseline, inventoryPath));
const integrationInventory = JSON.parse(at(phpCallbackAcceptanceIntegration, inventoryPath));
const currentInventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const currentFiles = new Map();
for(const evidence of currentInventory.evidence) for(const file of evidence.files)
	if(phpCallbackAcceptanceModifiedPaths.includes(file.path) && file.path !== inventoryPath)
		currentFiles.set(file.path, sha256(await readFile(file.path)));
for(const evidence of currentInventory.evidence) for(const file of evidence.files)
	if(currentFiles.has(file.path)) file.sha256 = currentFiles.get(file.path);
const inventoryBytes = JSON.stringify(currentInventory, null, 2) + "\n";

const inventoryTransition = (current, previous, allowed) => {
	const working = structuredClone(current), edits = new Map();
	for(const [index, evidence] of working.evidence.entries())
		for(const [fileIndex, file] of evidence.files.entries())
		{
			const prior = previous.evidence[index].files[fileIndex];
			assert.equal(evidence.id, previous.evidence[index].id);
			assert.equal(file.path, prior.path);
			if(file.sha256 !== prior.sha256)
			{
				assert.ok(allowed.includes(file.path), file.path);
				const key = `${file.path}\0${file.sha256}\0${prior.sha256}`;
				const edit = edits.get(key) ?? {
					path: file.path, current: file.sha256, previous: prior.sha256, count: 0
				};
				edit.count++; edits.set(key, edit); file.sha256 = prior.sha256;
			}
		}
	assert.deepEqual(working, previous, "Inventory changed beyond authenticated source hashes.");
	return [...edits.values()].sort((left, right) => left.path.localeCompare(right.path));
};
const integrationInventoryEdits = inventoryTransition(integrationInventory, baselineInventory
	, phpCallbackAcceptanceIntegrationModifiedPaths);
const readerInventoryEdits = inventoryTransition(currentInventory, integrationInventory
	, phpCallbackAcceptanceReaderPaths);

const spanUpdate = (path, current, previous) => {
	assert.notEqual(current, previous, path); let start = 0;
	while(start < current.length && start < previous.length && current[start] === previous[start]) start++;
	let currentEnd = current.length, previousEnd = previous.length;
	while(currentEnd > start && previousEnd > start && current[currentEnd - 1] === previous[previousEnd - 1])
	{ currentEnd--; previousEnd--; }
	return { path, category: categories.get(path), currentSha256: sha256(current)
		, previousSha256: sha256(previous), strategy: "spans"
		, edits: [{ start, current: current.slice(start, currentEnd), previous: previous.slice(start, previousEnd) }] };
};
const updates = [];
for(const path of phpCallbackAcceptanceIntegrationModifiedPaths)
	if(path === inventoryPath)
		updates.push({ path
			, category: categories.get(path)
			, currentSha256: sha256(at(phpCallbackAcceptanceIntegration, path))
			, previousSha256: sha256(at(phpCallbackAcceptanceBaseline, path))
			, strategy: "source-hashes"
			, edits: integrationInventoryEdits });
	else updates.push(spanUpdate(path, at(phpCallbackAcceptanceIntegration, path)
		, at(phpCallbackAcceptanceBaseline, path)));
updates.sort((left, right) => left.path.localeCompare(right.path));

const readerUpdates = [];
for(const path of phpCallbackAcceptanceReaderPaths)
	if(path === inventoryPath)
		readerUpdates.push({ path
			, category: categories.get(path)
			, currentSha256: sha256(inventoryBytes)
			, previousSha256: sha256(at(phpCallbackAcceptanceIntegration, path))
			, strategy: "source-hashes"
			, edits: readerInventoryEdits });
	else readerUpdates.push(spanUpdate(path, await readFile(path, "utf8")
		, at(phpCallbackAcceptanceIntegration, path)));
readerUpdates.sort((left, right) => left.path.localeCompare(right.path));

const introducedSources = {};
for(const path of phpCallbackAcceptanceIntroducedPaths)
	introducedSources[path] = { integrationSha256: sha256(at(phpCallbackAcceptanceIntegration, path))
		, currentSha256: sha256(await readFile(path)) };
const record = { schemaVersion: 1
	, kind: "php-callback-acceptance-source-history"
	, baselineRevision: phpCallbackAcceptanceBaseline
	, integrationRevision: phpCallbackAcceptanceIntegration
	, lineage: phpCallbackAcceptanceLineage
	, previous: phpCallbackAcceptancePrevious
	, completedReceipt: phpCallbackAcceptanceReceipt
	, scope: { stage: "native-php-callback-acceptance"
		, acceptanceReceipt: true, ciRequired: true, documentationPublished: true
		, producerRerun: true, registryPublication: false, supportPromotions: 0 }
	, updates, readerUpdates, introducedSources };
assertPhpCallbackAcceptanceHistory(record);
const bytes = JSON.stringify(record, null, 2) + "\n", helper = await readFile(helperPath, "utf8");
const pattern = /export const phpCallbackAcceptanceHistorySha256 = "(?:PENDING|[a-f0-9]{64})";/gu;
assert.equal([...helper.matchAll(pattern)].length, 1);
await writeFile(inventoryPath, inventoryBytes);
await writeFile(phpCallbackAcceptanceHistoryPath, bytes);
await writeFile(helperPath, helper.replace(pattern
	, `export const phpCallbackAcceptanceHistorySha256 = "${sha256(bytes)}";`));
process.stdout.write(`Recorded ${updates.length} acceptance updates, ${readerUpdates.length} reader updates, ${Object.keys(introducedSources).length} introduced sources and ${integrationInventoryEdits.length + readerInventoryEdits.length} inventory identity edits; support states unchanged.\n`);
