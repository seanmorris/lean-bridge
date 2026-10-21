/**
 * Installed generic Subtype compositions in Node, TypeScript, pages, React and workers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { assertGenericSubtypeIr, assertGenericSubtypeReportControls
	, checkGenericSubtypeRoute, genericSubtypeExpected
	, validateGenericSubtypeEvidence } from "./helpers/generic-subtype-npm-browser.mjs";
import { nominalSubtypeInstalledConfiguration, nominalSubtypeInstalledReview } from "./helpers/nominal-subtype-installed-fixture.mjs";
import "./helpers/generic-subtype-npm-browser-ci-tests.mjs";

const flag = "LEAN_BRIDGE_GENERIC_SUBTYPE_NPM_BROWSER_TEST";
assert.ok(process.env[flag] === undefined || ["0", "1"].includes(process.env[flag]), `Invalid ${flag}`);
const enabled = process.env[flag] === "1";

test("the generic Subtype package contract keeps exact constructor and specialization identities", () => {
	const options = { genericCompositions: true };
	for(const route of ["ordinary", "reviewed"])
	{
		const configuration = nominalSubtypeInstalledConfiguration(route, ["npm"], false, options);
		const expected = nominalSubtypeInstalledReview(false, options);
		assertGenericSubtypeIr(expected);
		assert.equal(expected.declarations.length, 29);
		assert.equal(configuration.modules.length, 2);
		assert.equal(route === "ordinary" ? configuration.specializations.length : 0, route === "ordinary" ? 2 : 0);
	}
	assert.deepEqual(genericSubtypeExpected, { checks: 611, rejections: 5 });
});

test("selected generic Subtype packages reproduce, relocate and run in every browser context", { skip: !enabled, timeout: 7_200_000 }, async t => {
	assert.equal(process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS, "chromium,firefox,webkit");
	const selected = process.env.LEAN_BRIDGE_GENERIC_SUBTYPE_ROUTES?.split(",") ?? ["ordinary", "reviewed"];
	assert.ok(selected.length && selected.every(route => ["ordinary", "reviewed"].includes(route)));
	assert.equal(new Set(selected).size, selected.length);
	const output = resolve(process.env.LEAN_BRIDGE_GENERIC_SUBTYPE_NPM_BROWSER_OUTPUT ?? "build/generic-subtype-npm-browser/report.json");
	await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(dirname(output), { recursive: true });
	const engineRoot = process.cwd(), runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
	const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix", LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot };
	const observations = [];
	for(const route of selected)
	{
		t.diagnostic(`generic Subtype ${route} package`);
		observations.push(await checkGenericSubtypeRoute(t, { route, engineRoot, environment, runtimeRoot }));
	}
	assert.deepEqual(observations.map(item => item.route), selected);
	const report = { schemaVersion: 1, kind: "generic-subtype-npm-browser-installed-v1", observations };
	validateGenericSubtypeEvidence(report, selected);
	for(const item of observations) assert.equal(assertGenericSubtypeReportControls(item), 21);
	await saveLakeFile(dirname(output), output.split("/").at(-1), canonicalJson(report));
	const retained = JSON.parse(await readFile(output, "utf8"));
	assert.deepEqual(retained, report);
	validateGenericSubtypeEvidence(retained, selected);
});
