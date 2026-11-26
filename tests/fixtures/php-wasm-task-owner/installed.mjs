/** @file Run inside the moved application with no build tool or source project on its path. */
import assert from "node:assert/strict";
import {readdir,readFile} from "node:fs/promises";
import {PhpNode} from "php-wasm/PhpNode";
import {exerciseRealms} from "./installed-realms.mjs";
import {closeTaskRuntime,waitTaskRuntimeIdle,taskRuntimeStats} from "@lean-bridge/runtime";

const [mode,...names]=process.argv.slice(2),descriptors=await Promise.all(names.map(async n=>(await import(n)).default));
try
{
	const php=new PhpNode({version: "8.4",autoTransaction: false,shared: {testIdle: ()=>waitTaskRuntimeIdle().then(()=>true)},sharedLibs: descriptors.map(d=>mode==="composer"?d.extensions:d)});
	let stdout="",stderr="";php.addEventListener("output",e=>{stdout+=e.detail.join("");});php.addEventListener("error",e=>{stderr+=e.detail.join("");});
	await php.binary;
	const mount=async dir=>{
		await php.mkdir("/"+dir);
		for(const entry of await readdir(dir,{withFileTypes: true}))
		{
			const path=dir+"/"+entry.name;
			if(entry.isDirectory()) await mount(path);else
			{assert.ok(entry.isFile());await php.writeFile("/"+path,await readFile(path));}
		}
	};
	if(mode==="composer") await mount("vendor");
	await php.writeFile("/test.php",await readFile("installed.php"));
	const boot=mode==="composer"?["/vendor/autoload.php"]:descriptors.map(d=>d.autoload);
	const code=await php.run("<?php "+[...boot,"/test.php"].map(p=>"require '"+p+"';").join(" "));
	assert.equal(code,0,stderr || stdout); assert.equal(stderr,"");
	if(process.env.CHECK_CALLBACK_BUDGET==="1") assert.equal(stdout,"PHP callback budget: once 1, many 2, nested 1, distinct slots 2, fresh task 42");
	else if(process.env.CHECK_PARKED_READER==="1") assert.equal(stdout,"PHP task API: typed await, cancel, release, errors and pull cleanup passed; parked reader cancelled before gate, zero items, late 73, one finalizer");
	else assert.match(stdout,/^PHP (?:task API: typed await, cancel, release, errors and pull cleanup|callback API: reentry, exception identity and cancellation|lease API: cross-package identity, error ownership and disposal|Zend API: installed class bindings, typed errors, scoped cancellation and cursors) passed$/u);
	if(mode==="embedded" && stdout.startsWith("PHP Zend API:")) await exerciseRealms(descriptors[0],true);
	await waitTaskRuntimeIdle(); const stats=taskRuntimeStats();
	for(const k of ["frames","allocations","pending","nativeOwners","notifications",...stats.hostPins===undefined?[]:["hostPins","hostErrors"]]) assert.equal(stats[k],0,k);
	console.log(mode+": "+stdout+"; zero live owners");
} finally
{await closeTaskRuntime();}
