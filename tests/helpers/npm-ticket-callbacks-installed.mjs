/** @file Exercise both direct resource callback positions with source-free installed npm clients. */
import assert from "node:assert/strict";
import {mkdir,mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {ledgerFrameworkArchives} from "./javascript-ledger-delivery.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {buildIncomingFunctionPackage,compareIncomingPackages,verifyIncomingFunction} from "./npm-incoming-package.mjs";
import {runFiveInstalledNpm} from "./npm-five-installed.mjs";

const verify=(model,ir,profile,route)=>{
	const meta=verifyIncomingFunction(model,ir,profile,route);
	const callback=name=>{
		const decl=ir.declarations.find(d=>d.source.declaration==="Owned."+name);
		return ir.types.find(t=>t.id===decl.parameters.at(-1).type.id).callable;
	};
	const arg=callback("construct").parameters[0],reply=callback("factory").result;
	assert.equal(arg.type.id,"lean:Owned.Ticket");assert.equal(arg.ownership,"borrow");
	assert.equal(arg.lifetime.scope,"call");assert.equal(reply.type.id,arg.type.id);assert.equal(reply.ownership,"lease");
	return meta;
};
test("two resource callback positions in five real npm clients on both author routes",{timeout: 7_200_000},async t=>{
	const work=await mkdtemp(join(tmpdir(),"npm-ticket-callbacks-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const replay=process.env.LEAN_BRIDGE_NPM_TICKET_CALLBACK_REPLAY;
	const set=replay?resolve(replay):join(work,"originals");
	const out=resolve(process.env.LEAN_BRIDGE_NPM_TICKET_CALLBACK_OUTPUT??"build/npm-ticket-callbacks");
	await mkdir(out,{recursive: true});
	const root=resolve("tests/fixtures"),client=join(root,"npm-ticket-callbacks"),ui=join(root,"javascript-host-record");
	const files={
		"calls.mjs": join(client,"calls.mjs")
		, "calls.d.mts": join(client,"calls.d.mts")
		, "typed.mts": join(client,"typed.mts")
		, "observer.mjs": join(root,"structured-types/tariff-observer.mjs")
		, "page.mjs": join(ui,"page.mjs")
		, "worker.mjs": join(ui,"worker.mjs")
	};
	const frameworks=await ledgerFrameworkArchives(work),rows=[];
	for(const route of ["ordinary","reviewed"])
	{
		const release=join(set,route);
		if(!replay) await buildIncomingFunctionPackage({work,set: release,route});
		const row=await runFiveInstalledNpm({work,set: release,route,name: "owned-aggregates",files,frameworks,verify});
		for(const [host,result] of Object.entries({node: row.node,typescript: row.typescript,...row.browser}))
		{
			const n=["react","worker"].includes(host)?71:42;
			assert.deepEqual(result,{argument: n,reply: n+1,seen: 1,replies: 1,failed: true,after: 0});
		}
		await saveLakeFile(out,route+".json",canonicalJson(row));rows.push(row);
	}
	await saveLakeFile(out,"pair.json",canonicalJson(compareIncomingPackages(...rows)));
});
