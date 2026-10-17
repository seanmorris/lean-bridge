/**
 * Destructive controls for retained inherited checked-record browser evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import {
	inheritedCheckedRecordNpmRoutes,
	inheritedCheckedRecordNpmSelection
} from "./helpers/inherited-checked-record-npm-fixture.mjs";
import {
	inheritedCheckedRecordBrowserRecordPaths
} from "./helpers/inherited-checked-record-browser-report.mjs";
import {
	controlInheritedCheckedRecordBrowserReport
} from "./helpers/inherited-checked-record-browser-controls.mjs";

const flag = "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_BROWSER_CONTROLS_TEST";
const enabled = process.env[flag] === "1";
if(process.env[flag] !== undefined)
	assert.ok(["0", "1"].includes(process.env[flag]), `Unknown ${flag} value`);
const routeVariable = "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_BROWSER_CONTROL_ROUTES";
const routes = process.env[routeVariable]?.split(",") ?? [...inheritedCheckedRecordNpmRoutes];
assert.ok(routes.length && routes.every(route => inheritedCheckedRecordNpmRoutes.includes(route)));
assert.equal(new Set(routes).size, routes.length);
if(process.env[routeVariable] !== undefined)
	assert.ok(enabled, "Explicit inherited checked-record control routes require the control gate");

test("inherited checked-record browser originals reject omissions and substitutions", {
	skip: !enabled, timeout: 3_600_000
}, async t => {
	const checkerCommit = execFileSync("git", ["rev-parse", "HEAD"], {
		encoding: "utf8"
	}).trim();
	assert.doesNotThrow(() => execFileSync("git", ["diff", "--quiet", "HEAD", "--"], {
		stdio: "ignore"
	}), "Browser controls require a clean tracked source tree");
	const base = resolve(process.env.LEAN_BRIDGE_INHERITED_CHECKED_RECORD_BROWSER_OUTPUT
		?? "build/inherited-checked-record-npm");
	const runtime = {
		node: process.version, platform: process.platform, arch: process.arch
	};
	for(const route of routes)
	{
		const records = join(base, route), output = join(records, "browser-controls.json");
		await access(join(records, "browser.json"));
		await assert.rejects(access(output), { code: "ENOENT" });
		const npm = JSON.parse(await readFile(join(records, "report.json")));
		const browser = JSON.parse(await readFile(join(records, "browser.json")));
		assert.equal(npm.route, route); assert.equal(browser.route, route);
		assert.equal(browser.producerCommit, npm.producerCommit);
		const paths = inheritedCheckedRecordBrowserRecordPaths(
			inheritedCheckedRecordNpmSelection(route).mode, npm.receipt);
		const originals = new Map();
		for(const path of paths)
			originals.set(path, await readFile(join(records, path)));
		t.diagnostic(`${route}: ${paths.length} originals and coordinated controls`);
		const controls = await controlInheritedCheckedRecordBrowserReport(originals, {
			route, producerCommit: npm.producerCommit
			, consumerCommit: browser.consumerCommit, runtime, checkerCommit
		});
		assert.equal(controls.recordControls, paths.length * 2);
		assert.equal(controls.npmReportControls, 10);
		assert.equal(controls.npmAdapterControls
			, inheritedCheckedRecordNpmSelection(route).resultOnly ? 4 : 8);
		assert.equal(controls.browserControls, 165);
		await saveLakeFile(records, "browser-controls.json", canonicalJson(controls));
		assert.deepEqual(JSON.parse(await readFile(output)), controls);
	}
});
