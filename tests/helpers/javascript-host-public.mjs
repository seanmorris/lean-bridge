/** @file Compile actual source exports, then call them through the generated public binding. */
import assert from "node:assert/strict";
import {appendFile,copyFile,cp,mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {dirname,join,resolve} from "node:path";
import test from "node:test";
import {pathToFileURL} from "node:url";
import {inspectLeanProject} from "../../src/analyze/lean-project.mjs";
import {elaboratedComponent} from "../../src/analyze/semantic-model.mjs";
import {openHostProjectSource} from "../../src/build/host-project-source.mjs";
import {compileJavaScriptHostComponent} from "../../src/build/javascript-wasm-host-component.mjs";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {assembleComponentNpmRuntime} from "../../src/release/component-npm-package.mjs";
import {javascriptSharedRuntimeRequirement} from "../../src/release/owned-javascript-npm-package.mjs";

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
	let source,compiled,hostImports;
	try
	{
		source=await openHostProjectSource({project,inventory,component,targets: ["npm"],leanPrefix: prefix});
		hostImports=source.projectContract.ir;
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
	const main=process.env.LEAN_BRIDGE_RUNTIME_ROOT, target=join(root,"runtime");
	const runtime=await assembleComponentNpmRuntime({mainModule: await readFile(join(main,"main.mjs"))
		, mainWasm: await readFile(join(main,"main.wasm"))
		, runtimeRequirement: javascriptSharedRuntimeRequirement});
	for(const [path,bytes] of runtime.files)
	{const out=join(target,path);await mkdir(dirname(out),{recursive: true});await writeFile(out,bytes);}
	const internal=join(target,"internal");
	const {default: create}=await import(pathToFileURL(join(internal,"main.mjs")));
	const {createComponentRuntime}=await import(pathToFileURL(join(internal,"component-runtime.mjs")));
	let wasm;const links=[];
	const {loadComponent}=await createComponentRuntime(async o=>{
		wasm=await create(o);
		const link=wasm.loadDynamicLibrary.bind(wasm);
		wasm.loadDynamicLibrary=(path,options)=>{links.push(path);return link(path,options);};
		return wasm;
	},pathToFileURL(join(internal,"main.wasm")));
	const componentPath=join(root,"component.wasm"),brokerPath=join(root,"host-domain.wasm");
	await writeFile(componentPath,compiled.binary);await writeFile(brokerPath,compiled.broker);
	const desc={id: compiled.api.component.id
		, buildHash: compiled.abi.componentIdentity
		, sideModule: pathToFileURL(componentPath)
		, integrity: compiled.integrity
		, privateAbi: compiled.abi
		, bindingIr: compiled.api
		, initializer: null
		, hostImports
		, broker: {url: pathToFileURL(brokerPath),integrity: compiled.brokerIntegrity}};
	await assert.rejects(loadComponent({...desc,broker: {...desc.broker,integrity: "0".repeat(64)}}),/broker integrity/);
	await assert.rejects(loadComponent({...desc,privateAbi: {...desc.privateAbi,controlSymbol: "wrong"}}),/descriptor mismatch/);
	await assert.rejects(loadComponent({...desc,sideModule: desc.broker.url,integrity: desc.broker.integrity}),/Wasm interface/);
	assert.deepEqual(links,[]);
	const pending=loadComponent(desc);
	assert.equal(loadComponent(desc),pending);
	const factory=await pending;
	assert.equal(links.length,2);
	const {installWasmHostDomain}=await import(pathToFileURL(join(internal,"wasm-host-loader.mjs")));
	const domain=await installWasmHostDomain(wasm,compiled.broker);
	assert.equal(links.length,2);
	await assert.rejects(loadComponent({...desc,broker: {...desc.broker,integrity: "0".repeat(64)}}),/identity conflict/);
	let creates=0;
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
		assert.equal(domain.live(),0);assert.equal(domain.heldErrors(),0);
		assert.equal(api.dispose(),true);assert.equal(api.dispose(),false);assert.throws(()=>api.read(b),/closed/);
		t.diagnostic("Compiled public IR "+compiled.abi.bindingIrSha256+"; "+compiled.abi.methods.length+" source-derived methods.");
	} finally
	{api.dispose();}
});
