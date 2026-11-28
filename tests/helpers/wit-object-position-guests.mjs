/** @file Compile the downstream provider and caller using the installed public WIT files. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {cp,mkdir,readFile,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {promisify} from "node:util";
import {witCoreInterface} from "../../src/backends/wit/application-operations.mjs";
import {sha256} from "../../src/capsule/node.mjs";

const exec=promisify(execFile);
const fixture=resolve("tests/fixtures/static-host-workers");
/**
 * Add only downstream construction and inspection to the registration interface.
 * The publisher still owns the unmodified API, callback and task types.
 *
 * @param wit - WIT directory in the installed package.
 * @param out - Fresh consumer directory, with no publisher dependencies.
 * @param wasm - Path to wasm-tools.
 */
export async function buildObjectPositionGuests(wit,out,wasm)
{
	await mkdir(out,{recursive: true});
	const world=join(out,"public");await cp(wit,world,{recursive: true});
	const callbacks=join(world,"callbacks.wit"),original=await readFile(callbacks,"utf8");
	const capture="capture: static func(input: own<%box>, reply: own<%box>) -> own<%call-box-to-box>;";
	const patched=original.replace("resource %call-box-to-box {","released-captures: func() -> u32;\n  resource %call-box-to-box { "+capture);
	assert.notEqual(patched,original);await writeFile(callbacks,patched);
	const [,pkg]=/^package ([^;]+)@1\.0\.0;/u.exec(original);
	const [,objects]=/use (\S+\/objects@1\.0\.0)\.\{/u.exec(original);
	const names={OBJECTS: objects,CALLS: pkg+"/callbacks@1.0.0",API: pkg+"/api@1.0.0",TASKS: pkg+"/object-tasks@1.0.0"};
	const sources={},guests={};
	const source=async name=>{
		const bytes=await readFile(join(fixture,name));sources[name]=sha256(bytes);return bytes.toString();
	};
	const tool=(...args)=>exec(wasm,args,{cwd: out,maxBuffer: 1<<20});
	const embed=async(name,dir,worldName,code)=>{
		await writeFile(join(out,name+".wat"),code);
		await tool("component","embed",dir,"--world",worldName,name+".wat","-o",name+".core");
		await tool("component","new",name+".core","-o",name+".wasm");
	};
	const interpolate=(s,core)=>s.replace(/@(OBJECTS|CALLS|API|TASKS)@/gu,(_,k)=>core?witCoreInterface(names[k]):names[k]);
	await embed("owner",join(world,"deps/objects.wit"),"owner",(await source("guest-box.wat.in")).replaceAll("@IFACE@",witCoreInterface(objects)));
	const provider=interpolate(await source("object-swap-provider.wat.in"),true);
	for(const [id,captured] of [["swap","$reply"],["echo","$input"]])
	{
		await embed(id,world,"registrations",provider.replace("@RETURNED_BOX@",()=>captured));
		await tool("component","targets",wit,"--world","registrations",id+".wasm");
	}
	await writeFile(join(out,"app.wat"),interpolate(await source("object-swap-application.wat.in"),false));
	await tool("parse","app.wat","-o","app.wasm");
	await tool("component","targets",world,"--world","application","app.wasm");
	for(const id of ["owner","swap","echo","app"]) guests[id]=sha256(await readFile(join(out,id+".wasm")));
	return {sources,guests};
}
