/** @file Verify application-origin functions through a real, source-free npm installation. */
import assert from "node:assert/strict";
import {access,mkdir,mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {validateOwnedAggregateBindingIr} from "../../src/binding-ir/contract.mjs";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {ledgerFrameworkArchives} from "./javascript-ledger-delivery.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runFiveInstalledNpm} from "./npm-five-installed.mjs";
import {copyPackageSetHandoff} from "./package-set.mjs";
import {checkStagedQuoteIdentities,prepareStagedQuoteProject} from "./staged-quote-project.mjs";

const options={hostFunctions: true},fixtures=resolve("tests/fixtures");
const original=await readFile(join(fixtures,"onboarding/leased-closure-fields/Owned.lean"));
const extra=await readFile(join(fixtures,"structured-types/pass-application-quote.lean"));
const source=Buffer.concat([original,Buffer.from("\n"),extra]);
const readJson=async path=>JSON.parse(await readFile(path));
const checkPositions=ir=>{
	const find=n=>ir.declarations.find(d=>d.source.declaration==="Owned."+n);
	const pass=find("passApplicationQuote"),visit=find("visitApplicationQuote");
	assert.equal(pass.parameters.length,1);assert.equal(visit.parameters.length,3);
	const id=pass.parameters[0].type.id;
	assert.equal(pass.parameters[0].ownership,"borrow");assert.equal(pass.parameters[0].lifetime.scope,"call");
	assert.equal(pass.result.type.id,id);assert.equal(visit.parameters[0].type.id,id);
	const visitor=ir.types.find(t=>t.id===visit.parameters[1].type.id).callable;
	assert.equal(visitor.parameters[0].type.id,id);assert.equal(visitor.parameters[0].ownership,"borrow");
	assert.equal(visitor.parameters[0].lifetime.scope,"call");
	const choose=ir.types.find(t=>t.id===find("stagedQuote").parameters[0].type.id).callable;
	assert.equal(choose.result.type.id,id);assert.equal(choose.result.ownership,"lease");
	assert.equal(pass.result.ownership,"lease");
};
const verify=(model,ir,profile,route)=>{
	const meta=checkStagedQuoteIdentities(model,ir,profile,route,options);
	assert.equal(model.sourceIdentity.modules[0].source.sha256,sha256(source));
	checkPositions(ir);
	return {...meta,sourceSha256: sha256(source)};
};

test("the two author contracts select application functions without changing the default fixture",async t=>{
	const work=await mkdtemp(join(tmpdir(),"app-function-contract-"));t.after(()=>rm(work,{recursive: true,force: true}));
	for(const route of ["ordinary","reviewed"]) for(const enabled of [false,true])
	{
		const src=join(work,route+"-"+enabled);
		await prepareStagedQuoteProject(src,route,"npm",{hostFunctions: enabled});
		assert.deepEqual(await readFile(join(src,"Owned.lean")),enabled?source:original);
		const cfg=await readJson(join(src,"lean-bridge.exports.json"));
		if(route==="ordinary")
		{
			for(const name of ["Owned.passApplicationQuote","Owned.visitApplicationQuote"]) assert.equal(cfg.exports.includes(name),enabled);
			assert.equal(cfg.arities["Owned.passApplicationQuote"],enabled?1:undefined);
			await assert.rejects(access(join(src,"api.binding-ir.json")),{code: "ENOENT"});
		} else
		{
			assert.equal(cfg.exports,undefined);const ir=await readJson(join(src,"api.binding-ir.json"));
			validateOwnedAggregateBindingIr(ir);
			if(enabled) checkPositions(ir);
			else assert.ok(ir.declarations.every(d=>!d.name.endsWith("ApplicationQuote")));
		}
	}
});

test("an installed npm client can forward a live host function without extending its registration",{
	timeout: 7_200_000
},async t=>{
	const work=await mkdtemp(join(tmpdir(),"npm-app-functions-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const keep=process.env.LEAN_BRIDGE_APP_QUOTE_KEEP,replay=process.env.LEAN_BRIDGE_APP_QUOTE_REPLAY;
	const resume=process.env.LEAN_BRIDGE_APP_QUOTE_RESUME;
	assert.ok([keep,replay,resume].filter(Boolean).length<=1);
	const dir=replay||resume?resolve(replay??resume):await mkdtemp(join(keep?resolve(keep):work,"sets-"));
	await access(dir);
	const out=resolve(process.env.LEAN_BRIDGE_APP_QUOTE_OUTPUT??"build/npm-app-functions");await mkdir(out,{recursive: true});
	const frameworks=await ledgerFrameworkArchives(work),rows=[];
	const client=join(fixtures,"npm-application-functions"),ui=join(fixtures,"javascript-host-record");
	const files={
		"calls.mjs": join(client,"calls.mjs")
		, "typed.mts": join(client,"typed.mts")
		, "calls.d.mts": join(client,"calls.d.mts")
		, "page.mjs": join(ui,"page.mjs")
		, "worker.mjs": join(ui,"worker.mjs")
		, "observer.mjs": join(fixtures,"structured-types/tariff-observer.mjs")
	};
	for(const route of ["ordinary","reviewed"])
	{
		const set=join(dir,route);
		const present=resume&&await access(set).then(()=>true,e=>{if(e.code!=="ENOENT")throw e;return false;});
		if(!replay&&!present)
		{
			const src=join(work,route+"-source"),build=join(work,route+"-producer");
			await prepareStagedQuoteProject(src,route,"npm",options);
			try
			{await buildCanonicalProject({projectRoot: src,outputRoot: build,targets: ["npm"],environment: process.env});}
			catch(e)
			{throw new Error(e.message+"\n"+JSON.stringify(e.details),{cause: e});}
			await copyPackageSetHandoff(join(build,"packages/npm"),set);
			await rm(src,{recursive: true});await rm(build,{recursive: true});
		}
		await access(join(set,"package-set-receipt.json"));
		const row=await runFiveInstalledNpm({work,set,route,name: "@example/tariff-quotes",files,frameworks,verify});
		for(const [host,result] of Object.entries({node: row.node,typescript: row.typescript,...row.browser}))
		{
			const base=["react","worker"].includes(host)?70:40;
			const expected={value: base+2,calls: 3,errorPreserved: true,staleCalls: 0,after: 0};
			if(host==="typescript") expected.typedValue=903;
			assert.deepEqual(result,expected);
		}
		await saveLakeFile(out,route+".json",canonicalJson(row));rows.push(row);
	}
	assert.notEqual(rows[0].receiptSha256,rows[1].receiptSha256);
	assert.deepEqual(rows[0].sourceHashes,rows[1].sourceHashes);
	const runtime=row=>row.archives.find(a=>a.path.startsWith("lean-bridge-runtime-")).sha256;
	assert.equal(runtime(rows[0]),runtime(rows[1]));
	t.diagnostic("Original handoffs: "+dir);
});
