/** @file Observe cleanup around real native replies and a real Wasmtime trap. */
import assert from "node:assert/strict";
import { readFile,writeFile } from "node:fs/promises";
import { join,resolve } from "node:path";
import { generateWitSyncHost } from "../../src/backends/wit/sync-io-host.mjs";
import { guardWitHostSource } from "../../src/backends/wit/host-evidence.mjs";

/**
 * Relink the test host only. The authentic Lean objects, native wire,
 * broker and Wasmtime store are unchanged. No test symbols ship to consumers.
 *
 * @param o - Wide Journal build, verified runtime and test diagnostics.
 */
export const testWitIOFailures = async o => {
	const {model,app,work,objects,tools,run,cc,runtimeRoot,env,t,dependencies} = o;
	const ix = name=>model.methods.findIndex(m=>m.witName===name);
	const bump = ix("bump"), target = "call $f"+bump+"\n";
	const trapWat = model.wat.replace(target,target+"      unreachable\n");
	assert.notEqual(trapWat,model.wat); await writeFile(join(app,"trap.wat"),trapWat);
	const invoke = (c,args)=>run(c,args,app,env);
	await invoke(tools,["parse","trap.wat","-o","trap.wasm"]);
	await invoke(tools,["component","targets",join(work,"surface.wit"),"trap.wasm"]);
	const h = await generateWitSyncHost(model,await readFile(join(app,"trap.wasm")));
	await writeFile(join(app,"fault-host.c"),guardWitHostSource(h.source,h.prefix,dependencies));
	const sdk = join(app,"wasmtime"), dirs = ["-I",app,"-I",join(sdk,"include"),"-I",join(runtimeRoot,"include")];
	const raw = { CLEAR: model.wire.clear, BUMP: model.wire.methods[bump].symbol
		, BYTES: model.wire.methods[ix("rt-bytes")].symbol
		, STRING: model.wire.methods[ix("rt-string")].symbol };
	const macros = Object.entries(raw).flatMap(([k,v])=>["-DREAL_"+k+"=__real_"+v,"-DWRAP_"+k+"=__wrap_"+v]);
	const wrap = Object.values(raw).map(s=>"-Wl,--wrap="+s);
	const fixtures = resolve("tests/fixtures/wit-sync-io");
	const sources = objects.map(p=>p.slice(0,-2)+".o");
	const params = ["-std=gnu11","-O1","-fPIC","-Wall","-Wextra","-Werror",...dirs];
	// Compile the observer into a private executable rather than exporting
	// counters or a fault selector from a production embedding library.
	await invoke(cc,[...params,...macros,join(fixtures,"observe-wire.c")
		, join(fixtures,"failures.c")
		, "fault-host.c"
		, ...sources
		, "checked-entry.o"
		, "adapter.o"
		, "host-wire.o"
		, ...wrap,"-L",join(sdk,"lib"),"-L",join(runtimeRoot,"lib")
		, "-lwasmtime"
		, "-llean_bridge_native"
		, "-lleanshared"
		, "-ldl"
		, "-pthread"
		, "-lm"
		, "-o"
		, "faults"]);
	for(const mode of [1,2,3,4,5,6])
	{
		const r = await invoke(join(app,"faults"),[String(mode)]);
		assert.equal(r.stderr,"");
		assert.equal(r.stdout.trim(),"fault:"+mode+":"+([2,4].includes(mode)?"ready":"retired")+":seen:1:live:0"); t.diagnostic(r.stdout.trim());
	}
};
