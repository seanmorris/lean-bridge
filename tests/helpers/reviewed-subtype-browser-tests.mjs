/**
 * Refuse missing browser contexts, weakened corpora and incomplete lifecycle observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import "./reviewed-subtype-browser-history-tests.mjs";
import "./reviewed-subtype-browser-archive-tests.mjs";
import { reviewedSubtypeBrowserExpected, reviewedSubtypeBrowserPackage, reviewedSubtypeBrowserPhases, reviewedSubtypeBrowserProfiles, validateReviewedSubtypeBrowserObservation, validateReviewedSubtypeBrowserPhases } from "./reviewed-subtype-browser-fixture.mjs";

const engines = ["chromium", "firefox", "webkit"];
const result = profile => ({ schemaVersion: 1, profile, module: "subtypes"
	, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
	, results: { module: "subtypes", ...reviewedSubtypeBrowserExpected }
	, hostVersion: "test-only-version" });
const phases = profile => engines.flatMap(engine => (profile === "browser-react" ? ["production", "strict"] : ["production"])
	.flatMap(variant => reviewedSubtypeBrowserPhases(profile).map(phase => ({ engine, variant, phase, observation: result(profile) }))));

test("reviewed browser observations require the entire original corpus in the requested execution realm", () => {
	assert.deepEqual(reviewedSubtypeBrowserExpected, { checks: 2036, rejections: 2024 });
	assert.deepEqual(reviewedSubtypeBrowserProfiles, ["browser-javascript", "browser-react", "browser-worker"]);
	for(const profile of reviewedSubtypeBrowserProfiles)
	{
		validateReviewedSubtypeBrowserObservation(result(profile), profile);
		for(const mutate of [value => { value.results.checks--; }
			, value => { value.results.rejections--; }
			, value => { value.realm = "wrong-realm"; }
			, value => { value.hostVersion = ""; }
			, value => { value.module = "ordinary-package"; }
			, value => { value.results.module = "ordinary-package"; }
			, value => { value.profile = "node-javascript"; }
			, value => { value.synthesized = true; }]) {
			const changed = result(profile); mutate(changed);
			assert.throws(() => validateReviewedSubtypeBrowserObservation(changed, profile));
			}
	}
	assert.throws(() => validateReviewedSubtypeBrowserObservation(result("browser-worker"), "unknown"));
});

test("reviewed browser phases require all twelve engine variants and all fifty-one lifecycle results", () => {
	assert.equal(reviewedSubtypeBrowserProfiles.flatMap(phases).length, 51);
	for(const profile of reviewedSubtypeBrowserProfiles)
	{
		const original = phases(profile); validateReviewedSubtypeBrowserPhases(original, profile, engines);
		for(const altered of [original.slice(1), original.slice(0, -1), [...original, original[0]], original.filter(item => item.variant !== "strict")])
			if(altered.length !== original.length) assert.throws(() => validateReviewedSubtypeBrowserPhases(altered, profile, engines));
		for(const index of original.keys())
		{
			const changed = structuredClone(original); changed[index].observation.results.checks = 0;
			assert.throws(() => validateReviewedSubtypeBrowserPhases(changed, profile, engines));
		}
		for(const selection of [[], ["unknown"], ["chromium", "chromium"], ["chromium"]])
			assert.throws(() => validateReviewedSubtypeBrowserPhases(original, profile, selection));
	}
});

test("the copied browser wrapper delegates to the unchanged reviewed corpus instead of manufacturing observations", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-browser-wrapper-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	await writeFile(join(directory, "javascript.mjs"), await readFile("tests/fixtures/reviewed-subtype-consumers/browser.mjs"));
	await writeFile(join(directory, "check.mjs"), await readFile("tests/fixtures/reviewed-subtype-consumers/javascript.mjs"));
	const { executeCorpus } = await import(pathToFileURL(join(directory, "javascript.mjs")).href);
	assert.throws(() => executeCorpus({ module: "other" }, {}), /Wrong reviewed Subtype package/u);
	assert.throws(() => executeCorpus({ module: "subtypes" }, new Proxy({}, { get: () => () => { throw new Error("actual public call"); } })), /actual public call/u);
	assert.ok(reviewedSubtypeBrowserPackage.includes('runtime.call("lean:Subtypes." + name, args)'));
	assert.ok(reviewedSubtypeBrowserPackage.includes('import("./node_modules/subtypes/internal/runtime.mjs")'));
});

test("reviewed browsers run only after both source-free npm builds and strict TypeScript finish", async () => {
	const source = await readFile("tests/helpers/reviewed-subtype-npm-tests.mjs", "utf8");
	const call = source.lastIndexOf("await checkReviewedSubtypeBrowsers({ directory, handoff, receipt, records });");
	assert.ok(call > source.indexOf('assert.rejects(lstat(producers), { code: "ENOENT" })'));
	assert.ok(call > source.indexOf('"--skipLibCheck", "false"'));
	assert.ok(call > source.indexOf('if(reportPath !== join(records, "report.json"))'));
	assert.ok(source.includes('if(process.env.LEAN_BRIDGE_REVIEWED_SUBTYPE_BROWSER_TEST === "1")'));
});
