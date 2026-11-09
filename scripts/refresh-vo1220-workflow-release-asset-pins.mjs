#!/usr/bin/env node
/**
 * Refresh only live source identities changed by the complete workflow
 * release-asset failover. Support observations and archives stay unchanged.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import {
	auditCurrentSourcePins, previewCurrentSourcePinRefresh
} from "../tests/helpers/current-source-pin-preflight.mjs";
import { reconcileDependentCheckedRecordSourcePins }
	from "../tests/helpers/dependent-checked-record-promotion.mjs";

const implementation = "228cd1d226dd0ff8a6b615cb2da41fb6f7890910";
const inventoryPath = "docs/type-surface.v1.json";
const expectedPaths = Object.freeze([
	".github/workflows/callback-checked-record-remaining.yml"
	, ".github/workflows/checked-record-value-index-jvm.yml"
	, ".github/workflows/checked-record-value-index-wit.yml"
	, ".github/workflows/consumer-matrix.yml"
	, ".github/workflows/inherited-checked-record-jvm.yml"
	, ".github/workflows/inherited-checked-record-wit.yml"
	, ".github/workflows/nested-checked-record-jvm.yml"
	, ".github/workflows/nested-checked-record-wit.yml"
	, ".github/workflows/nominal-primitive-subtype-jvm.yml"
	, ".github/workflows/nominal-primitive-subtype-wit.yml"
	, ".github/workflows/recursive-checked-record-wit.yml"
	, ".github/workflows/zero-payload-checked-record-jvm.yml"
	, ".github/workflows/zero-payload-checked-record-wit.yml"
	, "tests/helpers/nested-checked-record-jvm-ci-workflow-tests.mjs"
	, "tests/helpers/nested-checked-record-jvm-ci-workflow.mjs"
	, "tests/helpers/nested-checked-record-wit-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-jvm-ci-workflow.mjs"
	, "tests/multi-profile-project.test.mjs"
]);
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});

assert.deepEqual(process.argv.slice(2), []
	, "Usage: refresh-vo1220-workflow-release-asset-pins.mjs");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Workflow release-asset pins require the exact sealed implementation");
assert.doesNotThrow(() => execFileSync("git"
	, ["diff", "--cached", "--quiet", "HEAD", "--"]));
assert.equal(git(["status", "--short", "--", inventoryPath]).trim(), ""
	, "Type-surface pins have already been edited");

const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const report = await auditCurrentSourcePins(inventory);
assert.deepEqual(report.findings.map(finding => finding.path), expectedPaths);
assert.ok(report.findings.every(finding => finding.kind === "stale"));
const preview = previewCurrentSourcePinRefresh(inventory, report);
assert.deepEqual(preview, { paths: 18, refreshed: 271 });
const currentDigests = new Map(report.findings.map(finding => {
	assert.match(finding.actualSha256, /^[0-9a-f]{64}$/u);
	return [finding.path, finding.actualSha256];
}));
const reconciled = reconcileDependentCheckedRecordSourcePins(
	inventory, currentDigests);
assert.equal(reconciled.refreshed, 271);
await writeFile(inventoryPath
	, JSON.stringify(reconciled.inventory, null, 2) + "\n");
process.stdout.write("Refreshed 271 exact pins across 18 current sources.\n");
