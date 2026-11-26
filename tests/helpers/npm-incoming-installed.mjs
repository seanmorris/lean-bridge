/** @file Verify incoming Lean function borrows and independent retains in five npm consumers. */
import assert from "node:assert/strict";
import {mkdir,mkdtemp,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {ledgerFrameworkArchives} from "./javascript-ledger-delivery.mjs";
import {buildIncomingFunctionPackage,compareIncomingPackages,verifyIncomingFunction} from "./npm-incoming-package.mjs";
import {runFiveInstalledNpm} from "./npm-five-installed.mjs";

test("installed npm callbacks can retain, but cannot outlive, an incoming Lean function borrow",{timeout: 7_200_000},async t=>{
	const env=process.env,work=await mkdtemp(join(tmpdir(),"npm-incoming-"));
	t.after(()=>rm(work,{recursive: true,force: true}));
	const keep=env.LEAN_BRIDGE_NPM_INCOMING_KEEP,replay=env.LEAN_BRIDGE_NPM_INCOMING_REPLAY;
	assert.ok(!(keep && replay));
	const set=replay?resolve(replay):await mkdtemp(join(keep??work,"handoffs-"));
	const only=env.LEAN_BRIDGE_NPM_INCOMING_ROUTE;
	assert.ok(!only || replay && ["ordinary","reviewed"].includes(only));
	const routes=only?[only]:["ordinary","reviewed"];
	const output=resolve(env.LEAN_BRIDGE_NPM_INCOMING_OUTPUT??"build/npm-incoming-function");
	await mkdir(output,{recursive: true});const frameworks=await ledgerFrameworkArchives(work);
	const dir=resolve("tests/fixtures/npm-incoming-function"),ui=resolve("tests/fixtures/javascript-host-record");
	const files={
		"calls.mjs": join(dir,"calls.mjs")
		, "calls.d.mts": join(dir,"calls.d.mts")
		, "typed.mts": join(dir,"typed.mts")
		, "observer.mjs": resolve("tests/fixtures/structured-types/tariff-observer.mjs")
		, "page.mjs": join(ui,"page.mjs")
		, "worker.mjs": join(ui,"worker.mjs")
	};
	const observations=[];
	for(const route of routes)
	{
		if(!replay) await buildIncomingFunctionPackage({work,set: join(set,route),route});
		const row=await runFiveInstalledNpm({work,set: join(set,route),route,name: "owned-aggregates",files,frameworks,verify: verifyIncomingFunction});
		for(const [host,v] of Object.entries({node: row.node,typescript: row.typescript,...row.browser}))
		{
			const {active,...actual}=v;assert.ok(Number.isSafeInteger(active) && active>0);
			assert.deepEqual(actual,{
				value: ["worker","react"].includes(host)?71:42
				, visits: 2
				, expired: 2
				, recovered: true
				, baseline: 0
				, after: 0
				, ...(host==="typescript"?{typedEntries: 2}:{})
			});
		}
		await writeFile(join(output,route+".json"),canonicalJson(row));
		observations.push(row);
	}
	if(!only) await writeFile(join(output,"pair.json"),canonicalJson(compareIncomingPackages(...observations)));
	t.diagnostic("Handoffs: "+set);
});
