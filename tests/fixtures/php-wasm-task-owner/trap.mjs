/** @file A PHP engine error must retire the installed worker even if Lean catches ordinary callback exceptions. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PhpNode} from "php-wasm/PhpNode";
import {taskRuntimeStats,closeTaskRuntime} from "@lean-bridge/runtime";

const descriptors=await Promise.all(process.argv.slice(2).map(async n=>(await import(n)).default));
const php=new PhpNode({version: "8.4",autoTransaction: false,sharedLibs: descriptors});
let out="",err="";
php.addEventListener("output",e=>{out+=e.detail.join("");});
php.addEventListener("error",e=>{err+=e.detail.join("");});
try
{
	await php.binary;await php.writeFile("/trap.php",await readFile("trap.php"));
	const paths=[...descriptors.map(d=>d.autoload),"/trap.php"];
	const rc=await php.run("<?php "+paths.map(p=>"require '"+p+"';").join(" "));
	assert.equal(rc,0,err||out);assert.equal(err,"");
	assert.equal(out,"callback trap preserved; peer refused; new work refused");
	const {state,frames,allocations,pending,notifications}=taskRuntimeStats();
	assert.equal(state,"poisoned");assert.deepEqual([frames,allocations,pending,notifications],[0,0,0,0]);
	await assert.rejects(closeTaskRuntime(),/PHP callback trapped/u);
	console.log(out);
} finally
{ await closeTaskRuntime().catch(()=>{}); }
