/** @file Exercise a compiled Lean worker with objects owned by a real guest component. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { processBuildRunner } from "../../src/build/process-runner.mjs";

/**
 * Compile and run the fixture against the actual generated interface and native provider.
 *
 * @param root0 - Captured build under test.
 * @param root0.app - Private directory containing the generated headers and shared object.
 * @param root0.runtimeRoot - Verified native Lean runtime for this build.
 * @param root0.b - Compiled WIT provider and its source-derived import contract.
 */
export const exerciseWitApplicationObjects = async ({app,runtimeRoot,b}) => {
	const {wit,interfaceName}=b.witImports;
	const run=async(command,args,env=process.env)=>{
		try
		{ return await processBuildRunner.capture({command,args,cwd: app,env}); }
		catch(e)
		{throw new Error([e.message,e.details?.stderr,e.details?.stdout].filter(Boolean).join("\n"),{cause: e});}
	};
	const wasm=process.env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools";
	const sdk=resolve(process.env.LEAN_BRIDGE_WASMTIME_C_API??".toolchains/wasmtime42");
	const fixture=resolve("tests/fixtures/static-host-workers");
	const data=await readFile(join(fixture,"guest-box.wat.in"),"utf8");
	// The counter is a fixture-owned export, not part of the import contract.
	const diagnostic="world instrumented { export objects; export drops: func() -> u32; export arm-drop: func(); }";
	const peer="world peer { import objects; use objects.{box}; export relay-box: func(value: borrow<box>) -> own<box>; }";
	await writeFile(join(app,"objects.wit"),wit+"\n"+diagnostic+"\n"+peer+"\n");
	const abi=interfaceName.replace(/@1\.0\.0$/u,"@1");
	await writeFile(join(app,"guest.wat"),data.replaceAll("@IFACE@",abi));
	await run(wasm,["component","embed","objects.wit","--world","instrumented","guest.wat","-o","guest.core"]);
	await run(wasm,["component","new","guest.core","-o","guest.wasm"]);
	await run(wasm,["validate","guest.wasm"]);
	const result=await run(wasm,["component","wit","guest.wasm"]);
	assert.ok(result.stdout.includes(interfaceName));
	const peerModule=await readFile(join(fixture,"guest-peer.wat.in"),"utf8");
	await writeFile(join(app,"peer.wat"),peerModule.replaceAll("@IFACE@",abi));
	await run(wasm,["component","embed","objects.wit","--world","peer","peer.wat","-o","peer.core"]);
	await run(wasm,["component","new","peer.core","-o","peer.wasm"]);
	const ownerText=(await run(wasm,["print","guest.wasm"])).stdout;
	const peerText=(await run(wasm,["print","peer.wasm"])).stdout;
	const composed=[
		"(component"
		, ownerText.replace("(component","(component $owner")
		, peerText.replace("(component","(component $peer")
		, "(instance $o (instantiate $owner))"
		, `(alias export $o "${interfaceName}" (instance $objects))`
		, `(export "${interfaceName}" (instance $objects))`
		, '(alias export $objects "box" (type $box))'
		, `(instance $p (instantiate $peer (with "${interfaceName}" (instance $objects)) (with "box" (type $box))))`
		, '(export "relay-box" (func $p "relay-box"))'
		, '(export "drops" (func $o "drops"))'
		, '(export "arm-drop" (func $o "arm-drop"))'
		, ")"
	].join("\n");
	await writeFile(join(app,"composed.wat"),composed);
	await run(wasm,["parse","composed.wat","-o","composed.wasm"]);
	await run(wasm,["validate","composed.wasm"]);
	const mismatches=[
		["signed","%get-level: func() -> result<u32","%get-level: func() -> result<s32"]
		, ["nominal","%identity: func() -> result<own<%box>","%identity: func() -> result<own<%member-error>"]
		, ["failure","%read: func() -> result<u32, own<%member-error>>","%read: func() -> result<u32, own<%box>>"]
	];
	for(const [name,expected,replacement] of mismatches)
	{
		assert.ok(wit.includes(expected));
		await writeFile(join(app,name+".wit"),wit.replace(expected,replacement));
		await run(wasm,["component","embed",name+".wit","--world","owner","--dummy","-o",name+".core"]);
		await run(wasm,["component","new",name+".core","-o",name+".wasm"]);
		await run(wasm,["validate",name+".wasm"]);
	}
	const flags=["-std=gnu11","-g0","-Wall","-Wextra","-Werror","-I.","-I"+join(sdk,"include")];
	const libs=["-L.","-l:"+b.component,"-L"+join(sdk,"lib"),"-lwasmtime","-Wl,-rpath-link,"+join(runtimeRoot,"lib"),"-Wl,-rpath-link,."];
	await run(process.env.CC??"cc",[...flags,join(fixture,"guest-box.c"),...libs,"-o","guest-probe"]);
	const executed=await run(join(app,"guest-probe"),["composed.wasm",interfaceName,...mismatches.map(([name])=>name+".wasm")],{
		PATH: "/no-tools"
		, LD_LIBRARY_PATH: [app,join(sdk,"lib"),join(runtimeRoot,"lib")].join(":")
		, LEAN_NUM_THREADS: "1"
		, RAYON_NUM_THREADS: "1"
	});
	assert.match(executed.stdout,/guest-owned object survived a compiled Lean worker/u);
};
