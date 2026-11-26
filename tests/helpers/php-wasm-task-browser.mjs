/** @file Run the ordinary PHP application in the installed PhpWeb host and a real browser Lean pthread pool. */
import assert from "node:assert/strict";
import {copyFile,readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {runInstalledChromium} from "./javascript-wasm-installed-browser.mjs";

/**
 * Exercise the browser host without access to any package feed.
 *
 * @param options - Test deployment.
 * @param options.root - Test-owned browser scratch.
 * @param options.consumer - Relocated application directory.
 * @param options.name - Installed PHP host module's npm coordinate.
 * @param options.other - Independently installed peer component.
 * @param options.leases - Run the lease application and its pending-worker fault case.
 * @param options.zend - Run the class-bound PHP consumer.
 * @param [options.immediate] - Require the standalone runtime without cross-origin isolation.
 * @param [options.records] - Require the installed object-field and declared-error checks.
 * @param [options.parked] - Check an actual pending read cancelled from a PHP callback.
 */
export const exercisePhpTaskBrowser=async({root,consumer,name,other,leases=false,zend=false,immediate=false,records=false,parked=false})=>{
	const names=other?[name,other]:[name],callbacks=Boolean(other);
	const imports=Object.fromEntries([...names,"@lean-bridge/runtime"].map(n=>[n,"/node_modules/"+n+"/index.mjs"]));
	await writeFile(join(consumer,"index.html"),'<!doctype html><link rel="icon" href="data:,"><script type="importmap">'+JSON.stringify({imports})+'</script>',{flag: "wx"});
	const program=await readFile(join(consumer,"installed.php"),"utf8");
	if(immediate)
	{
		const evaluate=async({names,program})=>{
			const {PhpWeb}=await import("/node_modules/php-wasm/PhpWeb.mjs");
			if(globalThis.crossOriginIsolated)throw new Error("Standalone PHP must work without an isolated page");
			const descriptors=await Promise.all(names.map(async n=>(await import(n)).default)),php=new PhpWeb({version: "8.4",autoTransaction: false,sharedLibs: descriptors});
			let stdout="",stderr="";php.addEventListener("output",e=>{stdout+=e.detail.join("");});php.addEventListener("error",e=>{stderr+=e.detail.join("");});
			await php.binary;await php.writeFile("/test.php",program);
			const rc=await php.run("<?php "+[...descriptors.map(d=>d.autoload),"/test.php"].map(p=>"require '"+p+"';").join(" "));
			return {rc,stdout,stderr};
		};
		const result=await runInstalledChromium({root,consumer,names: [name],isolated: false,assembledDirectory: consumer,timeoutMs: 90000,argument: {names,program},evaluate});
		assert.equal(result.rc,0,result.stderr || result.stdout);assert.equal(result.stderr,"");assert.equal(result.stdout,"Standalone Zend: synchronous identity, failures, reentry and cleanup passed"+(records?"; Zend record and EIO ownership passed":""));
		return "Chromium (no cross-origin isolation): "+result.stdout;
	}
	const faultProgram=await readFile("tests/fixtures/php-wasm-task-owner/"+(leases?"lease-fault.php":callbacks?"callback-fault.php":"fault.php"),"utf8");
	await copyFile("tests/fixtures/php-wasm-task-owner/crash-worker.mjs",join(consumer,"crash-worker.mjs"));
	const evaluate=async({names,program})=>{
		if(!globalThis.crossOriginIsolated) throw new Error("Browser test expected cross-origin isolation");
		const {PhpWeb}=await import("/node_modules/php-wasm/PhpWeb.mjs"),descriptors=await Promise.all(names.map(async n=>(await import(n)).default)),rt=await import("@lean-bridge/runtime");
		try
		{
			const php=new PhpWeb({version: "8.4",autoTransaction: false,shared: {testIdle: ()=>rt.waitTaskRuntimeIdle().then(()=>true)},sharedLibs: descriptors});let stdout="",stderr="";
			php.addEventListener("output",e=>{stdout+=e.detail.join("");});php.addEventListener("error",e=>{stderr+=e.detail.join("");});
			await php.binary;await php.writeFile("/test.php",program);
			const rc=await php.run("<?php "+[...descriptors.map(d=>d.autoload),"/test.php"].map(p=>"require '"+p+"';").join(" "));
			await rt.waitTaskRuntimeIdle();const {frames,pending,allocations,notifications,nativeOwners}=rt.taskRuntimeStats();
			return {rc,stdout,stderr,counts: [frames,pending,allocations,notifications,nativeOwners]};
		} finally
		{await rt.closeTaskRuntime();}
	};
	const result=await runInstalledChromium({root,consumer,names: [name]
		, isolated: true,assembledDirectory: consumer
		, timeoutMs: 90000,argument: {names,program},evaluate});
	assert.equal(result.rc,0,result.stderr || result.stdout);assert.equal(result.stderr,"");assert.equal(result.stdout,zend?"PHP Zend API: installed class bindings, typed errors, scoped cancellation and cursors passed":leases?"PHP lease API: cross-package identity, error ownership and disposal passed":callbacks?"PHP callback API: reentry, exception identity and cancellation passed":"PHP task API: typed await, cancel, release, errors and pull cleanup passed"+(parked?"; parked reader cancelled before gate, zero items, late 73, one finalizer":""));assert.deepEqual(result.counts,[0,0,0,0,0]);
	if(zend) return "Chromium: "+result.stdout+"; zero live owners";
	const crash=async({name,program})=>{
		const Native=globalThis.Worker,workers=[];
		/** Wrap only the Lean SDK's pthreads for this disposable host. */
		globalThis.Worker=class extends Native {
			/**
			 * Start the installed pthread through its test-only fault listener.
			 *
			 * @param url - Worker script.
			 * @param options - Thread creation options.
			 */
			constructor(url,options) {
				const lean=options?.name==="em-pthread" && new URL(url,globalThis.location.href).pathname.endsWith("/internal/task.mjs");
				super(lean?new URL("/crash-worker.mjs",globalThis.location.href):url,options);
				if(lean) workers.push(this);
			}
		};
		const {PhpWeb}=await import("/node_modules/php-wasm/PhpWeb.mjs"),{default: descriptor}=await import(name),rt=await import("@lean-bridge/runtime");
		const testCrash=()=>{
			if(rt.taskRuntimeStats().pending!==1 || !workers.length) throw new Error("No pending PHP task to interrupt");
			return new Promise(done=>{
				for(const w of workers) w.addEventListener("error",()=>setTimeout(()=>done(true),0),{once: true});
				setTimeout(()=>{for(const w of workers) w.postMessage("test:lose-php-task-worker");},0);
			});
		};
		const php=new PhpWeb({version: "8.4",autoTransaction: false,sharedLibs: [descriptor],shared: {testCrash}});
		let out="",err="";php.addEventListener("output",e=>{out+=e.detail.join("");});php.addEventListener("error",e=>{err+=e.detail.join("");});
		await php.binary;await php.writeFile("/test.php",program);
		const rc=await php.run("<?php require '"+descriptor.autoload+"'; require '/test.php';");
		const {state,frames,pending,allocations,notifications}=rt.taskRuntimeStats();
		const reason=await rt.closeTaskRuntime().then(()=>null,e=>e.message);
		return {rc,out,err,state,reason,counts: [frames,pending,allocations,notifications]};
	};
	const lost=await runInstalledChromium({root,consumer,names: [name]
		, isolated: true,assembledDirectory: consumer
		, timeoutMs: 90000,argument: {name,program: faultProgram},evaluate: crash});
	assert.equal(lost.rc,0,lost.err || lost.out);assert.equal(lost.err,"");assert.equal(lost.out,"pending refused;new work refused");
	assert.equal(lost.state,"poisoned");assert.match(lost.reason,/Injected PHP-Wasm lost Lean worker/u);assert.deepEqual(lost.counts,[0,0,0,0]);
	return "Chromium: "+result.stdout+"; zero live owners; lost worker refused pending and new PHP work";
};
