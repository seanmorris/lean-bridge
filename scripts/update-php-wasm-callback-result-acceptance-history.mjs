/**
 * Record the closed PHP-Wasm callback-result acceptance source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertPhpWasmCallbackResultHistory, phpWasmCallbackResultBaseline
	, phpWasmCallbackResultHistoryPath, phpWasmCallbackResultIntegration
	, phpWasmCallbackResultIntroducedPaths, phpWasmCallbackResultLineage
	, phpWasmCallbackResultModifiedPaths, phpWasmCallbackResultPrevious
	, phpWasmCallbackResultReaderPaths, phpWasmCallbackResultReceipt
} from "../tests/helpers/php-wasm-callback-result-acceptance-history.mjs";

const helperPath = "tests/helpers/php-wasm-callback-result-acceptance-history.mjs";
const testsPath = "tests/helpers/php-wasm-callback-result-acceptance-history-tests.mjs";
const updaterPath = "scripts/update-php-wasm-callback-result-acceptance-history.mjs";
const inventoryPath = "docs/type-surface.v1.json";
const newPaths = new Set([helperPath, testsPath, updaterPath, phpWasmCallbackResultHistoryPath]);
const userUntracked = new Set([".writing-rules.md", "bad-ledge-fill.png"]);
const categories = new Map([
	[".github/workflows/consumer-matrix.yml", "administrative"]
	, ["docs/evidence/owned-php-wasm-callback-results-20261003.json", "receipt"]
	, ["docs/evidence/owned-php-wasm-callback-results-20261003.md", "documentation"]
	, ["docs/php.md", "documentation"]
	, ["docs/publish/php.md", "documentation"]
	, [inventoryPath, "administrative"]
	, ["package.json", "administrative"]
	, ["scripts/record-owned-php-wasm-callback-results.mjs", "recorder"]
	, ["src/adoption/test-profiles.mjs", "administrative"]
	, ["src/analyze/export-configuration.mjs", "implementation"]
	, ["src/backends/php/owned-zend-borrows.mjs", "implementation"]
	, ["src/backends/php/owned-zend-callbacks.mjs", "implementation"]
	, ["src/backends/php/owned-zend-extension.mjs", "implementation"]
	, ["src/backends/php/owned-zend-model.mjs", "implementation"]
	, ["src/backends/php/owned-zend-php.mjs", "implementation"]
	, ["src/backends/php/owned-zend-readme.mjs", "implementation"]
	, ["src/build/elaborated-component.mjs", "implementation"]
	, ["src/build/multi-profile-project.mjs", "implementation"]
	, ["src/build/php-wasm-copied-artifacts.mjs", "implementation"]
	, ["src/build/php-wasm-copied-component.mjs", "implementation"]
	, ["src/build/php-wasm-owned-component.mjs", "implementation"]
	, ["src/build/php-wasm-owned-model.mjs", "implementation"]
	, ["src/build/php-wasm-project.mjs", "implementation"]
	, ["src/release/php-wasm-copied-package.mjs", "implementation"]
	, ["tests/documentation.test.mjs", "test"]
	, ["tests/helpers/copied-fixture-source-history.mjs", "reader"]
	, ["tests/helpers/native-ci-isolation.mjs", "reader"]
	, ["tests/helpers/native-fork-repair-evidence.mjs", "reader"]
	, ["tests/helpers/owned-aggregate-evidence.mjs", "reader"]
	, ["tests/helpers/owned-cpp-evidence.mjs", "reader"]
	, ["tests/helpers/owned-dotnet-process-evidence.mjs", "reader"]
	, ["tests/helpers/owned-host-evidence.mjs", "reader"]
	, ["tests/helpers/owned-jvm-package-evidence.mjs", "reader"]
	, ["tests/helpers/owned-package-evidence.mjs", "reader"]
	, ["tests/helpers/owned-php-wasm-callback-result-evidence.mjs", "reader"]
	, ["tests/helpers/owned-php-wasm-packages.mjs", "test"]
	, ["tests/helpers/owned-perl-callback-result-variant-acceptance.mjs", "reader"]
	, ["tests/helpers/owned-php-callback-result-acceptance.mjs", "reader"]
	, ["tests/helpers/owned-php-receiver-package-evidence.mjs", "reader"]
	, ["tests/helpers/owned-php-wasm-borrow-evidence.mjs", "reader"]
	, ["tests/helpers/owned-python-evidence.mjs", "reader"]
	, ["tests/helpers/owned-rust-evidence.mjs", "reader"]
	, ["tests/helpers/post-perl-callback-staging-history.mjs", "reader"]
	, ["tests/helpers/wit-callback-installed-acceptance-history.mjs", "reader"]
	, ["tests/helpers/wit-callback-acceptance-history-tests.mjs", "reader"]
	, ["tests/helpers/wit-owned-projection-history.mjs", "reader"]
	, ["tests/helpers/wit-recursive-callable-evidence.mjs", "reader"]
	, ["tests/owned-analysis-evidence.test.mjs", "reader"]
	, ["tests/owned-javascript-coexistence-evidence.test.mjs", "reader"]
	, ["tests/owned-javascript-npm-evidence.test.mjs", "reader"]
	, ["tests/owned-javascript-wasm-evidence.test.mjs", "reader"]
	, ["tests/owned-jvm-receiver-gc-evidence.test.mjs", "reader"]
	, ["tests/owned-perl-package-evidence.test.mjs", "reader"]
	, ["tests/owned-php-callback-result-packaging.test.mjs", "reader"]
	, ["tests/owned-php-wasm-evidence.test.mjs", "reader"]
	, ["tests/owned-php-wasm-callback-result-evidence.test.mjs", "reader"]
	, ["tests/perl-contract-repair-evidence.test.mjs", "reader"]
	, ["tests/owned-php-wasm-callback-results.test.mjs", "test"]
	, ["tests/test-profiles.test.mjs", "test"]
	, ["tests/type-surface.test.mjs", "test"]
]);
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const at = (revision, path) => git(["show", `${revision}:${path}`]);

git(["merge-base", "--is-ancestor", phpWasmCallbackResultIntegration, "HEAD"]);
for(const [index, revision] of phpWasmCallbackResultLineage.entries())
	assert.equal(git(["rev-parse", `${revision}^`]).trim()
		, index ? phpWasmCallbackResultLineage[index - 1] : phpWasmCallbackResultBaseline);
assert.equal(sha256(await readFile(phpWasmCallbackResultPrevious.path)), phpWasmCallbackResultPrevious.sha256);
assert.equal(sha256(await readFile(phpWasmCallbackResultReceipt.path)), phpWasmCallbackResultReceipt.sha256);

const integrated = git(["diff", "--name-status", "--no-renames"
	, phpWasmCallbackResultBaseline, phpWasmCallbackResultIntegration])
	.trim().split("\n").filter(Boolean).map(line => line.split("\t"));
const expectedIntegration = [
	...phpWasmCallbackResultModifiedPaths.map(path => ["M", path])
	, ...phpWasmCallbackResultIntroducedPaths.map(path => ["A", path])
].sort((left, right) => left[1].localeCompare(right[1]));
assert.deepEqual(integrated.sort((left, right) => left[1].localeCompare(right[1])), expectedIntegration);

const local = git(["diff", "--name-status", "--no-renames", phpWasmCallbackResultIntegration])
	.trim().split("\n").filter(Boolean).map(line => line.split("\t"));
for(const [status, path] of local)
	assert.ok(status === "M" && phpWasmCallbackResultReaderPaths.includes(path)
		|| status === "A" && newPaths.has(path), `Unreviewed local edit: ${status} ${path}`);
for(const path of phpWasmCallbackResultReaderPaths)
	assert.ok(local.some(([, value]) => value === path), `Missing reader update: ${path}`);
for(const path of git(["ls-files", "--others", "--exclude-standard"]).trim().split("\n").filter(Boolean))
	assert.ok(newPaths.has(path) || userUntracked.has(path), `Unreviewed untracked source: ${path}`);

const baselineInventory = JSON.parse(at(phpWasmCallbackResultBaseline, inventoryPath));
const integrationInventory = JSON.parse(at(phpWasmCallbackResultIntegration, inventoryPath));
const currentInventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const currentFiles = new Map();
for(const evidence of currentInventory.evidence) for(const file of evidence.files)
	if(new Set([...phpWasmCallbackResultModifiedPaths, ...phpWasmCallbackResultReaderPaths]).has(file.path)
		&& file.path !== inventoryPath)
		currentFiles.set(file.path, sha256(await readFile(file.path)));
for(const evidence of currentInventory.evidence) for(const file of evidence.files)
	if(currentFiles.has(file.path)) file.sha256 = currentFiles.get(file.path);
const inventoryBytes = JSON.stringify(currentInventory, null, 2) + "\n";

const inventoryTransition = (current, previous) => {
	const working = structuredClone(current), edits = new Map();
	for(const [index, evidence] of working.evidence.entries())
		for(const [fileIndex, file] of evidence.files.entries())
		{
			const prior = previous.evidence[index].files[fileIndex];
			assert.equal(evidence.id, previous.evidence[index].id);
			assert.equal(file.path, prior.path);
			if(file.sha256 !== prior.sha256)
			{
				const key = `${file.path}\0${file.sha256}\0${prior.sha256}`;
				const edit = edits.get(key) ?? { path: file.path, current: file.sha256
					, previous: prior.sha256, count: 0 };
				edit.count++; edits.set(key, edit); file.sha256 = prior.sha256;
			}
		}
	assert.deepEqual(working, previous, "Inventory reader changed more than source hashes.");
	return [...edits.values()].sort((left, right) => left.path.localeCompare(right.path));
};
const readerInventoryEdits = inventoryTransition(currentInventory, integrationInventory);
const integrationInventoryTransition = (current, previous) => {
	const working = structuredClone(current), edits = new Map();
	const previousEvidence = new Map(previous.evidence.map(value => [value.id, value]));
	for(const evidence of working.evidence)
	{
		const prior = previousEvidence.get(evidence.id);
		if(prior === undefined) continue;
		assert.deepEqual(evidence.files.map(file => file.path), prior.files.map(file => file.path));
		for(const [index, file] of evidence.files.entries())
			if(file.sha256 !== prior.files[index].sha256)
			{
				const previousSha256 = prior.files[index].sha256;
				const key = `${file.path}\0${file.sha256}\0${previousSha256}`;
				const edit = edits.get(key) ?? { kind: "source-hash", path: file.path
					, current: file.sha256, previous: previousSha256, count: 0 };
				edit.count++; edits.set(key, edit); file.sha256 = previousSha256;
			}
	}
	const newEvidence = working.evidence.filter(value => !previousEvidence.has(value.id));
	const previousObservations = new Set(previous.observations.map(value => value.id));
	const newObservations = working.observations.filter(value => !previousObservations.has(value.id));
	working.evidence = working.evidence.filter(value => previousEvidence.has(value.id));
	working.observations = working.observations.filter(value => previousObservations.has(value.id));
	assert.deepEqual(working, previous, "Inventory integration changed beyond its recorded additions.");
	return [
		...[...edits.values()].sort((left, right) => left.path.localeCompare(right.path))
		, ...newEvidence.map(value => ({ kind: "evidence", id: value.id
			, currentSha256: sha256(canonicalJson(value)) }))
		, ...newObservations.map(value => ({ kind: "observation", id: value.id
			, currentSha256: sha256(canonicalJson(value)) }))
	];
};
const integrationInventoryEdits = integrationInventoryTransition(integrationInventory, baselineInventory);

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
const updates = phpWasmCallbackResultModifiedPaths.map(path => path === inventoryPath
	? { path, category: categories.get(path)
		, currentSha256: sha256(at(phpWasmCallbackResultIntegration, path))
		, previousSha256: sha256(at(phpWasmCallbackResultBaseline, path))
		, strategy: "inventory", edits: integrationInventoryEdits }
	: spanUpdate(path, at(phpWasmCallbackResultIntegration, path)
		, at(phpWasmCallbackResultBaseline, path)));
const readerUpdates = [];
for(const path of phpWasmCallbackResultReaderPaths)
	readerUpdates.push(path === inventoryPath
		? { path
			, category: categories.get(path), currentSha256: sha256(inventoryBytes)
			, previousSha256: sha256(at(phpWasmCallbackResultIntegration, path))
			, strategy: "source-hashes", edits: readerInventoryEdits }
		: spanUpdate(path, await readFile(path, "utf8"), at(phpWasmCallbackResultIntegration, path)));
const introducedSources = {};
for(const path of phpWasmCallbackResultIntroducedPaths)
	introducedSources[path] = { integrationSha256: sha256(at(phpWasmCallbackResultIntegration, path))
		, currentSha256: sha256(await readFile(path)) };
const record = { schemaVersion: 1
	, kind: "php-wasm-callback-result-acceptance-source-history"
	, baselineRevision: phpWasmCallbackResultBaseline
	, integrationRevision: phpWasmCallbackResultIntegration
	, lineage: phpWasmCallbackResultLineage
	, previous: phpWasmCallbackResultPrevious
	, completedReceipt: phpWasmCallbackResultReceipt
	, scope: { stage: "php-wasm-callback-result-acceptance"
		, acceptanceReceipt: true, compiledLean: true
		, installedNpm: true, installedComposer: true
		, nodeExecution: true, chromiumExecution: true
		, ciRequired: true, documentationPublished: true
		, producerRerun: true, registryPublication: false, supportPromotions: 4 }
	, updates, readerUpdates, introducedSources };
assertPhpWasmCallbackResultHistory(record);
const bytes = JSON.stringify(record, null, 2) + "\n", helper = await readFile(helperPath, "utf8");
const pattern = /export const phpWasmCallbackResultHistorySha256 = "(?:PENDING|[a-f0-9]{64})";/gu;
assert.equal([...helper.matchAll(pattern)].length, 1);
await writeFile(inventoryPath, inventoryBytes);
await writeFile(phpWasmCallbackResultHistoryPath, bytes);
await writeFile(helperPath, helper.replace(pattern
	, `export const phpWasmCallbackResultHistorySha256 = "${sha256(bytes)}";`));
process.stdout.write(`Recorded ${updates.length} integration updates, ${readerUpdates.length} reader updates, ${Object.keys(introducedSources).length} introduced sources, ${integrationInventoryEdits.length} integration inventory edits and ${readerInventoryEdits.length} reader identity edits.\n`);
