/** @file Exercise the owner-thread scheduling boundary from an async Wasm guest. */
import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";

/**
 * Use the real source-compiled Workshop.update and the separately compiled
 * owner with its own destructor counter. Both are built by the worker test.
 *
 * @param o - Checked paths, native artifact and runner for this fixture.
 */
export const exerciseWitApplicationTurn=async o=>{
	const {app,b,fixture,kit,wasm,runtimeRoot,run}=o;
	const owner=(await run(wasm,["print","guest.wasm"])).stdout;
	const template=await readFile(join(fixture,"guest-turn.wat.in"),"utf8");
	const graph=template.replace("@OWNER@",()=>owner.replace("(component","(component $owner"))
		.replaceAll("@OBJECTS@",b.witImports.interfaceName);
	assert.ok(graph.includes(";; @inject-guest-trap@"));
	for(const [id,code] of [["guest-turn",graph],["guest-turn-trap",graph.replace(";; @inject-guest-trap@","unreachable")]])
	{
		await writeFile(join(app,id+".wat"),code);await run(wasm,["parse",id+".wat","-o",id+".wasm"]);
		await run(wasm,["validate","--features","cm-async,cm-async-builtins",id+".wasm"]);
	}
	const flags=["-std=gnu11","-O1","-g0","-Wall","-Wextra","-Werror","-pthread","-I."];
	const includes=["-I"+resolve("src/backends/wit"),"-I"+join(kit,"include")];
	const libs=["-L.","-l:"+b.component,"-L"+join(kit,"lib"),"-lwasmtime"];
	const paths=["-Wl,-rpath-link,"+join(runtimeRoot,"lib"),"-Wl,-rpath-link,."];
	await run(process.env.CC??"cc",[...flags,...includes,join(fixture,"guest-turn.c"),...libs,...paths,"-o","guest-turn"]);
	const env={PATH: "/no-tools",LEAN_NUM_THREADS: "1",RAYON_NUM_THREADS: "1",LD_LIBRARY_PATH: [app,join(kit,"lib"),join(runtimeRoot,"lib")].join(":")};
	const r=await run(join(app,"guest-turn"),["guest-turn.wasm","guest-turn-trap.wasm"],env);
	assert.match(r.stdout,/async guest: original box 42 -> 73; original getter error; two Lean frames disposed/u);
	assert.match(r.stdout,/trapped async guest: parked Lean call unwound once on its owner before store destruction/u);
};
