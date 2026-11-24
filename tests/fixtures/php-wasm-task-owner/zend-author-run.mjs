/** @file Execute both PHP author routes, serially, on Node and Chromium. */
import assert from "node:assert/strict";
import {copyFile,mkdtemp,readFile,rm,symlink,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {rollup} from "rollup";
import {phpConversionBudget} from "../../../src/backends/php/copied-support.mjs";
import {bundledBrickMath} from "../../../src/backends/php/brick-math.mjs";
import {sha256} from "../../../src/capsule/node.mjs";
import {readTaskInputs} from "../../../src/release/javascript-wasm-task-inputs.mjs";
import {runInstalledChromium} from "../../helpers/javascript-wasm-installed-browser.mjs";
import {exerciseZendAuthor} from "./zend-author-driver.mjs";

/**
 * Execute the side modules emitted by the ordinary author and reviewed Binding IR.
 *
 * @param options - Paths to both authored components, the threaded SDK and the installed PHP interpreter.
 */
export const runZendAuthorWorkers=async options=>{
	const {stage,sdk,host}=options;
	const verified=await readTaskInputs(sdk),{PhpNode}=await import(pathToFileURL(join(host,"PhpNode.mjs")));
	const {default: factory}=await import(pathToFileURL(join(sdk,"task.mjs")));
	const dir=await mkdtemp(join(tmpdir(),"zwk-")),sources={},brick=bundledBrickMath();
	try
	{
		for(const f of ["host-members","php-wasm-members","php-wasm-task-objects","php-wasm-task-pump","php-wasm-task-callbacks","php-wasm-task-delivery","php-wasm-task-port","php-wasm-io-codec"])
			sources[f]=(await readFile(new URL("../../../src/backends/php/"+f+".php",import.meta.url),"utf8")).replaceAll("__LB_PUBLIC__","Probe");
		sources.budget="<?php namespace Probe\\Internal;\n"+phpConversionBudget;
		sources.check=await readFile(new URL("./zend-author.php",import.meta.url),"utf8");
		await symlink(host,join(dir,"php-wasm"),"dir");await symlink(sdk,join(dir,"sdk"),"dir");
		const bundle=await rollup({input: new URL("./zend-author-driver.mjs",import.meta.url).pathname,external: s=>s.startsWith("node:")});
		try
		{await bundle.write({file: join(dir,"driver.mjs"),format: "es"});}
		finally
		{await bundle.close();}
		await writeFile(join(dir,"index.html"),'<!doctype html><link rel="icon" href="data:,">');
		const evaluate=async input=>{
			const {exerciseZendAuthor: run}=await import("/driver.mjs"),{PhpWeb}=await import("/php-wasm/PhpWeb.mjs");
			const {default: factory}=await import("/sdk/task.mjs");
			return run({...input,factory,Php: PhpWeb,side: new URL(input.side,globalThis.location.href).href});
		};
		for(const route of ["ordinary","reviewed"])
		{
			const file=join(stage,route,"zend-worker.wasm"),descriptor=JSON.parse(await readFile(join(stage,route,"zend-descriptor.json"),"utf8"));
			assert.equal(descriptor.integrity,sha256(await readFile(file)));
			await copyFile(file,join(dir,route+".wasm"));
			const input={sources,brick,descriptor},node=await exerciseZendAuthor({...input,Php: PhpNode,factory,side: pathToFileURL(file).href});
			assert.equal(node.checks.length,34);console.log(JSON.stringify({route,host: "node",sdk: verified.identity,...node}));
			const browser=await runInstalledChromium({root: dir
				, consumer: dir
				, assembledDirectory: dir
				, names: []
				, isolated: true
				, evaluate
				, argument: {...input,side: "/"+route+".wasm"}
				, timeoutMs: 90000});
			assert.deepEqual(browser,node);console.log(JSON.stringify({route,host: "chromium",sdk: verified.identity,...browser}));
		}
	} finally
	{await rm(dir,{recursive: true,force: true});}
};

if(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url)
{
	const [stage,sdk,host]=process.argv.slice(2).map(v=>resolve(v));
	await runZendAuthorWorkers({stage,sdk,host});
}
