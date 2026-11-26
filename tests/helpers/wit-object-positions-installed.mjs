/** @file Exercise two distinct application resources against each installed WIT release. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename,join,resolve} from "node:path";
import test from "node:test";
import {promisify} from "node:util";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {buildObjectPositionGuests} from "./wit-object-position-guests.mjs";

const exec=promisify(execFile),json=async file=>JSON.parse(await readFile(file));
const positions=["parameter","result","callback-parameter","callback-result"];
test("installed WIT callback returns the other guest object, not a copy or an echo", {timeout: 1200000},async t=>{
	const handoffs=resolve(process.env.LEAN_BRIDGE_WIT_OBJECT_HANDOFFS);
	let first;
	for(const route of ["ordinary","reviewed"])
	{
		const root=await mkdtemp(join(tmpdir(),"wit-object-exchange-"));
		try
		{
			const source=join(handoffs,route+"-workshop");
			const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(source,"package-set-receipt.json")});
			assert.equal(receipt.packages.length,1);
			const [pkg]=receipt.packages;assert.equal(pkg.profile,"native-wit-object-task-v1");
			assert.equal(pkg.artifacts.length,1);const [archive]=pkg.artifacts;
			await exec("tar",["-xzf",join(source,archive.path),"-C",root,"--no-same-owner","--no-same-permissions"]);
			const prefix=join(root,"relocated Workshop");await rename(join(root,basename(archive.path,".tar.gz")),prefix);
			const meta=await json(join(prefix,"lean-bridge-package.json")),irFile=join(prefix,"share/lean-bridge/binding-ir.json");
			const ir=await json(irFile),publicIr=sha256(await readFile(irFile));
			assert.equal(meta.command,"bin/workshop-run");assert.equal(meta.bindingIrSha256,hashBindingIr(ir));
			assert.deepEqual(meta.inputs,["objects","callbacks","application"]);
			for(const [name,info] of Object.entries(meta.files))
			{
				const bytes=await readFile(join(prefix,name));assert.equal(bytes.length,info.bytes,name);assert.equal(sha256(bytes),info.sha256,name);
			}
			if(route==="ordinary")
			{assert.equal(meta.reviewedSourceSha256,undefined); first=ir;}
			else
			{assert.deepEqual(ir,first);assert.equal(meta.reviewedSourceSha256,sha256(canonicalJson(first)));}
			const decl=name=>ir.declarations.find(d=>d.name===name),id=decl("identity"),relay=decl("relay");
			const cb=ir.types.find(x=>x.id===relay.parameters[1].type.id);assert.equal(cb.kind,"callback");
			for(const v of [id.parameters[0],id.result,relay.parameters[0],cb.callable.parameters[0],cb.callable.result]) assert.equal(v.type.id,"host:meter.Box");
			const app=join(root,"downstream");
			const files=await buildObjectPositionGuests(join(prefix,"wit"),app,process.env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools");
			const env={PATH: "/no-producer-tools",LEAN_NUM_THREADS: "1",RAYON_NUM_THREADS: "1"};
			const invoke=id=>exec(join(prefix,meta.command),["owner.wasm",id+".wasm","app.wasm"],{cwd: app,env,timeout: 120000});
			const good=await invoke("swap");assert.equal(good.stdout.trim(),"2");assert.equal(good.stderr,"");
			await assert.rejects(invoke("echo"),e=>e.code===1 && e.stdout==="" && /unreachable/u.test(e.stderr));
			const report={route,positions,receipt: result.receiptSha256
				, archive: archive.sha256,publicIr,reviewed: meta.reviewedSourceSha256??null
				, verifiedMembers: Object.keys(meta.files).length
				, ...files,releasedCaptures: 2,echoRefused: true};
			if(process.env.LEAN_BRIDGE_WIT_OBJECT_OUTPUT)
			{
				const output=resolve(process.env.LEAN_BRIDGE_WIT_OBJECT_OUTPUT);await mkdir(output,{recursive: true});
				await writeFile(join(output,route+".json"),canonicalJson(report));
			}
			t.diagnostic(route+": "+result.receiptSha256+"; both captures released; echo rejected");
		} finally
		{await rm(root,{recursive: true,force: true});}
	}
});
