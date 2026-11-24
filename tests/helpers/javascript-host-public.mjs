/** @file Compile actual source exports, then call them through the generated public binding. */
import assert from "node:assert/strict";
import {appendFile,copyFile,cp,mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {pathToFileURL} from "node:url";
import {inspectLeanProject} from "../../src/analyze/lean-project.mjs";
import {elaboratedComponent} from "../../src/analyze/semantic-model.mjs";
import {openHostProjectSource} from "../../src/build/host-project-source.mjs";
import {compileJavaScriptHostComponent} from "../../src/build/javascript-wasm-host-component.mjs";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {bindJavaScriptHostExports} from "../../src/runtime/wasm-host-exports.mjs";
import {installWasmHostDomain} from "../../src/runtime/wasm-host-loader.mjs";

test("source-checked Wasm public calls separate object identity, nested Except, EIO, IO.Error and original JavaScript throws", {timeout: 480_000}, async t=>{
	const root=await mkdtemp(join(tmpdir(),"js-host-public-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const project=join(root,"project"), prefix=process.env.LEAN_BRIDGE_LEAN_PREFIX;
	await cp(resolve("tests/fixtures/javascript-host-meter"),project,{recursive: true});
	await copyFile(resolve("tests/fixtures/javascript-host-wasm/Outcomes.lean"),join(project,"Outcomes.lean"));
	await appendFile(join(project,"lakefile.toml"),'\n[[lean_lib]]\nname = "Outcomes"\n');
	const cfg=join(project,"lean-bridge.exports.json"), config=JSON.parse(await readFile(cfg));
	config.modules.push("Outcomes");config.exports.push("Outcomes.branch","Outcomes.typed","Outcomes.ordinaryFailure");
	await writeFile(cfg,canonicalJson(config));
	const inventory=await inspectLeanProject(project), component=elaboratedComponent(inventory.project);
	let source,compiled;
	try
	{
		source=await openHostProjectSource({project,inventory,component,targets: ["npm"],leanPrefix: prefix});
		const app=join(root,"objects");await mkdir(app);
		compiled=await compileJavaScriptHostComponent({...source
			, app, leanPrefix: prefix
			, emsdkRoot: process.env.LEAN_BRIDGE_JS_EMSDK
			, leanRuntimeRoot: process.env.LEAN_BRIDGE_JS_TARGET_RUNTIME
			, environment: process.env});
		await source.verify();
	} catch(error)
	{t.diagnostic([error.message,error.details?.stderr,error.details?.stdout,error.details?.exports && JSON.stringify(error.details)].filter(Boolean).join("\n"));throw error;}
	finally
	{await source?.dispose();}
	const main=process.env.LEAN_BRIDGE_RUNTIME_ROOT,{default: create}=await import(pathToFileURL(join(main,"main.mjs")));
	const wasm=await create({wasmBinary: await readFile(join(main,"main.wasm"))});assert.equal(wasm._bridge_lean_runtime_init(),1);
	const domain=await installWasmHostDomain(wasm,compiled.broker), file="/public.wasm";
	wasm.FS.writeFile(file,compiled.binary);
	try
	{await wasm.loadDynamicLibrary(file,{global: true,loadAsync: true,nodelete: true});} finally
	{wasm.FS.unlink(file);}
	const symbol=wasm._malloc(128);wasm.HEAP8.set(new TextEncoder().encode(compiled.abi.controlSymbol+"\0"),symbol);
	let poisoned=false,creates=0;
	/** Application-owned implementation of the checked Box contract. */
	class Box
	{
		/**
		 * Construct a real downstream object.
		 *
		 * @param n - Initial reading.
		 */
		constructor(n) {creates++;this.level=n;}
		/** Read through virtual dispatch. */
		read() {return this.level;}
		/** Return the same nominal instance. */
		identity() {return this;}
	}
	const factory=bindJavaScriptHostExports({wasm,domain,abi: compiled.abi
		, model: compiled.model,operation: p=>wasm._bridge_scalar_call(symbol,p)
		, assertOpen: ()=>assert.equal(poisoned,false),poison: ()=>{poisoned=true;}});
	const api=factory.withHosts({Box});
	try
	{
		assert.throws(()=>api.make(-1),RangeError);assert.equal(creates,0);
		const b=api.make(41);assert.ok(b instanceof Box);assert.equal(creates,1);
		assert.equal(api.identity(b),b);assert.equal(api.update(b,42),42);assert.equal(b.level,42);
		assert.throws(()=>api.read({}),/wrong host class/);assert.throws(()=>api.make(),/expects/);
		assert.deepEqual(api.branch(false,b),{ok: {ok: 42}});assert.equal(api.branch(true,b).ok.error,b);
		assert.throws(()=>api.typed(b),e=>e.code==="declared-error" && e.details.errorId==="error:EIO.Outcomes.typed" && e.details.payload.ok===b);
		assert.throws(()=>api.ordinary_failure(7),e=>e.code==="declared-error" && e.details.errorId==="error:IO.Error" && e.details.payload==="reading refused");
		assert.equal(api.ordinary_failure(9),9);
		const original=Object.freeze({code: "declared-error",details: {errorId: "not a Lean error"}});
		b.read=()=>{throw original;};assert.throws(()=>api.read(b),e=>e===original);
		b.read=()=>{throw undefined;};
		let caught=false;try
		{api.read(b);} catch(e)
		{caught=true;assert.equal(e,undefined);} assert.ok(caught);
		assert.throws(()=>api.mapped(b),e=>e.code==="declared-error" && e.details.errorId==="error:EIO.Workshop.mapped" && e.details.payload==="host read failed");
		b.read=()=>-1;assert.throws(()=>api.read(b),RangeError);
		b.read=()=>api.update(b,51);assert.equal(api.read(b),51);
		assert.equal(domain.live(),0);assert.equal(domain.heldErrors(),0);assert.equal(poisoned,false);
		assert.equal(api.dispose(),true);assert.equal(api.dispose(),false);assert.throws(()=>api.read(b),/closed/);
		t.diagnostic("Compiled public IR "+compiled.abi.bindingIrSha256+"; "+compiled.abi.methods.length+" source-derived methods.");
	} finally
	{wasm._free(symbol);}
});
