#!/usr/bin/env node
/**
 * Record recursive checked-record WIT test registrations and refresh only
 * their current-source inventory pins. Older evidence stays byte-identical.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";

const predecessor = "35f930b30c7c0e1c9ac458cab5ec9743b66bd5ef";
const historyPath
	= "docs/evidence/recursive-wit-test-registration-source-history-20261017.json";
const inventoryPath = "docs/type-surface.v1.json";
const profilePath = "src/adoption/test-profiles.mjs";
const hubPath = "tests/helpers/fin-refinement-source-history.mjs";
const componentHistoryPath
	= "tests/helpers/component-refinement-mirror-history.mjs";
const browserCallbackHistoryTestPath
	= "tests/helpers/browser-callback-archive-source-history-tests.mjs";
const jvmPendingExitHistoryTestPath
	= "tests/helpers/jvm-pending-exit-history-tests.mjs";
const subtypeFixtureHistoryTestPath
	= "tests/helpers/subtype-fixture-link-source-history-tests.mjs";
const lateRegistrationTestPath
	= "tests/late-checked-record-test-registration-history.test.mjs";
const repairedHistoryTestPaths = [
	"tests/helpers/checked-record-browser-archive-history-tests.mjs"
	, "tests/helpers/checked-record-browser-ci-history-tests.mjs"
	, "tests/helpers/checked-record-php-wasm-archive-history-tests.mjs"
	, "tests/helpers/checked-record-php-wasm-ci-history-tests.mjs"
	, "tests/helpers/checked-record-php-wasm-history-tests.mjs"
	, "tests/helpers/jvm-container-entry-exit-history-tests.mjs"
	, "tests/helpers/native-fin-nix-comparison-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-python-registration-history-tests.mjs"
	, "tests/helpers/nominal-subtype-dotnet-ci-history-tests.mjs"
	, "tests/helpers/nominal-subtype-perl-registration-history-tests.mjs"
	, "tests/helpers/nominal-subtype-python-archive-history-tests.mjs"
	, "tests/helpers/nominal-subtype-python-registration-history-tests.mjs"
	, "tests/helpers/nominal-subtype-ruby-archive-history-tests.mjs"
	, "tests/helpers/nominal-subtype-ruby-registration-history-tests.mjs"
	, "tests/helpers/nominal-subtype-rust-archive-history-tests.mjs"
	, "tests/helpers/nominal-subtype-rust-registration-history-tests.mjs"
	, "tests/helpers/perl-container-subtype-ci-history-tests.mjs"
	, "tests/helpers/php-wasm-failure-diagnostics-history-tests.mjs"
];
const replayedHistoryTestPaths = [
	"tests/helpers/checked-record-host-ci-history-tests.mjs"
	, "tests/helpers/checked-record-native-host-history-tests.mjs"
	, "tests/helpers/checked-record-native-installed-history-tests.mjs"
	, "tests/helpers/checked-record-perl-ci-history-tests.mjs"
	, "tests/helpers/checked-record-perl-history-tests.mjs"
	, "tests/helpers/checked-record-perl-installed-history-tests.mjs"
	, "tests/helpers/checked-record-python-history-tests.mjs"
	, "tests/helpers/checked-record-remaining-hosts-history-tests.mjs"
	, "tests/helpers/checked-record-ruby-jvm-history-tests.mjs"
	, "tests/helpers/core-quality-budget-history-tests.mjs"
	, "tests/helpers/fin-alias-closure-history-tests.mjs"
	, "tests/helpers/fin-container-edge-ci-history-tests.mjs"
	, "tests/helpers/fin-container-foreign-history-tests.mjs"
	, "tests/helpers/fin-dotnet-sdk-history-tests.mjs"
	, "tests/helpers/fin-jvm-diagnostics-history-tests.mjs"
	, "tests/helpers/fin-nominal-refusal-history-tests.mjs"
	, "tests/helpers/fin-record-review-omission-history-tests.mjs"
	, "tests/helpers/fin-record-zero-ci-history-tests.mjs"
	, "tests/helpers/maven-prerequisite-history-tests.mjs"
	, "tests/helpers/native-fin-diagnostic-source-history-tests.mjs"
	, "tests/helpers/nominal-subtype-browser-registration-history-tests.mjs"
	, "tests/helpers/nominal-subtype-jvm-ci-history-tests.mjs"
	, "tests/helpers/nominal-subtype-php-ci-history-tests.mjs"
	, "tests/helpers/nominal-subtype-wit-ci-history-tests.mjs"
	, "tests/helpers/refinement-core-ci-history-tests.mjs"
	, "tests/helpers/refinement-followup-history-tests.mjs"
	, "tests/helpers/reviewed-perl-diagnostic-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-browser-ci-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-browser-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-host-ci-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-host-ci-report-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-host-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-package-ci-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-package-record-history-tests.mjs"
	, "tests/helpers/structural-subtype-ci-foundation-history-tests.mjs"
];
const sourcePaths = [profilePath, hubPath, componentHistoryPath
	, browserCallbackHistoryTestPath, ...repairedHistoryTestPaths
	, ...replayedHistoryTestPaths
	, jvmPendingExitHistoryTestPath
	, subtypeFixtureHistoryTestPath, lateRegistrationTestPath];
const paths = [inventoryPath, ...sourcePaths];
const addedTests = [
	"recursive-checked-record-wit-ci"
	, "recursive-checked-record-wit"
	, "recursive-wit-test-registration-history"
];
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});

assert.equal(git(["rev-parse", "HEAD"]).trim(), predecessor
	, "WIT registration history must stay on its exact predecessor");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--", historyPath]).trim(), ""
	, "Never rewrite a committed WIT registration ledger");
await assert.rejects(readFile(historyPath), { code: "ENOENT" });

const sources = new Map();
for(const path of sourcePaths) sources.set(path, {
	previous: git(["show", `${predecessor}:${path}`])
	, current: await readFile(path, "utf8")
});
for(const [path, source] of sources)
	assert.notEqual(source.current, source.previous, path);
for(const name of addedTests)
	assert.equal(sources.get(profilePath).current.split(`\t\t, "${name}"\n`).length
		, 2, name);

const inventoryPrevious = git(["show", `${predecessor}:${inventoryPath}`]);
const inventory = JSON.parse(inventoryPrevious);
const pinUpdates = [];
let pinCount = 0;
for(const [path, source] of sources)
{
	const previousSha256 = sha256(source.previous);
	const currentSha256 = sha256(source.current);
	let count = 0;
	for(const entry of inventory.evidence) for(const file of entry.files)
		if(file.path === path && file.sha256 === previousSha256)
		{
			file.sha256 = currentSha256;
			count++;
		}
	if(count > 0)
	{
		pinCount += count;
		pinUpdates.push({ path, previousSha256, currentSha256, count });
	}
}
const inventoryCurrent = JSON.stringify(inventory, null, 2) + "\n";
sources.set(inventoryPath, {
	previous: inventoryPrevious, current: inventoryCurrent
});

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-recursive-wit-test-registration-"
));
try
{
	const edits = async (previous, current) => {
		const previousPath = join(directory, "previous");
		const currentPath = join(directory, "current");
		await writeFile(previousPath, previous);
		await writeFile(currentPath, current);
		let diff;
		try
		{
			diff = execFileSync("diff", ["--speed-large-files", "--unified=0"
				, previousPath, currentPath]
			, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
		}
		catch(error)
		{
			if(error.status !== 1 || typeof error.stdout !== "string") throw error;
			diff = error.stdout;
		}
		const previousLines = previous.split(/(?<=\n)/u);
		const currentLines = current.split(/(?<=\n)/u);
		const result = [...diff.matchAll(
			/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
		)].map(match => {
			const previousCount = Number(match[2] ?? 1);
			const currentCount = Number(match[4] ?? 1);
			const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
			const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
			return {
				start: currentLines.slice(0, currentStart).join("").length
				, previous: previousLines.slice(previousStart
					, previousStart + previousCount).join("")
				, current: currentLines.slice(currentStart
					, currentStart + currentCount).join("")
			};
		});
		assert.ok(result.length > 0);
		return result;
	};
	const updates = [];
	for(const path of paths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
		};
		if(path === inventoryPath) update.replacements = pinUpdates.map(pin => ({
			previous: pin.previousSha256, current: pin.currentSha256
			, count: pin.count
		}));
		else update.edits = await edits(source.previous, source.current);
		if(path === profilePath) update.addedTests = addedTests;
		updates.push(update);
	}
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "recursive-wit-test-registration-source-v1"
		, predecessorCommit: predecessor, pinCount, pinUpdates, updates
	}, null, 2) + "\n";
	await writeFile(inventoryPath, inventoryCurrent);
	await writeFile(historyPath, record, { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} transitions and refreshed ${pinCount} pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
