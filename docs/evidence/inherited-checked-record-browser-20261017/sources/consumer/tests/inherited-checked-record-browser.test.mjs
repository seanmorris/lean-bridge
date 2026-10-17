/**
 * Source-free browser acceptance for retained inherited checked-record npm packages.
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
	inheritedCheckedRecordNpmExpected,
	inheritedCheckedRecordNpmRoutes,
	inheritedCheckedRecordNpmSelection
} from "./helpers/inherited-checked-record-npm-fixture.mjs";
import {
	inheritedCheckedRecordBrowserEngines,
	inheritedCheckedRecordBrowserPhases,
	inheritedCheckedRecordBrowserProfiles,
	validateInheritedCheckedRecordBrowserObservation,
	validateInheritedCheckedRecordBrowserPhases
} from "./helpers/inherited-checked-record-browser-fixture.mjs";
import { checkInheritedCheckedRecordBrowsers } from "./helpers/inherited-checked-record-browser.mjs";
import {
	checkInheritedCheckedRecordBrowserReport
} from "./helpers/inherited-checked-record-browser-report.mjs";

const flag = "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_BROWSER_TEST";
const enabled = process.env[flag] === "1";
if(process.env[flag] !== undefined)
	assert.ok(["0", "1"].includes(process.env[flag]), `Unknown ${flag} value`);
const routeVariable = "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_BROWSER_ROUTES";
const routes = process.env[routeVariable]?.split(",") ?? [...inheritedCheckedRecordNpmRoutes];
assert.ok(routes.length && routes.every(route => inheritedCheckedRecordNpmRoutes.includes(route)));
assert.equal(new Set(routes).size, routes.length);
if(process.env[routeVariable] !== undefined)
	assert.ok(enabled, "Explicit inherited checked-record browser routes require the browser gate");
if(enabled)
	assert.deepEqual(corpusBrowserSelection(process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS)
		, inheritedCheckedRecordBrowserEngines);

const expectedObservation = (profile, route) => ({
	schemaVersion: 1, profile, module: "inheritedcheckedrecords"
	, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
	, results: {
		module: "inheritedcheckedrecords", route
		, resultOnly: inheritedCheckedRecordNpmSelection(route).resultOnly
		, ...inheritedCheckedRecordNpmExpected(route)
	}
	, hostVersion: "fixture-browser"
});

test("inherited checked-record browser observations close every route and lifecycle", () => {
	for(const route of inheritedCheckedRecordNpmRoutes)
	{
		for(const profile of inheritedCheckedRecordBrowserProfiles)
		{
			const value = expectedObservation(profile, route);
			validateInheritedCheckedRecordBrowserObservation(value, profile, route);
			const variants = profile === "browser-react" ? ["production", "strict"] : ["production"];
			const observations = inheritedCheckedRecordBrowserEngines.flatMap(engine =>
				variants.flatMap(variant => inheritedCheckedRecordBrowserPhases(profile)
					.map(phase => ({ engine, variant, phase, observation: value }))));
			validateInheritedCheckedRecordBrowserPhases(
				observations, profile, inheritedCheckedRecordBrowserEngines, route);
			assert.throws(() => validateInheritedCheckedRecordBrowserObservation({
				...value, results: { ...value.results, checks: value.results.checks + 1 }
			}, profile, route));
			assert.throws(() => validateInheritedCheckedRecordBrowserPhases(
				observations.slice(1), profile, inheritedCheckedRecordBrowserEngines, route));
		}
	}
});

test("retained inherited checked-record npm packages pass source-free browser acceptance", {
	skip: !enabled, timeout: 7_200_000
}, async t => {
	const consumerCommit = execFileSync("git", ["rev-parse", "HEAD"], {
		encoding: "utf8"
	}).trim();
	assert.doesNotThrow(() => execFileSync("git", ["diff", "--quiet", "HEAD", "--"], {
		stdio: "ignore"
	}), "Browser evidence requires a clean tracked source tree");
	const base = resolve(process.env.LEAN_BRIDGE_INHERITED_CHECKED_RECORD_BROWSER_OUTPUT
		?? "build/inherited-checked-record-npm");
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
			, `lean-bridge-inherited-checked-record-browser-${route}-`));
		let complete = false;
		try
		{
			t.diagnostic(`${route}: retained npm handoff into all browser contexts`);
			await checkInheritedCheckedRecordBrowsers({
				directory, records, route, producerCommit: npm.producerCommit
				, consumerCommit, runtime
			});
			const browser = JSON.parse(await readFile(join(records, "browser.json")));
			const browserVersions = Object.fromEntries(browser.reports[0].browser.executions
				.map(execution => [execution.engine, execution.observation.hostVersion]));
			const checked = await checkInheritedCheckedRecordBrowserReport(
				path => readFile(join(records, path)), {
					route, producerCommit: npm.producerCommit, consumerCommit, runtime
				}
			);
			assert.deepEqual(checked, {
				route, mode: inheritedCheckedRecordNpmSelection(route).mode
				, producerCommit: npm.producerCommit, consumerCommit
				, engines: inheritedCheckedRecordBrowserEngines
				, profiles: inheritedCheckedRecordBrowserProfiles
				, browserVersions
				, browserExecutions: 12, lifecycleObservations: 51
				, ...inheritedCheckedRecordNpmExpected(route)
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
