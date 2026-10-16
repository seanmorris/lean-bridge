/**
 * Source-free browser acceptance for retained nested checked-record npm packages.
 * The opt-in gate extends accepted npm records without rebuilding their Lean source.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { corpusBrowserSelection } from "./helpers/type-corpus.mjs";
import {
	nestedCheckedRecordNpmExpected,
	nestedCheckedRecordNpmRoutes,
	nestedCheckedRecordNpmSelection
} from "./helpers/nested-checked-record-npm-fixture.mjs";
import {
	nestedCheckedRecordBrowserEngines,
	nestedCheckedRecordBrowserPhases,
	nestedCheckedRecordBrowserProfiles,
	validateNestedCheckedRecordBrowserObservation,
	validateNestedCheckedRecordBrowserPhases
} from "./helpers/nested-checked-record-browser-fixture.mjs";
import { checkNestedCheckedRecordBrowsers } from "./helpers/nested-checked-record-browser.mjs";
import {
	checkNestedCheckedRecordBrowserReport
} from "./helpers/nested-checked-record-browser-report.mjs";

const flag = "LEAN_BRIDGE_NESTED_CHECKED_RECORD_BROWSER_TEST";
const enabled = process.env[flag] === "1";
if(process.env[flag] !== undefined)
	assert.ok(["0", "1"].includes(process.env[flag]), `Unknown ${flag} value`);
const routeVariable = "LEAN_BRIDGE_NESTED_CHECKED_RECORD_BROWSER_ROUTES";
const routes = process.env[routeVariable]?.split(",") ?? [...nestedCheckedRecordNpmRoutes];
assert.ok(routes.length && routes.every(route => nestedCheckedRecordNpmRoutes.includes(route)));
assert.equal(new Set(routes).size, routes.length);
if(process.env[routeVariable] !== undefined)
	assert.ok(enabled, "Explicit nested checked-record browser routes require the browser gate");
if(enabled)
	assert.deepEqual(corpusBrowserSelection(process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS)
		, nestedCheckedRecordBrowserEngines);

const expectedObservation = (profile, route) => ({
	schemaVersion: 1, profile, module: "nestedcheckedrecords"
	, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
	, results: {
		module: "nestedcheckedrecords", route
		, resultOnly: nestedCheckedRecordNpmSelection(route).resultOnly
		, ...nestedCheckedRecordNpmExpected(route)
	}
	, hostVersion: "fixture-browser"
});

test("nested checked-record browser observations close every route and lifecycle", () => {
	for(const route of nestedCheckedRecordNpmRoutes)
	{
		for(const profile of nestedCheckedRecordBrowserProfiles)
		{
			const value = expectedObservation(profile, route);
			validateNestedCheckedRecordBrowserObservation(value, profile, route);
			const variants = profile === "browser-react" ? ["production", "strict"] : ["production"];
			const observations = nestedCheckedRecordBrowserEngines.flatMap(engine =>
				variants.flatMap(variant => nestedCheckedRecordBrowserPhases(profile)
					.map(phase => ({ engine, variant, phase, observation: value }))));
			validateNestedCheckedRecordBrowserPhases(
				observations, profile, nestedCheckedRecordBrowserEngines, route);
			assert.throws(() => validateNestedCheckedRecordBrowserObservation({
				...value, results: { ...value.results, checks: value.results.checks + 1 }
			}, profile, route));
			assert.throws(() => validateNestedCheckedRecordBrowserPhases(
				observations.slice(1), profile, nestedCheckedRecordBrowserEngines, route));
		}
	}
});

test("retained nested checked-record npm packages pass source-free browser acceptance", {
	skip: !enabled, timeout: 7_200_000
}, async t => {
	const consumerCommit = execFileSync("git", ["rev-parse", "HEAD"], {
		encoding: "utf8"
	}).trim();
	assert.doesNotThrow(() => execFileSync("git", ["diff", "--quiet", "HEAD", "--"], {
		stdio: "ignore"
	}), "Browser evidence requires a clean tracked source tree");
	const base = resolve(process.env.LEAN_BRIDGE_NESTED_CHECKED_RECORD_BROWSER_OUTPUT
		?? "build/nested-checked-record-npm");
	const runtime = {
		node: process.version, platform: process.platform, arch: process.arch
	};
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
			, `lean-bridge-nested-checked-record-browser-${route}-`));
		let complete = false;
		try
		{
			t.diagnostic(`${route}: retained npm handoff into all browser contexts`);
			await checkNestedCheckedRecordBrowsers({
				directory, records, route, producerCommit: npm.producerCommit
				, consumerCommit, runtime
			});
			const browser = JSON.parse(await readFile(join(records, "browser.json")));
			const browserVersions = Object.fromEntries(browser.reports[0].browser.executions
				.map(execution => [execution.engine, execution.observation.hostVersion]));
			const checked = await checkNestedCheckedRecordBrowserReport(
				path => readFile(join(records, path)), {
					route, producerCommit: npm.producerCommit, consumerCommit, runtime
				}
			);
			assert.deepEqual(checked, {
				route, mode: nestedCheckedRecordNpmSelection(route).mode
				, producerCommit: npm.producerCommit, consumerCommit
				, engines: nestedCheckedRecordBrowserEngines
				, profiles: nestedCheckedRecordBrowserProfiles
				, browserVersions
				, browserExecutions: 12, lifecycleObservations: 51
				, ...nestedCheckedRecordNpmExpected(route)
			});
			complete = true;
		}
		finally
		{
			if(complete) await rm(directory, { recursive: true });
			else t.diagnostic(`Retained failed browser inputs: ${directory}`);
		}
	}
});
