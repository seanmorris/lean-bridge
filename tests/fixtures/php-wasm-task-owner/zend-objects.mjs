/** @file Run the current Zend owner against receipt-verified, compiled pthread Wasm. */
import assert from "node:assert/strict";
import {readFile,writeFile,symlink} from "node:fs/promises";
import {rollup} from "rollup";
import {runInstalledChromium} from "../../helpers/javascript-wasm-installed-browser.mjs";
import {exerciseZendObjects} from "./zend-object-driver.mjs";
import {join,resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {phpConversionBudget} from "../../../src/backends/php/copied-support.mjs";
import {bundledBrickMath} from "../../../src/backends/php/brick-math.mjs";
import {sha256} from "../../../src/capsule/node.mjs";


const [dir,host,release,other]=process.argv.slice(2),root=resolve(dir,"node_modules");
const read=async path=>JSON.parse(await readFile(path,"utf8"));
const stages=[],sources={};
for(const [name,stage] of [["@lean-bridge/workshop-host-example",release],["@example/threaded-host-peer",other]])
{
	const manifest=await read(join(stage,"javascript-wasm-task-release.json")),pkg=join(root,name);
	const bindingIr=await read(join(pkg,"metadata/binding-ir.json")),hostImports=await read(join(pkg,"metadata/host-imports.json"));
	const side=join(pkg,"internal/component.wasm"),integrity=sha256(await readFile(side));
	const {componentIdentity,bindingIrSha256}=manifest,pin=(await read(join(pkg,"package.json"))).leanBridge;
	assert.equal(componentIdentity,pin.componentIdentitySha256);assert.equal(bindingIrSha256,pin.bindingIrSha256);
	stages.push({name,descriptor: {bindingIr,componentIdentity,bindingIrSha256,hostImports,integrity}});
}
assert.notEqual(stages[0].descriptor.integrity,stages[1].descriptor.integrity);
for(const f of ["php-wasm-task-objects","php-wasm-task-pump","php-wasm-task-callbacks","php-wasm-task-delivery","php-wasm-task-port","php-wasm-io-codec"])
	sources[f]=(await readFile(new URL("../../../src/backends/php/"+f+".php",import.meta.url),"utf8")).replaceAll("__LB_PUBLIC__","Probe");
sources.budget="<?php namespace Probe\\Internal;\n"+phpConversionBudget;
sources.check=await readFile(new URL("./zend-objects.php",import.meta.url),"utf8");
const {default: factory}=await import(pathToFileURL(join(root,"@lean-bridge/runtime/internal/task.mjs")));
const {PhpNode}=await import(pathToFileURL(join(resolve(host),"PhpNode.mjs")));
const brick=bundledBrickMath();
const node=await exerciseZendObjects({factory,Php: PhpNode,sources,stages,brick,side: name=>pathToFileURL(join(root,name,"internal/component.wasm")).href});
assert.ok(node.checks>=15);console.log(JSON.stringify({host: "node",...node}));
await symlink(resolve(host),join(root,"php-wasm"),"dir");
const bundle=await rollup({input: new URL("./zend-object-driver.mjs",import.meta.url).pathname,external: s=>s.startsWith("node:")});
try
{await bundle.write({file: join(dir,"driver.mjs"),format: "es"});} finally
{await bundle.close();}
await writeFile(join(dir,"index.html"),'<!doctype html><link rel="icon" href="data:,">');
const evaluate=async input=>{
	if(!globalThis.crossOriginIsolated) throw new Error("The Lean pthread needs isolation");
	const {exerciseZendObjects: run}=await import("/driver.mjs"),{PhpWeb}=await import("/node_modules/php-wasm/PhpWeb.mjs");
	const {default: factory}=await import("/node_modules/@lean-bridge/runtime/internal/task.mjs");
	return run({...input,factory,Php: PhpWeb,side: name=>new URL("/node_modules/"+name+"/internal/component.wasm",globalThis.location.href).href});
};
const browser=await runInstalledChromium({root: dir,consumer: dir,names: []
	, assembledDirectory: dir
	, isolated: true,evaluate,argument: {sources,stages,brick},timeoutMs: 90000});
assert.deepEqual(browser,node);console.log(JSON.stringify({host: "chromium",...browser}));
