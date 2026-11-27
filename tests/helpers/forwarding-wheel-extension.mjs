/** @file Verify a shared forwarding workload across independently installed native package routes. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import test from "node:test";
import {sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {forwardingPackage,verifyForwardingClient} from "./forwarding-package-layout.mjs";
import {checkApplicationFunctionPositions,checkStagedQuoteIdentities,checkTicketExchangePositions} from "./staged-quote-project.mjs";

const fixtures=resolve("tests/fixtures"),json=async path=>JSON.parse(await readFile(path));
const textless=value=>JSON.parse(JSON.stringify(value,(key,v)=>key==="documentation"?undefined:v));
const compareContracts=(ordinary,reviewed)=>{
	const old=textless(ordinary),next=textless(reviewed);
	const exchange=next.declarations.find(d=>d.id==="lean:Owned.exchangeTicket");
	const additions={declarations: ["lean:Owned.exchangeTicket","lean:Owned.ticketSerial"],types: [exchange.parameters[1].type.id],errors: []};
	for(const [key,extra] of Object.entries(additions))
	{
		assert.equal(new Set(next[key].map(x=>x.id)).size,next[key].length,key);
		assert.deepEqual(next[key].filter(x=>!old[key].some(y=>y.id===x.id)).map(x=>x.id).sort(),extra.sort(),key);
		for(const entry of old[key])assert.deepEqual(next[key].find(x=>x.id===entry.id),entry,entry.id);
		delete old[key];delete next[key];
	}
	for(const ir of [old,next])
	{
		assert.equal(ir.producers.length,1);const ext=ir.producers[0].extensions;
		assert.match(ext["lean-lang.org/elaboration-sha256"],/^[a-f0-9]{64}$/u);
		delete ext["lean-lang.org/elaboration-sha256"]; // Each release compiled a different complete module.
	}
	assert.deepEqual(next,old); // Includes capabilities, producer/toolchain, assurance and aggregate policy.
};

const target=process.env.LEAN_BRIDGE_FORWARDING_TARGET??"pypi";
test(target+": both installs executed the same forwarding program; the reviewed package only adds Ticket exchange",async t=>{
	const base=(await Promise.all(["onboarding/leased-closure-fields/Owned.lean","structured-types/pass-application-quote.lean"].map(p=>readFile(join(fixtures,p),"utf8")))).join("\n");
	const extra=await readFile(join(fixtures,"structured-types/exchange-ticket.lean"),"utf8"),rows=[];
	for(const route of ["ordinary","reviewed"])
	{
		const reviewed=route==="reviewed",prefix="LEAN_BRIDGE_FORWARDING_"+route.toUpperCase();
		const dir=process.env[prefix+"_SET"],path=process.env[prefix+"_REPORT"];assert.ok(dir&&path,prefix);
		const row=await json(path),{receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(dir,"package-set-receipt.json")});
		const pkg=receipt.packages.find(p=>p.target===target);assert.equal(pkg.name,"tariff-quotes");assert.equal(pkg.version,"1.0.0");
		assert.equal(row.receiptSha256,result.receiptSha256);assert.deepEqual(pkg.artifacts,[row.archive]);
		assert.equal(row.route,route);assert.equal(row.runtimeIdentity,pkg.runtimeIdentity);
		const payload=await forwardingPackage(target,join(dir,row.archive.path));
		const meta=async name=>JSON.parse(await payload.member(payload.component+name+".json"));
		const model=await meta("model"),ir=await meta("binding-ir"),native=await meta("native-component");
		const profile=receipt.profiles.find(p=>p.id===pkg.profile);
		const pins=checkStagedQuoteIdentities(model,ir,profile,route,{hostFunctions: true,ticketExchange: reviewed});
		assert.equal(row.bindingIrSha256,pins.bindingIrSha256);assert.equal(row.reviewedSourceSha256,pins.reviewedSourceSha256);
		checkApplicationFunctionPositions(ir);if(reviewed)checkTicketExchangePositions(ir);
		assert.equal(model.sourceIdentity.sourceTreeSha256,receipt.source.treeSha256);
		assert.equal(model.sourceIdentity.modules.find(m=>m.module==="Owned").source.sha256,row.sourceSha256);
		assert.equal(row.sourceSha256,sha256(reviewed?base+"\n"+extra:base));
		assert.equal(row.componentSha256,native.nativeLibrary.sha256);
		assert.equal(sha256(await payload.member(payload.lib+native.library)),row.componentSha256);
		await verifyForwardingClient(target,row,payload);rows.push({row,ir});
	}
	const [a,b]=rows;compareContracts(a.ir,b.ir);
	for(const key of ["archive","receiptSha256","componentSha256","sourceSha256"])assert.notDeepEqual(a.row[key],b.row[key]);
	assert.equal(a.row.runtimeIdentity,b.row.runtimeIdentity);
	// A change to a shared declaration must still fail even if the input and output types look alike.
	const changed=structuredClone(b.ir);changed.declarations.find(d=>d.id==="lean:Owned.passApplicationQuote").result.ownership="copy";
	assert.throws(()=>compareContracts(a.ir,changed),assert.AssertionError);
	t.diagnostic("Shared forwarding declarations, types, errors, client and observer agree. Ticket execution is separate.");
});
