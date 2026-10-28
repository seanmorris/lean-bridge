/**
 * Installed ordinary/reviewed dependent Fin in Node, TypeScript and browsers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	checkDependentFinJavascriptRoute
} from "./helpers/dependent-fin-javascript-install.mjs";
import { dependentFinJavascriptRoutes } from "./helpers/dependent-fin-javascript.mjs";
import "./helpers/dependent-fin-javascript-tests.mjs";

const selected = process.env.LEAN_BRIDGE_DEPENDENT_FIN_JAVASCRIPT_ROUTES
	?.split(",").filter(Boolean) ?? [];
assert.deepEqual(selected, [...new Set(selected)]
	, "dependent Fin JavaScript routes must be unique");
for(const route of selected)
	assert.ok(dependentFinJavascriptRoutes.includes(route)
		, `unknown dependent Fin JavaScript route: ${route}`);
for(const route of selected)
	test(`installed ${route} JavaScript-family packages check the live dependent bound`, {
		timeout: 2_400_000
	}, async t => {
		const report = await checkDependentFinJavascriptRoute(t, route);
		const configured = process.env.LEAN_BRIDGE_DEPENDENT_FIN_JAVASCRIPT_REPORT;
		if(configured)
		{
			const path = resolve(configured.replace("{route}", route));
			await mkdir(dirname(path), { recursive: true });
			await writeFile(path, canonicalJson(report), { flag: "wx" });
		}
	});
