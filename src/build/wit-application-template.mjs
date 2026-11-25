/** @file Build and validate the fixed Wasm graph that a published application runner embeds. */
import {copyFile,mkdir,readFile,writeFile} from "node:fs/promises";
import {dirname,join} from "node:path";
import {witApplicationCommand,witCommandHeader} from "../backends/wit/application-command.mjs";
import {splitWitApplicationSlots} from "../backends/wit/canonical-app.mjs";

// A type witness only. No dummy body is included in the packaged template.
const witness=`(component
  (core module $m (func (export "run") (result i32) unreachable) (func (export "cb") (param i32 i32 i32) (result i32) unreachable))
  (core instance $i (instantiate $m))
  (func (export "run") async (result s64) (canon lift (core func $i "run") async (callback (func $i "cb")))))`;
const syncWitness='(component (core module $m (func (export "run") (result i64) unreachable)) (core instance $i (instantiate $m)) (func (export "run") (result s64) (canon lift (core func $i "run"))))';

/**
 * Validate a complete publisher-built graph before removing the consumer
 * slots. Only public WIT and the inter-slot binary bytes belong in a release.
 *
 * @param o - Compiled native worker result, staging directories and pinned wasm-tools runner.
 */
export const buildWitApplicationTemplate=async o=>{
	const {app,out,b,name,version,wasm,run}=o;
	const read=file=>readFile(join(app,file),"utf8"),json=async file=>JSON.parse(await read(file));
	const local=f=>join(out,f),save=async(f,bytes)=>{await mkdir(dirname(local(f)),{recursive: true});await writeFile(local(f),bytes,{flag: "wx"});};
	const cli=(...args)=>run(wasm,args,out);
	if(!/^wasm-tools 1\.245\.1\b/u.test((await cli("--version")).stdout))throw new Error("WIT object applications require wasm-tools 1.245.1");
	const ops=await json("operations-layout.json"),async=b.entries.some(e=>e.delivery);
	const delivery=async?await json("object-delivery.json"):null,callbacks=async?await json("object-callbacks.json"):null;
	const registered=delivery?.supported.some(m=>m.shape==="callback");
	const publicFiles={"deps/objects.wit": b.witImports.wit,"api.wit": await read("api.wit")};
	if(async)publicFiles["object-tasks.wit"]=await read("object-tasks.wit");
	if(registered)publicFiles["callbacks.wit"]=await read("object-callbacks.wit");
	for(const [file,value] of Object.entries(publicFiles))await save("wit/"+file,value);
	await save("bridge/deps/objects.wit",await read("exchange.wit"));await save("bridge/bridge.wit",await read("operations.wit"));
	const compile=async(id,dir,world,core)=>{
		if(core)await save(id+".wat",core);
		await cli("component","embed",dir,"--world",world,...core?[id+".wat"]:["--dummy"],"-o",id+".core");
		await cli("component","new",id+".core","-o",id+".wasm");
		return (await cli("print",id+".wasm")).stdout;
	};
	const modules={};
	modules.owner=await compile("owner","wit/deps/objects.wit","owner");
	modules.exchange=await compile("cells","bridge/deps/objects.wit","exchange-storage",await read("exchange.wat"));
	modules.facade=await compile("api","bridge","bridge",await read("operations.wat"));
	if(registered)modules.callbacks=await compile("callbacks","wit","callback-provider");
	if(async)
	{
		if(!delivery || delivery.remaining?.length)throw new Error("WIT application contains an unsupported task or cursor");
		modules.tasks=await read("object-turn-tasks.wat");modules.syncPorts=await read("turn-sync-ports.wat");
		modules.members=await read("turn-members.wat");modules.native=await read("turn-native.wat");
	}
	modules.application=async?witness:syncWitness;
	const result=witApplicationCommand({descriptor: b.witImports,ops,delivery,callbacks,entries: b.entries,modules,name,version});
	await save("wit/application.wit",result.world);publicFiles["application.wit"]=result.world;
	await save("consumer.wat",modules.application);await cli("parse","consumer.wat","-o","consumer.wasm");
	await cli("component","targets","wit","--world","application","consumer.wasm");
	await save("command.wat",result.wat);await cli("parse","command.wat","-o","command.wasm");
	await cli("validate","--features","cm-async,cm-async-builtins","command.wasm");
	const bytes=await readFile(local("command.wasm"));
	return {publicFiles,roles: result.roles,parts: splitWitApplicationSlots(bytes,result.roles),methods: delivery?.supported??[],transport: result.transport};
};

/**
 * Compile the relocatable runner against the same domain as the Lean worker.
 * The packaging caller pins the SDK and validates ELF dependencies and glibc.
 *
 * @param o - Build inputs, verified template, native runtime and publisher SDK.
 */
export const compileWitApplicationCommand=async o=>{
	const {app,out,b,name,template,cc,sdk,runtimeRoot,run}=o,binary=name+"-run";
	await writeFile(join(out,"application-command.h"),witCommandHeader(template,b.entries,name),{flag: "wx"});
	const mixed=template.methods.length>0;
	await copyFile(new URL("../backends/wit/"+(mixed?"application-command-turn.c":"application-command.c"),import.meta.url),join(out,"application-command.c"));
	await copyFile(new URL("../backends/wit/application-command-inputs.h",import.meta.url),join(out,"application-command-inputs.h"));
	await run(cc,[
		"-std=gnu11"
		, "-O1","-g0","-Wall","-Wextra","-Werror","-I"+app,"-I"+join(sdk,"include")
		, "-ffile-prefix-map="+out+"=/build/wit-command"
		, "-ffile-prefix-map="+app+"=/build/wit-provider"
		, ...mixed?["-pthread"]:[], "application-command.c"
		, "-L"+app
		, "-L"+join(sdk,"lib")
		, "-l:"+b.component
		, "-lwasmtime"
		, "-Wl,-rpath-link,"+app
		, "-Wl,-rpath-link,"+join(runtimeRoot,"lib")
		, "-Wl,-z,now,--build-id=none,-rpath,$ORIGIN/../lib"
		, "-o"
		, binary],out);
	return binary;
};
