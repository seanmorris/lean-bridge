/** @file Compile the actual wasm32 Zend transport separately from installed execution. */
import assert from "node:assert/strict";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {pathToFileURL} from "node:url";
import {readVerifiedNativeComponent,readVerifiedNativeRuntime} from "../../src/build/native-artifacts.mjs";
import {createOwnedPhpWasmModel,generateOwnedPhpWasmLeanAdapters} from "../../src/build/php-wasm-owned-model.mjs";
import {generateCompiledPhpWasmOwned} from "../../src/build/php-wasm-owned-component.mjs";
import {compileOwnedPhpZendModel} from "../../src/backends/php/owned-zend-model.mjs";
import {sha256} from "../../src/capsule/node.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runNativeTool} from "./native-effect-consumers.mjs";

test("direct Zend callback comparisons use a typed wasm32 transport, without whole-owner operations",async t=>{
	const env=process.env,stage=resolve(env.LEAN_BRIDGE_FRAME_NATIVE_STAGE);
	const {identity}=await readVerifiedNativeRuntime(join(stage,"runtime"));
	const {model: original}=await readVerifiedNativeComponent(join(stage,"component"),identity,{ownedGraphs: true,ownedHostCallbacks: true});
	const sources=await Promise.all(["onboarding/leased-closure-fields/Owned.lean","structured-types/visit-quote.lean"].map(file=>readFile(resolve("tests/fixtures",file),"utf8")));
	assert.equal(original.sourceIdentity.modules.find(m=>m.module==="Owned").source.sha256,sha256(sources.join("\n")));
	const metadata=JSON.parse(await readFile(join(stage,"component/metadata.json")));
	const input={component: original.component,metadata,sourceIdentity: original.sourceIdentity};
	const model=createOwnedPhpWasmModel(input),adapters=generateOwnedPhpWasmLeanAdapters(model);
	const graph=generateCompiledPhpWasmOwned(model,metadata,adapters);
	for(const view of [model.ownedGraph,graph.receipt,graph.manifest])
	{
		assert.equal(view.callbackArgumentIdentity,"canonical-while-live");assert.equal(view.resultAnchors,undefined);
	}
	const old=createOwnedPhpWasmModel({...input,callbackViewEquality: false}),oldAdapter=generateOwnedPhpWasmLeanAdapters(old);
	const before=generateCompiledPhpWasmOwned(old,metadata,oldAdapter);
	assert.deepEqual(oldAdapter,adapters);
	const file="extension/"+graph.manifest.extension+".c",php="src/Internal/Values.php",dispatch="src/Internal/Native.php";
	assert.doesNotMatch(before.files[file],/ZEND_FN\(lgo_equal\)/u);
	assert.doesNotMatch(before.files[php],/function sameIdentity\(/u);
	assert.match(graph.files[file],/ZEND_FN\(lgo_equal\)/u);
	assert.doesNotMatch(graph.files[file],/ZEND_FN\(lgo_owner_share\)/u);
	assert.match(graph.files[php],/function sameIdentity\(/u);
	assert.match(graph.files[php],/instanceof ZendBinding/u);assert.doesNotMatch(graph.files[php],/instanceof NativeBinding/u);
	assert.match(graph.files[dispatch],/function sameIdentity\(int \$type/u);
	const forged={...model,ownedGraph: {...model.ownedGraph,callbackArgumentIdentity: "pointer"}};
	assert.throws(()=>generateOwnedPhpWasmLeanAdapters(forged),/checked 32-bit transport/u);
	const work=await mkdtemp(join(tmpdir(),"zend-direct-api-"));t.after(()=>rm(work,{recursive: true,force: true}));
	for(const [name,bytes] of Object.entries({...graph.files,"component.h": adapters.header}))
		await saveLakeFile(work,name,bytes);
	const kit=resolve(env.LEAN_BRIDGE_PHP_INPUTS),headers=join(kit,"php"),sdk=resolve(env.LEAN_BRIDGE_PHP_EMSDK);
	const roots=[work,join(work,"owned"),join(kit,"runtime/include"),headers,...["Zend","main","TSRM","ext"].map(n=>join(headers,n))];
	const flags=["-fsyntax-only","-DLEAN_EMSCRIPTEN","-fbracket-depth=4096"];
	const args=[...flags,...roots.flatMap(p=>["-I",p]),file,"owned/callbacks.c"];
	await runNativeTool(join(sdk,"upstream/emscripten/emcc"),args,work,{...env,EM_CONFIG: join(sdk,".emscripten"),EMSDK: sdk});
	for(const name of [php,dispatch]) await runNativeTool(env.LEAN_BRIDGE_PHP??"php",["-l",name],work,env);
	const {PhpNode}=await import(pathToFileURL(join(resolve(env.LEAN_BRIDGE_PHP_WASM_HOST),"PhpNode.mjs")));
	const vm=new PhpNode({version: "8.4",autoTransaction: false});
	let printed="",errors="";
	vm.addEventListener("output",e=>{printed+=e.detail.join("");});
	vm.addEventListener("error",e=>{errors+=e.detail.join("");});
	await vm.binary;
	const ir=model.bindingIr,visit=ir.declarations.find(d=>d.name==="visitQuote");
	const visitor=ir.types.find(t=>t.id===visit.parameters[1].type.id);
	const leaf=compileOwnedPhpZendModel(ir).types.find(t=>t.id===visitor.callable.parameters[0].type.id);
	for(const [tag,g] of [["old",before],["fresh",graph]])
	{
		for(const dir of ["/"+tag,"/"+tag+"/Internal"]) await vm.mkdir(dir);
		for(const [name,data] of Object.entries(g.files))
			if(name.startsWith("src/")) await vm.writeFile("/"+tag+"/"+name.slice(4),data);
		const expected=tag==="fresh"?"true":"false",ns=g.manifest.namespace;
		const resource=ns+"\\\\"+leaf.publicType;
		const check="<?php require '/"+tag+"/Api.php'; if (PHP_INT_SIZE !== 4 || PHP_VERSION_ID < 80400 || "
			+"!class_exists('"+resource+"',false) || method_exists('"+resource+"','sameIdentity') !== "+expected
			+") throw new LogicException('wrong equality surface'); echo 'ok';";
		const status=await vm.run(check);
		assert.equal(status,0,errors+printed);assert.equal(errors,"");assert.equal(printed,"ok");
		printed="";await vm.refresh();
	}
});
