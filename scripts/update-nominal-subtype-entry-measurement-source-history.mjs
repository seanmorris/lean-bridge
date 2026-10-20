/**
 * Record the entry-measurement transition and advance only its two stale current-source pointers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nominalSubtypeEntryMeasurementChangedPaths, nominalSubtypeEntryMeasurementHistoryPath, nominalSubtypeEntryMeasurementImplementation, nominalSubtypeEntryMeasurementPredecessor, reverseNominalSubtypeEntryMeasurementUpdate } from "../tests/helpers/nominal-subtype-entry-measurement-source-history.mjs";

const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), nominalSubtypeEntryMeasurementImplementation
	, "Entry measurement history is draft-only at its exact implementation commit");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--", nominalSubtypeEntryMeasurementHistoryPath]).trim()
	, "Never rewrite committed entry measurement history");

const addedPaths = [
	".github/workflows/nominal-subtype-entry-browser.yml"
	, ".github/workflows/nominal-subtype-entry-native.yml"
	, "scripts/check-nominal-subtype-entry-browser-ci.mjs"
	, "scripts/check-nominal-subtype-entry-native-ci.mjs"
	, "scripts/run-nominal-subtype-entry-browser-ci.sh"
	, "scripts/run-nominal-subtype-entry-native-ci.sh"
	, "scripts/update-nominal-subtype-entry-measurement-source-history.mjs"
	, "tests/helpers/nominal-subtype-entry-browser-ci-report.mjs"
	, "tests/helpers/nominal-subtype-entry-browser-ci-tests.mjs"
	, "tests/helpers/nominal-subtype-entry-measurement-source-history.mjs"
	, "tests/helpers/nominal-subtype-entry-measurement-source-history-tests.mjs"
	, "tests/helpers/nominal-subtype-entry-native-ci-report.mjs"
	, "tests/helpers/nominal-subtype-entry-native-ci-tests.mjs"
];

const directory = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-entry-history-"));
const transition = async path => {
	const previous = git(["show", `${nominalSubtypeEntryMeasurementPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	const previousPath = join(directory, "previous"), currentPath = join(directory, "current");
	await writeFile(previousPath, previous); await writeFile(currentPath, current);
	let diff;
	try
	{ diff = git(["diff", "--histogram", "--no-index", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", previousPath, currentPath]); }
	catch(error)
	{ if(error.status !== 1 || typeof error.stdout !== "string") throw error; diff = error.stdout; }
	const currentLines = current.split(/(?<=\n)/u), previousLines = previous.split(/(?<=\n)/u);
	const edits = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu)].map(match => {
		const previousCount = Number(match[2] ?? 1), currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return { start: currentLines.slice(0, currentStart).join("").length
			, previous: previousLines.slice(previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart, currentStart + currentCount).join("") };
	});
	const update = { path, previousSha256: sha256(previous), currentSha256: sha256(current), edits };
	assert.equal(reverseNominalSubtypeEntryMeasurementUpdate(current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of nominalSubtypeEntryMeasurementChangedPaths) updates.push(await transition(path));
	const additions = [];
	for(const path of addedPaths)
	{
		assert.ok(!git(["ls-tree", "--name-only", nominalSubtypeEntryMeasurementPredecessor, "--", path]).trim(), path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const byPath = new Map(updates.map(item => [item.path, item]));
	const pins = [
		{ containerPath: "docs/evidence/core-first-run-residual-repair-source-history-20261019.json"
			, sourcePath: "tests/helpers/component-nominal-subtype-tests.mjs" }
		, { containerPath: "docs/evidence/checked-record-value-index-matrix-evidence-pin-repair-source-history-20261020.json"
			, sourcePath: "tests/helpers/fin-refinement-source-history.mjs" }
	];
	const pinUpdates = [];
	for(const pin of pins)
	{
		const update = byPath.get(pin.sourcePath); assert.ok(update);
		const previous = await readFile(pin.containerPath, "utf8");
		const count = previous.split(update.previousSha256).length - 1; assert.equal(count, 1, pin.containerPath);
		const current = previous.replaceAll(update.previousSha256, update.currentSha256);
		pinUpdates.push({ ...pin
			, previousSha256: update.previousSha256
			, currentSha256: update.currentSha256, count
			, containerPreviousSha256: sha256(previous)
			, containerCurrentSha256: sha256(current) });
		await writeFile(pin.containerPath, current);
	}
	const milestone = "nominal-subtype-entry-measurement-source-v1";
	const record = { schemaVersion: 1, milestone
		, predecessorCommit: nominalSubtypeEntryMeasurementPredecessor
		, implementationCommit: nominalSubtypeEntryMeasurementImplementation
		, updates, additions, pinUpdates };
	await writeFile(nominalSubtypeEntryMeasurementHistoryPath, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, ${additions.length} additions and ${pinUpdates.length} repaired pins.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
