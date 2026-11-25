/** @file Compile an independent application using only a release's public WIT files. */
import assert from "node:assert/strict";
import {cp,mkdir,mkdtemp,readFile,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {witCoreInterface} from "../../src/backends/wit/application-operations.mjs";
import {buildWitApplicationTemplate} from "../../src/build/wit-application-template.mjs";

/**
 * The app provider extends its own registration interface with a constructor.
 * No fixture hook, private exchange export or native scheduler enters the guest.
 *
 * @param o - Public WIT directory, downstream area, wasm-tools and subprocess runner.
 * @param o.wit - Published public WIT directory.
 * @param o.out - Isolated downstream compilation directory.
 * @param o.wasm - Pinned wasm-tools executable.
 * @param o.run - Checked process runner.
 */
export const buildInstalledWitGuests=async({wit,out,wasm,run})=>{
	const fixtures=resolve("tests/fixtures/static-host-workers"),pkg="lean-bridge:workshop/",version="@1.0.0";
	const contract=await readFile(join(wit,"deps/objects.wit"),"utf8");
	const [,objectPackage]=/^package ([^;]+)@1\.0\.0;/u.exec(contract)??[];
	assert.ok(objectPackage);const obj=objectPackage+"/objects"+version,calls=pkg+"callbacks"+version,ops=pkg+"api"+version;
	await mkdir(out,{recursive: true});await cp(wit,join(out,"app-wit"),{recursive: true});
	const save=(file,value)=>writeFile(join(out,file),value);
	const consumer=f=>readFile(join(fixtures,f+".wat.in"),"utf8");
	const cli=(...args)=>run(wasm,args,out);
	const build=async(id,world,code)=>{
		await save(id+".wat",code);await cli("component","embed","app-wit","--world",world,id+".wat","-o",id+".core");
		await cli("component","new",id+".core","-o",id+".wasm");
	};
	const c=await readFile(join(wit,"callbacks.wit"),"utf8");
	assert.ok(c.includes("resource %call-box-to-box {"));
	await save("app-wit/callbacks.wit",c.replace("resource %call-box-to-box {","resource %call-box-to-box { make: static func(mode: u32) -> own<%call-box-to-box>;"));
	await save("owner.wat",(await consumer("guest-box")).replaceAll("@IFACE@",witCoreInterface(obj)));
	await cli("component","embed","app-wit/deps/objects.wit","--world","owner","owner.wat","-o","owner.core");
	await cli("component","new","owner.core","-o","owner.wasm");
	await build("provider","registrations",(await consumer("guest-callback")).replaceAll("@CALLS@",witCoreInterface(calls))
		.replaceAll("@IFACE@",witCoreInterface(obj)).replaceAll("@OPS@",witCoreInterface(ops)));
	await cli("component","targets",wit,"--world","registrations","provider.wasm");
	const app=(await consumer("installed-application")).replaceAll("@OBJECTS@",obj).replaceAll("@CALLBACKS@",calls).replaceAll("@TASKS@",pkg+"object-tasks"+version);
	await save("app.wat",app);await cli("parse","app.wat","-o","application.wasm");
	await cli("component","targets","app-wit","--world","application","application.wasm");
	await save("private.wat",app.replace("(component","(component (import \"series-native-act\" (func (param \"key\" u32) (param \"op\" u32) (result u32)))"));
	await cli("parse","private.wat","-o","private.wasm");await cli("validate","--features","cm-async,cm-async-builtins","private.wasm");
	return ["owner.wasm","provider.wasm","application.wasm"].map(path=>join(out,path));
};

/**
 * Link positive and negative downstream components without using the private
 * worker caller. This gate checks types and isolation, not async execution.
 *
 * @param o - Full compiled worker, pinned wasm-tools and subprocess runner.
 */
export const exerciseMixedWitComposition=async o=>{
	const {app,b,wasm,run}=o,out=await mkdtemp(join(app,"mixed-")),client=join(out,"consumer");
	const common={app,out,b,name: "workshop",version: "1.0.0",wasm,run};
	const template=await buildWitApplicationTemplate(common);
	assert.deepEqual(template.roles,["objects","callbacks","application"]);
	assert.deepEqual(template.methods.map(m=>m.declaration).sort(),b.entries.filter(e=>e.delivery).map(e=>e.declaration).sort());
	const paths=await buildInstalledWitGuests({out: client,wit: join(out,"wit"),wasm,run});
	const header=size=>{
		const bytes=[4];do
		{bytes.push((size&127)|(size>127?128:0));size>>>=7;}while(size);
		return Buffer.from(bytes);
	};
	const graph=async(id,slots)=>{
		const guests=await Promise.all(slots.map(p=>readFile(p)));
		const bytes=template.parts.flatMap((part,i)=>i===guests.length?[part]:[part,header(guests[i].length),guests[i]]);
		await writeFile(join(out,id),Buffer.concat(bytes));
		return run(wasm,["validate","--features","cm-async,cm-async-builtins",id],out);
	};
	await graph("public.wasm",paths);
	await assert.rejects(graph("private.wasm",[...paths.slice(0,2),join(client,"private.wasm")]),e=>
		/series-native-act/u.test([e.message,e.details?.stderr,e.stderr].join(" ")));
};
