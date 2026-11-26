/** @file Reconcile updated WIT records against compiler observations, independent of the installed-package test. */
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {witRecordContracts} from "../../src/backends/wit/application-records.mjs";

const box={kind: "named",id: "host:test.Box"},n={kind: "primitive",name: "nat"};
const fields=[["left",box],["counter",n],["right",box]].map(([name,type])=>({name,type,projection: "Gauge.Pair."+name}));
const raw={kind: "host-record",declaration: "Gauge.Pair",constructor: "Gauge.Pair.mk",fields};
const source={declaration: "Gauge.Pair",extensions: {"lean-bridge.dev/record-constructor": "Gauge.Pair.mk"}};
const row={name: "Pair",id: "lean:Gauge.Pair",kind: "record"
	, representation: "owned",mutability: "immutable",source
	, aggregate: {ownership: "lease",disposal: "required",fallback: "none",cycles: "reject"}
	, fields: fields.map(({name,type})=>({name,type,mutability: "immutable"}))};
const site={kind: "named",id: row.id};
const e={declaration: "Gauge.flip",effect: "IO",parameters: [{name: "a",type: raw}],result: raw};
const params=[{name: "a",type: site,ownership: "borrow",lifetime: {scope: "call",anchor: null}}];
const result={type: site,ownership: "lease",lifetime: {scope: "explicit",anchor: null}};
const decl={source: {declaration: e.declaration},parameters: params,result};
const doc=()=>structuredClone({schemaVersion: 4,types: [{id: box.id,kind: "resource",host: {}},row],declarations: [decl]});
const check=(d,names=new Set())=>witRecordContracts([e],d,names);
test("private WIT record owners reject a stale rep, wrong type and reentrant release",async t=>{
	const dir=await mkdtemp(join(tmpdir(),"wit-record-table-"));
	t.after(()=>rm(dir,{recursive: true,force: true}));
	const bin=join(dir,"table");
	await run(process.env.CC??"cc",["-std=c11","-Wall","-Wextra","-Werror","-I",resolve("src/backends/wit"),resolve("tests/fixtures/static-host-workers/record-table.c"),"-o",bin],dir,process.env);
	await run(bin,[],dir,process.env);
});
test("WIT resource methods use the checked record names and ordered field types",()=>{
	const rows=check(doc());assert.equal(rows.size,1);
	const [r]=rows.values();assert.equal(r.resource,"pair");assert.deepEqual(r.fields.map(f=>f.type),[box,n,box]);
	assert.throws(()=>check(doc(),new Set(["pair"])),/duplicated/u);
	for(const change of [
		d=>d.types[1].fields.reverse()
		, d=>{d.types[1].source.extensions["lean-bridge.dev/record-constructor"]="Gauge.Pair.restore";}
		, d=>{d.declarations[0].parameters[0].ownership="transfer";}
		, d=>{d.declarations[0].parameters.unshift({...d.declarations[0].parameters[0],type: n});}
		, d=>{d.declarations[0].result.lifetime.scope="call";}
		, d=>{d.types[0].host=null;}
		, d=>{d.types.push({...d.types[1],id: "lean:Other.Record"});}
	]){
		const v=doc();change(v);assert.throws(()=>check(v),/WIT application record/u);
	}
});
