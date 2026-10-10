/**
 * Authenticate the original reviewed browser run and its complete lifecycle observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertReviewedSubtypeNpmRecords } from "./reviewed-subtype-npm-report.mjs";
import { assertReviewedSubtypePackageTap } from "./reviewed-subtype-package-ci-common.mjs";
import { reviewedSubtypeBrowserProfiles, validateReviewedSubtypeBrowserPhases } from "./reviewed-subtype-browser-fixture.mjs";

const root = "docs/evidence/reviewed-subtype-browser-runs-20261010";
const revision = "f07c86d23f75b9b07ae66f6e9c7101c47b29b58e";
const digest = "f2992a5696da474d6dce426c4b6c4aaee5d6eb5f0f989723e9a68a77a0cc5b7a";
const read = path => readFile(join(root, path));
const json = async path => JSON.parse(await read(path));
const identity = (bytes, record) => {
	assert.equal(bytes.length, record.bytes, record.path);
	assert.equal(sha256(bytes), record.sha256, record.path);
};

test("reviewed browser archive authenticates all original records and rejects changed bytes", async () => {
	const indexBytes = await read("index.json"), index = JSON.parse(indexBytes);
	assert.equal(sha256(indexBytes), digest); assert.equal(index.revision, revision);
	assert.equal(index.artifacts.length, 114); assert.equal(index.sources.length, 27);
	assert.equal(new Set(index.artifacts.map(item => item.path)).size, 114);
	for(const artifact of index.artifacts)
	{
		const bytes = await read(artifact.path); identity(bytes, artifact);
		assert.throws(() => identity(Buffer.concat([bytes, Buffer.from("\n")]), artifact));
		if(bytes.length)
		{
			const changed = Buffer.from(bytes); changed[Math.floor(changed.length / 2)] ^= 1;
			assert.throws(() => identity(changed, artifact));
		}
	}
	for(const source of index.sources)
	{
		assert.equal(source.revision, revision);
		assert.equal(sha256(await read(source.archive)), source.sha256);
		assert.equal(index.artifacts.find(item => item.path === source.archive).original, "git:" + revision + ":" + source.path);
	}
	assert.deepEqual(index.scope, {
		sourcePath: "reviewed-source", independentBuilds: 2
		, npmChecks: 2036, npmRejections: 2024
		, profiles: reviewedSubtypeBrowserProfiles
		, engines: ["chromium", "firefox", "webkit"]
		, executions: 12, lifecycleObservations: 51, dispatch: "not measured"
		, hostedCi: false, lockedNix: false, packageBinariesRetained: false
		, completeToolchainClosure: false, relocatedReplay: false });
});

test("reviewed browser archive retains two installed builds and all twelve engine variants", async () => {
	const npm = await assertReviewedSubtypeNpmRecords(read), report = await json("browser.json");
	assert.deepEqual(report.requestedEngines, ["chromium", "firefox", "webkit"]);
	assert.deepEqual(report.reports.map(item => item.profile), reviewedSubtypeBrowserProfiles);
	assert.equal(report.reports.flatMap(item => item.browser.executions).length, 12);
	assert.equal(report.reports.flatMap(item => item.observations).length, 51);
	for(const item of report.reports)
	{
		assert.deepEqual(item, await json(item.profile + "/report.json"));
		assert.deepEqual(item.observations, await json(item.profile + "/observations.json"));
		validateReviewedSubtypeBrowserPhases(item.observations, item.profile, report.requestedEngines);
		for(const key of ["bindingIrSha256", "receiptSha256", "corpusSha256"]) assert.equal(item[key], npm[key]);
	}
	assertReviewedSubtypePackageTap("npm", (await read("run.tap")).toString());
	const start = await json("run.start.json"), end = await json("run.end.json"), finished = await json("run.finished.json");
	assert.equal(start.revision, revision); assert.equal(start.runnerSha256, sha256(await read("runner.mjs.txt")));
	assert.equal(end.code, 0); assert.equal(end.signal, null); assert.equal(end.stoppedForDisk, false);
	assert.ok(start.initialFreeMiB >= 2048); assert.ok(end.minimumFreeMiB >= 768);
	assert.equal(end.tapSha256, sha256(await read("run.tap")));
	assert.equal(finished.browserReportSha256, sha256(await read("browser.json")));
	assert.equal(finished.reportSha256, sha256(await read("report.json")));
	assert.deepEqual(await json("mutation-check.json"), { records: 75, rejectedMutations: 151, originalAccepted: true });
});
