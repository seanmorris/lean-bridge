/**
 * Source-free browser acceptance for retained mutual checked-record packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { checkMutualCheckedRecordBrowsers } from "./helpers/mutual-checked-record-browser.mjs";
import {
	mutualCheckedRecordBrowserEngines, mutualCheckedRecordBrowserPhases
	, mutualCheckedRecordBrowserProfiles, validateMutualCheckedRecordBrowserObservation
	, validateMutualCheckedRecordBrowserPhases
} from "./helpers/mutual-checked-record-browser-fixture.mjs";
import {
	mutualCheckedRecordNpmExpected, mutualCheckedRecordNpmRoutes
} from "./helpers/mutual-checked-record-npm-fixture.mjs";
import { corpusBrowserSelection } from "./helpers/type-corpus.mjs";

const flag = "LEAN_BRIDGE_MUTUAL_CHECKED_RECORD_BROWSER_TEST";
const enabled = process.env[flag] === "1";
if(process.env[flag] !== undefined)
	assert.ok(["0", "1"].includes(process.env[flag]), `Invalid ${flag}`);
const routeVariable = "LEAN_BRIDGE_MUTUAL_CHECKED_RECORD_BROWSER_ROUTES";
const routes = process.env[routeVariable]?.split(",") ?? [...mutualCheckedRecordNpmRoutes];
assert.ok(routes.length && new Set(routes).size === routes.length
	&& routes.every(route => mutualCheckedRecordNpmRoutes.includes(route)));
if(process.env[routeVariable] !== undefined)
	assert.ok(enabled, "Explicit mutual checked-record routes require the browser gate");
if(enabled) assert.deepEqual(corpusBrowserSelection(
	process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS), mutualCheckedRecordBrowserEngines);

const expectedObservation = (profile, route) => ({
	schemaVersion: 1, profile, module: "mutualcheckedrecords"
	, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
	, results: { module: "mutualcheckedrecords", route
		, ...mutualCheckedRecordNpmExpected(route) }
	, hostVersion: "fixture-browser"
});

test("mutual checked-record browser observations close every route and lifecycle", () => {
	for(const route of mutualCheckedRecordNpmRoutes)
	{
		for(const profile of mutualCheckedRecordBrowserProfiles)
		{
			const value = expectedObservation(profile, route);
			validateMutualCheckedRecordBrowserObservation(value, profile, route);
			const variants = profile === "browser-react" ? ["production", "strict"] : ["production"];
			const observations = mutualCheckedRecordBrowserEngines.flatMap(engine =>
				variants.flatMap(variant => mutualCheckedRecordBrowserPhases(profile)
					.map(phase => ({ engine, variant, phase, observation: value }))));
			validateMutualCheckedRecordBrowserPhases(
				observations, profile, mutualCheckedRecordBrowserEngines, route);
			assert.throws(() => validateMutualCheckedRecordBrowserObservation({
				...value, results: { ...value.results, checks: value.results.checks + 1 }
			}, profile, route));
			assert.throws(() => validateMutualCheckedRecordBrowserPhases(
				observations.slice(1), profile, mutualCheckedRecordBrowserEngines, route));
		}
	}
});

test("retained mutual checked-record npm packages pass source-free browser acceptance", {
	skip: !enabled, timeout: 7_200_000
}, async t => {
	const consumerCommit = execFileSync("git", ["rev-parse", "HEAD"]
		, { encoding: "utf8" }).trim();
	assert.doesNotThrow(() => execFileSync("git", ["diff", "--quiet", "HEAD", "--"]
		, { stdio: "ignore" }), "Browser evidence requires a clean tracked source tree");
	const base = resolve(process.env.LEAN_BRIDGE_MUTUAL_CHECKED_RECORD_BROWSER_OUTPUT
		?? "build/mutual-checked-record-npm");
	const runtime = { node: process.version, platform: process.platform, arch: process.arch };
	for(const route of routes)
	{
		const records = join(base, route);
		await access(join(records, "report.json"));
		await access(join(records, "handoff/component-package-receipt.json"));
		await assert.rejects(access(join(records, "browser.json")), { code: "ENOENT" });
		await assert.rejects(access(join(records, "browser")), { code: "ENOENT" });
		const npm = JSON.parse(await readFile(join(records, "report.json")));
		assert.equal(npm.route, route);
		const directory = await mkdtemp(join(tmpdir()
			, `lean-bridge-mutual-checked-record-browser-${route}-`));
		let complete = false;
		try
		{
			t.diagnostic(`${route}: retained npm handoff into all browser contexts`);
			const browser = await checkMutualCheckedRecordBrowsers({
				directory, records, route, producerCommit: npm.producerCommit
				, consumerCommit, runtime
			});
			assert.equal(browser.reports.length, mutualCheckedRecordBrowserProfiles.length);
			assert.deepEqual(browser.requestedEngines, mutualCheckedRecordBrowserEngines);
			assert.equal(browser.reports.reduce((count, report) =>
				count + report.observations.length, 0), 51);
			assert.equal(browser.reports.reduce((count, report) =>
				count + report.browser.executions.length, 0), 12);
			complete = true;
		}
		finally
		{
			if(complete) await rm(directory, { recursive: true });
			else t.diagnostic(`Retained failed browser inputs: ${directory}`);
		}
	}
});
