/** @file Link an independently built Wasm application to compiled Lean and a guest object owner. */
import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { witApplicationExchange } from "../../src/backends/wit/application-exchange.mjs";
import { witCoreInterface } from "../../src/backends/wit/application-operations.mjs";

/**
 * Build the owner, exchange, facade and user as distinct typed components.
 *
 * @param o - Captured paths, interface, wasm-tools and checked process runner.
 * @param o.app - Build directory containing the staged exchange and defining guest.
 * @param o.fixture - Source directory of the facade and independent application.
 * @param o.descriptor - WIT imports derived from the compiled Lean application.
 * @param o.wasm - Pinned wasm-tools executable.
 * @param o.run - Checked process runner in the private build directory.
 */
export const buildWitApplicationConsumer = async ({app,fixture,descriptor,wasm,run}) => {
	const x=witApplicationExchange(descriptor),{interfaceName: name}=descriptor;
	const {publicName: ops,nativeName,nativeType,methods}=JSON.parse(await readFile(join(app,"operations-layout.json"),"utf8"));
	for(const dir of ["wit-api","wit-user"])await mkdir(join(app,dir,"deps"),{recursive: true});
	await copyFile(join(app,"exchange.wit"),join(app,"wit-api/deps/objects.wit"));
	await writeFile(join(app,"wit-user/deps/objects.wit"),descriptor.wit);
	await copyFile(join(app,"operations.wit"),join(app,"wit-api/api.wit"));
	await copyFile(join(app,"api.wit"),join(app,"wit-user/deps/api.wit"));
	await writeFile(join(app,"wit-user/user.wit"),`package demo:consumer; world application {
  import ${name}; use ${name}.{box}; import ${ops}; export exercise: func(seed: u32, next: u32) -> u32; export suite: func() -> u32; export bad-input: func(value: borrow<box>);
}`);
	const compile=async(world,source,path)=>{
		await writeFile(join(app,world+".wat"),source);
		await run(wasm,["component","embed",path,"--world",world,world+".wat","-o",world+".core"]);
		await run(wasm,["component","new",world+".core","-o",world+".wasm"]);
		const {stdout}=await run(wasm,["print",world+".wasm"]);
		return stdout.replace("(component","(component $"+world);
	};
	const asset=async file=>(await readFile(join(fixture,file+".wat.in"),"utf8"))
		.replaceAll("@IFACE@",witCoreInterface(name))
		.replaceAll("@OPS@",witCoreInterface(ops));
	await writeFile(join(app,"observed.wit"),descriptor.wit+"\nworld observed { import observe-drop: func(); export objects; export drops: func() -> u32; export arm-drop: func(); }");
	const owner=await compile("observed",(await asset("guest-box"))
		.replace(";; @test-drop-import@",'(import "cm32p2" "observe-drop" (func $notify))')
		.replace(";; @test-drop-notify@","(call $notify)"),"observed.wit");
	const storage=await compile("exchange-storage",await readFile(join(app,"exchange.wat"),"utf8"),"exchange.wit");
	const bridge=await compile("bridge",await readFile(join(app,"operations.wat"),"utf8"),"wit-api");
	const application=await compile("application",await asset("lean-consumer"),"wit-user");
	const userCore=(await run(wasm,["print","application.core"])).stdout;
	const prefix='(import "cm32p2|'+witCoreInterface(ops)+'" "';
	const imported=userCore.split("\n").map(line=>line.trimStart()).filter(line=>line.startsWith(prefix)).map(line=>line.slice(prefix.length).split('"')[0]);
	assert.deepEqual(imported.sort(),methods.map(m=>m.name).sort(),"independent app must import every generated synchronous operation");
	const graph=[
		"(component"
		, `(type $native-type ${nativeType}) (import "${nativeName}" (instance $native (type $native-type)))`
		, '(import "observe-drop" (func $observe))'
		, owner,storage,bridge,application
		, '(instance $o (instantiate $observed (with "observe-drop" (func $observe))))'
		, `(alias export $o "${name}" (instance $objects))`
		, `(export "${name}" (instance $objects))`
		, ...x.slots.map(s=>`(alias export $objects "${s.type}" (type $${s.alias}))`)
		, `(instance $cells (instantiate $exchange-storage (with "${name}" (instance $objects)) ${x.slots.map(s=>`(with "${s.alias}" (type $${s.alias}))`).join(" ")}))`
		, "(instance $exchange "+x.slots.flatMap(s=>[`(export "${s.alias}" (type $${s.alias}))`,...[s.put,s.take].map(f=>`(export "${f}" (func $cells "${f}"))`)]).join(" ")+")"
		, `(instance $b (instantiate $bridge (with "${name}" (instance $objects)) (with "${x.name}" (instance $exchange)) (with "${nativeName}" (instance $native))))`
		, `(instance $client (instantiate $application (with "${name}" (instance $objects)) (with "box" (type $item0)) (with "${ops}" (instance $b "${ops}"))))`
		, '(export "exercise" (func $client "exercise"))'
		, '(export "suite" (func $client "suite"))'
		, '(export "bad-input" (func $client "bad-input"))'
		, '(export "drops" (func $o "drops"))'
		, '(export "private-exchange" (instance $exchange))'
		, ")"
	].join("\n");
	await writeFile(join(app,"client-graph.wat"),graph);
	await run(wasm,["parse","client-graph.wat","-o","client-graph.wasm"]);
	await run(wasm,["validate","client-graph.wasm"]);
};
