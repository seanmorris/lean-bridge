/** @file Exercise only installed, synchronous Zend bindings; no task-runtime imports. */
import assert from "node:assert/strict";
import {readdir,readFile} from "node:fs/promises";
import {PhpNode} from "php-wasm/PhpNode";
import {exerciseRealms} from "./installed-realms.mjs";

const [mode,...names]=process.argv.slice(2),descriptors=await Promise.all(names.map(async n=>(await import(n)).default));
const php=new PhpNode({version: "8.4",autoTransaction: false,sharedLibs: descriptors.map(d=>mode==="composer"?d.extensions:d)});
let out="",err="";
php.addEventListener("output",e=>{out+=e.detail.join("");});php.addEventListener("error",e=>{err+=e.detail.join("");});
await php.binary;
const mount=async dir=>{
	await php.mkdir("/"+dir);
	for(const f of await readdir(dir,{withFileTypes: true}))
	{
		const path=dir+"/"+f.name;
		if(f.isDirectory())await mount(path);
		else
		{assert.ok(f.isFile());await php.writeFile("/"+path,await readFile(path));}
	}
};
if(mode==="composer")await mount("vendor");
await php.writeFile("/test.php",await readFile("installed.php"));
const bootstrap=mode==="composer"?["/vendor/autoload.php"]:descriptors.map(d=>d.autoload);
const code=await php.run("<?php "+[...bootstrap,"/test.php"].map(p=>"require '"+p+"';").join(" "));
assert.equal(code,0,err||out);assert.equal(err,"");assert.equal(out,"Standalone Zend: synchronous identity, failures, reentry and cleanup passed");
if(mode==="embedded") await exerciseRealms(descriptors[0],false);
console.log(mode+": "+out);
