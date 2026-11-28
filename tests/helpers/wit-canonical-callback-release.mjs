/** @file Check the canonical owner graph against the two original compiled Budget worlds. */
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {reconcileHostExports} from "../../src/analyze/host-export-model.mjs";
import {generateCTaskExports} from "../../src/backends/c/task-exports.mjs";
import {retainedOnceSlots} from "../../src/backends/native/task-callback.mjs";
import {canonicalCallbackBindings} from "../../src/backends/wit/canonical-callback.mjs";
import {splitWitApplicationSlots} from "../../src/backends/wit/canonical-app.mjs";
import {compileWitTaskResources} from "../../src/backends/wit/task-model.mjs";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {prepareCanonicalCallbackPackage} from "../../src/release/wit-canonical-callback-package.mjs";
import {canonicalBudgetGuest} from "./wit-canonical-budget-client.mjs";
import {executeCanonicalBudgetNative} from "./wit-canonical-budget-native.mjs";

const exec=(cmd,args,cwd,input)=>{
	const r=spawnSync(cmd,args,{cwd,input,timeout: 180000,env: {...process.env,RAYON_NUM_THREADS: "1"}});
	if(r.error) throw r.error;
	assert.equal(r.status,0,r.stderr.toString());return r.stdout;
};
const tools=process.env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools";
const root=process.env.LEAN_BRIDGE_WIT_CALLBACK_TASK_RELEASES,sdk=process.env.LEAN_BRIDGE_ASYNC_WASMTIME_C_API;
for(const route of ["ordinary","reviewed"]) test(route+" compiled task world supplies every canonical callback request",async t=>{
	assert.ok(root && sdk,"Set LEAN_BRIDGE_WIT_CALLBACK_TASK_RELEASES and LEAN_BRIDGE_ASYNC_WASMTIME_C_API");
	const dir=await mkdtemp(join(tmpdir(),"wit-canonical-callback-link-"));t.after(()=>rm(dir,{recursive: true,force: true}));
	const set=resolve(root,route),{receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(set,"package-set-receipt.json")});
	const previous=JSON.parse(await readFile(new URL("../../docs/evidence/native-once-callback-20261126/wit-pollable/"+route+".json",import.meta.url)));
	assert.equal(previous.receiptSha256,result.receiptSha256);
	const [{artifacts: [a]}]=receipt.packages;assert.deepEqual(a,previous.archive);
	const top="budget-1.0.0-wit-wasi",share="share/lean-bridge";
	const members=[share+"/binding-ir.json",share+"/elaboration.json","component/budget.wat","component/budget.wasm"];
	exec("tar",["-xzf",join(set,a.path),"--strip-components=1","--no-same-owner",...members.map(n=>top+"/"+n)],dir);
	const api=JSON.parse(await readFile(join(dir,members[0]))),evidence=JSON.parse(await readFile(join(dir,members[1])));
	const bindingIrSha256=hashBindingIr(api);assert.equal(bindingIrSha256,previous.bindingIrSha256);
	const m=compileWitTaskResources({api,evidence,bindingIrSha256,settings: {name: "budget",version: "1.0.0"}});
	assert.equal(m.wat,await readFile(join(dir,members[2]),"utf8"));const real=await readFile(join(dir,members[3]));
	assert.equal(sha256(real),previous.componentSha256);assert.deepEqual(exec(tools,["parse","-"],dir,m.wat),real);
	const b=canonicalCallbackBindings(m);assert.deepEqual([m.methods.length,b.sites.length,b.signatures.length],[9,11,1]);
	assert.equal(b.sites.filter(s=>s.request.invocation==="once").length,10);
	exec(tools,["validate","-"],dir,exec(tools,["parse","-"],dir,b.graph));
	const {entries}=reconcileHostExports({...evidence,owned: [],ir: null,component: api.component,review: {source: canonicalJson(api)}});
	const gen=generateCTaskExports({name: "wit-"+sha256(api.component.id)
		, modules: evidence.selection.exportModules
		, entries
		, witCallbacks: true
		, onceByDeclaration: retainedOnceSlots(api)
		, synchronousIO: false
		, witDelivery: true
		, integerMode: "words"
		, componentIdentity: "0".repeat(64)});
	assert.equal(gen.prefix,m.prefix);
	await writeFile(join(dir,m.prefix+".h"),gen.header);
	const prepared=await prepareCanonicalCallbackPackage({app: dir
		, api
		, evidence
		, entries
		, bindingIrSha256
		, name: "budget",version: "1.0.0",prefix: gen.prefix,wire: m.wire
		, run: (cmd,args,cwd)=>({stdout: exec(cmd,args,cwd).toString()})},tools);
	assert.match(prepared.wit,/future<result<u32, pair-failure>>/u);
	const sections=splitWitApplicationSlots(prepared.template,["callbacks","application"]);
	const clients=[await readFile(new URL("../fixtures/native-callback-budget/canonical-provider.wat",import.meta.url)),canonicalBudgetGuest()];
	const pieces=[],guestBinaries=[];
	for(const [i,s] of clients.entries())
	{
		const bytes=exec(tools,["parse","-"],dir,s),header=[4];
		let n=bytes.length;
		while(n>=128)
		{
			header.push((n&127)|128);n>>>=7;
		}
		header.push(n);
		guestBinaries.push(bytes);
		pieces.push(sections[i],Buffer.from(header),bytes);
	}
	exec(tools,["validate","--features","cm-async,cm-async-builtins","-"],dir,Buffer.concat([...pieces,sections[2]]));
	exec(process.env.CC??"cc",["-std=c11","-Wall","-Wextra","-Werror","-I"+resolve(sdk,"include"),"-fsyntax-only","canonical-command.c"],dir);
	if(process.env.LEAN_BRIDGE_WIT_CALLBACK_NATIVE_RUNTIME)
	{
		const siblingWat=await readFile(new URL("../fixtures/native-callback-budget/canonical-siblings.wat",import.meta.url));
		const siblings=exec(tools,["parse","-"],dir,siblingWat);
		exec(tools,["validate","--features","cm-async,cm-async-builtins","-"],dir,siblings);
		await executeCanonicalBudgetNative({dir,evidence,gen,wire: m.wire,previous,clients: guestBinaries,sdk,siblings});
		t.diagnostic("27 canonical future results; one shared registration, one abandoned reader, sibling results 21 and 41");
	}
	t.diagnostic(previous.componentSha256+": nine methods, eleven sites, ten one-call binders, one guest signature");
});
