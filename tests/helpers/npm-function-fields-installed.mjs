/** @file Consume the staged Lean function contract as JS, strict TS, a page, React and a worker. */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { checkStagedQuoteIdentities,prepareStagedQuoteProject } from "./staged-quote-project.mjs";

import {runFiveInstalledNpm} from "./npm-five-installed.mjs";
import {ledgerFrameworkArchives} from "./javascript-ledger-delivery.mjs";

const name = "@example/tariff-quotes";
const applicationField = {visits: 2,innerCalls: 2,first: 42,second: 42,recovered: 42};
const expected = base => ({ keptValue: base + 2, entries: 0, stageCalls: 1, stagedValue: base + 4, nextValue: 42, applicationField });
test("five installed npm clients own callable record fields on both author routes", {timeout: 7_200_000}, async t => {
	const work = await mkdtemp(join(tmpdir(), "npm-tariff-")); t.after(() => rm(work, {recursive: true, force: true}));
	const { LEAN_BRIDGE_NPM_TARIFF_KEEP: keep, LEAN_BRIDGE_NPM_TARIFF_REPLAY: replay } = process.env;
	assert.ok(!(keep && replay));
	const set = replay ? resolve(replay) : keep ? await mkdtemp(join(resolve(keep), "tariff-")) : join(work, "packages");
	if(!keep && !replay) await mkdir(set);
	const routes = ["ordinary", "reviewed"];
	if(!replay) for(const route of routes)
	{
		const src = join(work, route + "-source"), out = join(work, route + "-producer");
		await prepareStagedQuoteProject(src, route, "npm");
		try
		{
			await buildCanonicalProject({ projectRoot: src, outputRoot: out, targets: ["npm"], environment: process.env });
		}
		catch(e)
		{
			throw new Error(e.message + "\n" + JSON.stringify(e.details), {cause: e});
		}
		await copyPackageSetHandoff(join(out, "packages/npm"), join(set, route));
		await rm(src, {recursive: true}); await rm(out, {recursive: true});
	}
	const frameworks = await ledgerFrameworkArchives(work);
	const output = resolve(process.env.LEAN_BRIDGE_NPM_TARIFF_OUTPUT ?? "build/npm-function-fields");
	await mkdir(output, {recursive: true});
	const client = resolve("tests/fixtures/structured-types"), ui = resolve("tests/fixtures/javascript-host-record");
	const files = {
		"calls.mjs": join(client, "tariff-fields.mjs")
		, "typed.mts": join(client, "tariff-fields.mts")
		, "page.mjs": join(ui, "page.mjs")
		, "worker.mjs": join(ui, "worker.mjs")
	};
	files["observer.mjs"] = join(client, "tariff-observer.mjs"); files["observer.d.mts"] = join(client, "tariff-observer.d.mts");
	files["host-field.mjs"] = join(client, "tariff-host-field.mjs"); files["host-field.d.mts"] = join(client, "tariff-host-field.d.mts");
	const check = (actual, expectedCalls) => {
		const {baseline, held, after, ...values} = actual;
		assert.equal(baseline, 0); assert.ok(Number.isInteger(held) && held > baseline);
		assert.equal(after, baseline); assert.deepEqual(values, expectedCalls);
	};
	for(const route of routes)
	{
		const report=await runFiveInstalledNpm({work,set: join(set,route),route,name,files,frameworks,verify: checkStagedQuoteIdentities});
		check(report.node,expected(40));check(report.typescript,{value: 42,entries: 0,applicationField});
		check(report.browser.page,expected(40));check(report.browser.react,expected(71));check(report.browser.worker,expected(71));
		await writeFile(join(output,route+".json"),canonicalJson(report));
	}
	t.diagnostic("Handoffs: " + set);
});
