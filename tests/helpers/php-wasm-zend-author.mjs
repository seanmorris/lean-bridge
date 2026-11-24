/** @file Compile genuine Lean PHP host imports on the ordinary and reviewed Wasm author routes. */
import assert from "node:assert/strict";
import {mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {inspectLeanProject} from "../../src/analyze/lean-project.mjs";
import {elaboratedComponent} from "../../src/analyze/semantic-model.mjs";
import {reconcileHostExports} from "../../src/analyze/host-export-model.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {openHostProjectSource} from "../../src/build/host-project-source.mjs";
import {compileHostSources} from "../../src/build/host-elaboration.mjs";
import {compileJavaScriptTaskComponent} from "../../src/build/javascript-wasm-task-component.mjs";
import {readTaskInputs} from "../../src/release/javascript-wasm-task-inputs.mjs";
import {javaScriptTaskAbi} from "../../src/abi/javascript-wasm-tasks.mjs";
import {phpWasmHostMembers} from "../../src/backends/php/host-members.mjs";
import {processBuildRunner} from "../../src/build/process-runner.mjs";
import {prepareNativeHostFixture} from "./native-host-import-check.mjs";

const diagnostic=e=>[e.message,e.details?.stderr,e.details?.stdout].filter(Boolean).join("\n");
test("PHP-Wasm workers keep the authored Zend contract and cannot directly call a PHP member",async t=>{
	const env=process.env,keep=env.LEAN_BRIDGE_PHP_ZEND_AUTHOR_OUTPUT,root=await mkdtemp(join(keep??tmpdir(),"zend-author-"));
	const sdk=env.LEAN_BRIDGE_TEST_TASK_INPUTS?await readTaskInputs(resolve(env.LEAN_BRIDGE_TEST_TASK_INPUTS)):null;
	if(!keep) t.after(()=>rm(root,{recursive: true,force: true}));
	if(env.LEAN_BRIDGE_PHP_ZEND_INTERPRETER && !sdk) assert.fail("Executing the Zend helpers requires a verified threaded task SDK");
	const project=join(root,"source"),configPath=join(project,"lean-bridge.exports.json"),main=join(project,"Workshop.lean");
	await prepareNativeHostFixture(project,"php");
	const fixture=resolve("tests/fixtures/php-host-tasks"),source="prelude\n"+await readFile(join(fixture,"Workshop.lean"),"utf8");
	const cfg=JSON.parse(await readFile(join(fixture,"lean-bridge.exports.json"),"utf8"));
	cfg.targets={"php-wasm": {npm: {name: "@example/php-workshop",version: "1.0.0"},composer: {name: "example/php-workshop",version: "1.0.0"}}};
	await writeFile(main,source);await writeFile(configPath,canonicalJson(cfg));
	const compile=async label=>{
		const inventory=await inspectLeanProject(project),component=elaboratedComponent(inventory.project);
		const src=await openHostProjectSource({project,inventory,component,targets: ["php-wasm"]});
		try
		{
			const app=join(root,label);await mkdir(app);
			const ir=src.projectContract.ir,run=(command,args,cwd,env)=>processBuildRunner.capture({command,args,cwd,env});
			const opts={...src,app,ir,target: "php-wasm",environment: env,run};
			const built=sdk && ["ordinary","reviewed"].includes(label)
				? await compileJavaScriptTaskComponent({...opts,phpWasm: true,taskInputs: sdk,emsdkRoot: env.LEAN_BRIDGE_JS_EMSDK})
				: await compileHostSources(opts);
			if(built.binary)
			{
				const {api,binary,componentIdentity,integrity,abi}=built,wasm=new WebAssembly.Module(binary);
				assert.equal(sha256(binary),integrity);assert.ok(WebAssembly.Module.exports(wasm).some(e=>e.name===abi.controlSymbol));
				assert.deepEqual(javaScriptTaskAbi(api,componentIdentity,ir,true),abi);
				assert.throws(()=>javaScriptTaskAbi(api,componentIdentity,ir),/host|classes/u);
				assert.equal(abi.hostKinds[0].hash,phpWasmHostMembers(ir).kinds[0].key);
				assert.equal(abi.methods.find(m=>m.name==="relay").callbackError,"error:PhpCallbackException");
				await writeFile(join(app,"zend-descriptor.json"),canonicalJson({bindingIr: api,hostImports: ir,componentIdentity,integrity,bindingIrSha256: abi.bindingIrSha256,zendObjects: true}));
				await writeFile(join(app,"zend-worker.wasm"),binary);
				t.diagnostic(JSON.stringify({route: label,componentIdentity,integrity,api: abi.bindingIrSha256,sdk: sdk.identity}));
			}
			await src.verify();return {...built,ir,component};
		} finally
{await src.dispose();}
	};
	try
	{
		const ordinary=await compile("ordinary"),{api,evidence,ir,component}=ordinary;
		assert.equal(evidence.selection.phpWasmTaskObjects,true);assert.equal(evidence.selection.phpNativeTaskObjects,undefined);
		assert.equal(evidence.selection.javascriptThreadedHostMembers,undefined);assert.equal(evidence.selection.hostModule,"LeanBridge.Host.Php");
		const fn=n=>api.declarations.find(d=>d.source.declaration==="Workshop."+n);
		const cb=api.types.find(t=>t.id===fn("relay").parameters[1].type.id);
		assert.equal(cb.callable.resultMode,"value");assert.deepEqual(cb.callable.failure.errors,["error:PhpCallbackException"]);
		assert.deepEqual(fn("read").source.extensions["lean-bridge.dev/host-member-phases"],{call: ["LeanBridge.Host.Php.Box.read"]});
		assert.deepEqual(fn("openCursor").source.extensions["lean-bridge.dev/host-member-phases"],{call: [],pull: [],close: []});
		const tamper=selection=>reconcileHostExports({ir,component,metadata: evidence.metadata,selection});
		assert.throws(()=>tamper({...evidence.selection,phpNativeTaskObjects: true}),/Unauthenticated/u);
		assert.throws(()=>tamper({...evidence.selection,nativeEffects: ["filesystem"]}),/Unauthenticated/u);
		const reviewed=canonicalJson(api);await writeFile(join(project,"workshop.binding-ir.json"),reviewed);
		delete cfg.exports;await writeFile(configPath,canonicalJson(cfg));
		const second=await compile("reviewed");assert.deepEqual(second.api,api);assert.equal(second.evidence.reviewedSourceSha256,sha256(reviewed));
		await writeFile(main,source.replace("IO.asTask (f box)","IO.asTask do\n    let _ ← box.read\n    f box"));
		await assert.rejects(compile("direct-member"),e=>/PHP-Wasm worker calls a PHP member outside its owner/u.test(diagnostic(e)));
		await writeFile(main,source.replace(":= box.read",":= do\n  let t ← BaseIO.asTask box.read.toBaseIO\n  match t.get with\n  | .ok v => return v\n  | .error e => throw e"));
		await assert.rejects(compile("blocking-owner"),e=>/can block the PHP-Wasm host owner/u.test(diagnostic(e)));
		if(env.LEAN_BRIDGE_PHP_ZEND_INTERPRETER)
		{
			const {runZendAuthorWorkers}=await import("../fixtures/php-wasm-task-owner/zend-author-run.mjs");
			await runZendAuthorWorkers({stage: root,sdk: resolve(env.LEAN_BRIDGE_TEST_TASK_INPUTS),host: resolve(env.LEAN_BRIDGE_PHP_ZEND_INTERPRETER)});
		}
		t.diagnostic("Checked Zend source and review: "+sha256(reviewed)+" in "+root);
	} catch(e)
{t.diagnostic(diagnostic(e).slice(-3500));throw e;}
});
