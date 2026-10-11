/**
 * Refuse missing browser contexts, weakened corpora and incomplete lifecycle observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { saveLakeFile } from "./lake-workspace.mjs";
import { structuralSubtypeBrowserExpected, structuralSubtypeBrowserPackage, structuralSubtypeBrowserPhases, structuralSubtypeBrowserProfiles, validateStructuralSubtypeBrowserObservation, validateStructuralSubtypeBrowserPhases } from "./structural-subtype-browser-fixture.mjs";

const engines = ["chromium", "firefox", "webkit"];
const result = profile => ({ schemaVersion: 1, profile
	, module: "structuralsubtypes"
	, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
	, results: { module: "structuralsubtypes", ...structuralSubtypeBrowserExpected }
	, hostVersion: "test-only-version" });
const phases = profile => engines.flatMap(engine => (profile === "browser-react" ? ["production", "strict"] : ["production"])
	.flatMap(variant => structuralSubtypeBrowserPhases(profile).map(phase => ({ engine, variant, phase, observation: result(profile) }))));

test("structural browser observations require the entire original corpus in the requested execution realm", () => {
	assert.deepEqual(structuralSubtypeBrowserExpected, { checks: 3028, rejections: 1020 });
	assert.deepEqual(structuralSubtypeBrowserProfiles, ["browser-javascript", "browser-react", "browser-worker"]);
	for(const profile of structuralSubtypeBrowserProfiles)
	{
		validateStructuralSubtypeBrowserObservation(result(profile), profile);
		for(const mutate of [value => { value.results.checks--; }
			, value => { value.results.rejections--; }
			, value => { value.realm = "wrong-realm"; }
			, value => { value.hostVersion = ""; }
			, value => { value.module = "ordinary-package"; }
			, value => { value.results.module = "ordinary-package"; }
			, value => { value.profile = "node-javascript"; }
			, value => { value.synthesized = true; }]) {
			const changed = result(profile); mutate(changed);
			assert.throws(() => validateStructuralSubtypeBrowserObservation(changed, profile));
			}
	}
	assert.throws(() => validateStructuralSubtypeBrowserObservation(result("browser-worker"), "unknown"));
});

test("structural browser phases require all twelve engine variants and all fifty-one lifecycle results", () => {
	assert.equal(structuralSubtypeBrowserProfiles.flatMap(phases).length, 51);
	for(const profile of structuralSubtypeBrowserProfiles)
	{
		const original = phases(profile); validateStructuralSubtypeBrowserPhases(original, profile, engines);
		for(const altered of [original.slice(1), original.slice(0, -1), [...original, original[0]], original.filter(item => item.variant !== "strict")])
			if(altered.length !== original.length) assert.throws(() => validateStructuralSubtypeBrowserPhases(altered, profile, engines));
		for(const index of original.keys())
		{
			const changed = structuredClone(original); changed[index].observation.results.checks = 0;
			assert.throws(() => validateStructuralSubtypeBrowserPhases(changed, profile, engines));
		}
		for(const selection of [[], ["unknown"], ["chromium", "chromium"], ["chromium"]])
			assert.throws(() => validateStructuralSubtypeBrowserPhases(original, profile, selection));
	}
});

test("the copied browser wrapper delegates to the structural corpus instead of manufacturing observations", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-browser-wrapper-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	await saveLakeFile(directory, "javascript.mjs", await readFile("tests/fixtures/structural-subtype-consumers/browser.mjs"));
	await saveLakeFile(directory, "check.mjs", await readFile("tests/fixtures/structural-subtype-consumers/javascript.mjs"));
	const { executeCorpus } = await import(pathToFileURL(join(directory, "javascript.mjs")).href);
	assert.throws(() => executeCorpus({ module: "other" }, {}), /Wrong structural Subtype package/u);
	assert.throws(() => executeCorpus({ module: "structuralsubtypes" }, new Proxy({}, { get: () => () => { throw new Error("actual public call"); } })), /actual public call/u);
	assert.ok(structuralSubtypeBrowserPackage.includes('import("structuralsubtypes")'));
	assert.doesNotMatch(structuralSubtypeBrowserPackage, /runtime\.call|raw:/u);
});

test("structural browsers run only after both source-free builds and relocated strict TypeScript finish", async () => {
	const source = await readFile("tests/structural-subtype-npm-installed.test.mjs", "utf8");
	const call = source.lastIndexOf("await checkStructuralSubtypeBrowsers(");
	assert.ok(call > source.indexOf('await rm(author, { recursive: true })'));
	assert.ok(call > source.indexOf('"--skipLibCheck", "false"'));
	assert.ok(call > source.indexOf('await saveLakeFile(output, "report.json"'));
	assert.ok(source.includes('if(browsers) await checkStructuralSubtypeBrowsers('));
	assert.ok(source.includes('if(browsers) assert.ok(enabled'));
});
