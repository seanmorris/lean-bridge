/** @file Run inside the moved application with no build tool or source project on its path. */
import assert from "node:assert/strict";
import {readdir,readFile} from "node:fs/promises";
import {PhpNode} from "php-wasm/PhpNode";
import {closeTaskRuntime,waitTaskRuntimeIdle,taskRuntimeStats} from "@lean-bridge/runtime";

const [name,mode]=process.argv.slice(2),{default: descriptor}=await import(name);
try
{
	const php=new PhpNode({version: "8.4",autoTransaction: false,sharedLibs: [mode==="composer"?descriptor.extensions:descriptor]});
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
	const bootstrap=mode==="composer"?"/vendor/autoload.php":descriptor.autoload;
	const code=await php.run("<?php require '"+bootstrap+"'; require '/test.php';");
	assert.equal(code,0,stderr || stdout); assert.equal(stderr,"");assert.match(stdout,/PHP task API: typed await, cancel, release, errors and pull cleanup passed/u);
	await waitTaskRuntimeIdle(); const stats=taskRuntimeStats();
	for(const k of ["frames","allocations","pending","nativeOwners","notifications"]) assert.equal(stats[k],0,k);
	console.log(mode+": "+stdout+"; zero live owners");
} finally
{await closeTaskRuntime();}
