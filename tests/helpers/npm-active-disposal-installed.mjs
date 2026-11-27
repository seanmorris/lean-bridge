/** @file Replay active disposal and nested recovery against exactly the qualified npm package pair. */
import assert from "node:assert/strict";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {ledgerFrameworkArchives} from "./javascript-ledger-delivery.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runFiveInstalledNpm} from "./npm-five-installed.mjs";
import {checkApplicationFunctionPositions,checkStagedQuoteIdentities} from "./staged-quote-project.mjs";

test("self-disposing host functions preserve their active result, nested error and sibling registration",async t=>{
	const sets=process.env.LEAN_BRIDGE_APP_QUOTE_REPLAY;assert.ok(sets,"supply the two retained function-forwarding releases");
	const out=resolve(process.env.LEAN_BRIDGE_ACTIVE_DISPOSAL_OUTPUT??"build/npm-active-disposal");
	const work=await mkdtemp(join(tmpdir(),"active-disposal-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const frameworks=await ledgerFrameworkArchives(work),fixture=resolve("tests/fixtures");
	const files=Object.fromEntries(["calls.mjs","calls.d.mts","typed.mts"].map(n=>[n,join(fixture,"npm-active-disposal",n)]));
	for(const n of ["page.mjs","worker.mjs"])files[n]=join(fixture,"javascript-host-record",n);
	files["observer.mjs"]=join(fixture,"structured-types/tariff-observer.mjs");
	for(const route of ["ordinary","reviewed"])
	{
		const original=JSON.parse(await readFile(resolve("docs/evidence/npm-application-functions-20261126",route+".json")));
		const set=resolve(sets,route);
		const {result}=await readVerifiedPackageSetReceipt({receiptPath: join(set,"package-set-receipt.json")});
		assert.equal(result.receiptSha256,original.receiptSha256);
		const verify=(m,ir,p,r)=>{
			checkApplicationFunctionPositions(ir);
			const fn=ir.types.find(v=>v.id===ir.declarations.find(d=>d.name==="passApplicationQuote").parameters[0].type.id);
			assert.equal(fn.callable.reentry,"same-agent");assert.equal(fn.callable.selfDisposal,"defer");
			return checkStagedQuoteIdentities(m,ir,p,r,{hostFunctions: true});
		};
		const row=await runFiveInstalledNpm({work,set,route,name: "@example/tariff-quotes",files,frameworks,verify});
		assert.deepEqual(row.archives,original.archives);assert.deepEqual(row.installedBytes,original.installedBytes);
		for(const [key,client] of Object.entries({node: row.node,typescript: row.typescript,...row.browser}))
		{
			const value=["react","worker"].includes(key)?73:43;
			assert.deepEqual(client,{value,trace: ["outer:2","inner:7","outer:3"],sameError: true,fresh: 903,after: 0,...key==="typescript"?{typedValue: 904}:{}});
		}
		await saveLakeFile(out,route+".json",canonicalJson(row));
	}
});
