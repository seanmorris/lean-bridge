/** @file Check the resource exchange against Lean and both release author contracts. */
import assert from "node:assert/strict";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {sha256} from "../../src/capsule/node.mjs";
import {validateOwnedAggregateBindingIr} from "../../src/binding-ir/contract.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runNativeTool} from "./native-effect-consumers.mjs";
import {checkTicketExchangePositions,prepareStagedQuoteProject} from "./staged-quote-project.mjs";

test("both author routes describe the same Ticket exchange and Lean reduces the actual replies",async t=>{
	const work=await mkdtemp(join(tmpdir(),"ticket-author-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const sources=[];
	for(const route of ["ordinary","reviewed"])
	{
		const path=join(work,route);await prepareStagedQuoteProject(path,route,["c","wit-wasi"],{hostFunctions: true,ticketExchange: true});
		const src=await readFile(join(path,"Owned.lean"),"utf8");sources.push(src);
		assert.equal(sha256(src),"a758f8e7a4210d99fe965aa06c4b42006df3c087c70f2bde8d0e1403c30a98fb");
		const config=JSON.parse(await readFile(join(path,"lean-bridge.exports.json")));
		if(route==="ordinary")
		{
			assert.ok(["Owned.ticketSerial","Owned.exchangeTicket"].every(n=>config.exports.includes(n)));
			await assert.rejects(readFile(join(path,"api.binding-ir.json")),{code: "ENOENT"});
		}
		else
		{
			assert.equal(config.exports,undefined);
			const ir=JSON.parse(await readFile(join(path,"api.binding-ir.json")));
			validateOwnedAggregateBindingIr(ir);checkTicketExchangePositions(ir);
			const id=ir.declarations.find(d=>d.name==="exchangeTicket").parameters[1].type.id;
			const fn=ir.types.find(v=>v.id===id).callable;
			fn.result.ownership="borrow";assert.throws(()=>checkTicketExchangePositions(ir));
			fn.result.ownership="lease";fn.parameters[0].lifetime.scope="explicit";assert.throws(()=>checkTicketExchangePositions(ir));
		}
	}
	assert.equal(sources[0],sources[1]);
	await saveLakeFile(work,"Check.lean",sources[0]+`
example : Owned.exchangeTicket (Owned.newTicket 42)
    (fun t => Owned.newTicket (Owned.ticketSerial t + 1)) = 43 := rfl
example : Owned.exchangeTicket (Owned.newTicket 71)
    (fun t => Owned.newTicket (Owned.ticketSerial t + 1)) = 72 := rfl
example : Owned.exchangeTicket (Owned.newTicket 42) (fun _ => Owned.newTicket 800) = 800 := rfl
`);
	const lean=process.env.LEAN_BRIDGE_LEAN_PREFIX?join(process.env.LEAN_BRIDGE_LEAN_PREFIX,"bin/lean"):"lean";
	await runNativeTool(lean,["Check.lean"],work,{...process.env,LEAN_NUM_THREADS: "1"});
});
