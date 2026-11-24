/** @file Exercise actual future and stream transfers across two Component Model instances. */
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";

import {canonicalChannelFixture} from "./wit-canonical-fixture.mjs";
import {sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
const run=(cmd,args,input)=>{
	const result=spawnSync(cmd,args,{input,timeout: 90000,env: {...process.env,RAYON_NUM_THREADS: "1"}});
	if(result.error) throw result.error;
	assert.equal(result.status,0,result.stderr.toString());return result.stdout;
};
for(const kind of ["future","stream"]) test("a canonical "+kind+" crosses component instances and wakes a blocked reader",async t=>{
	const root=await mkdtemp(join(tmpdir(),"wit-canonical-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const wasm=run(process.env.WASM_TOOLS??"wasm-tools",["parse","-"],canonicalChannelFixture(kind));
	run(process.env.WASM_TOOLS??"wasm-tools",["validate","--features","cm-async,cm-async-builtins","-"],wasm);
	const file=join(root,"pair.wasm");await writeFile(file,wasm,{flag: "wx"});
	const result=run(process.env.WASMTIME??"wasmtime",["run","-W","component-model-async=y,component-model-async-builtins=y","--invoke","run(4294967291)",file]);
	assert.equal(result.toString().trim(),"4294967291");
});

const releases=process.env.LEAN_BRIDGE_CANONICAL_PULSE_RELEASES,sdk=process.env.LEAN_BRIDGE_ASYNC_WASMTIME_C_API;
if(releases || sdk || process.env.LEAN_BRIDGE_CANONICAL_LEAN_TEST==="1") test("source-free ordinary and reviewed Lean packages deliver signed values through canonical futures",async t=>{
	assert.ok(releases && sdk,"Supply the two Pulse releases and the v51 Wasmtime C SDK");
	assert.equal(sha256(await readFile(join(sdk,"lib/libwasmtime.so"))),"e3b6f82a76730979875b0c336e573583e1bd9deb052ac44be771e19b1dc51e00");
	const identities=new Set();
	for(const route of ["ordinary","reviewed"])
	{
		const from=resolve(releases,route),{receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(from,"package-set-receipt.json")});
		assert.deepEqual(receipt.profiles.map(p=>p.id),["native-c-task-v1"]);
		const pkg=receipt.packages.find(p=>p.name==="pulse");assert.ok(pkg);const [a]=pkg.artifacts;
		const prior=JSON.parse(await readFile(join(from,"acceptance.json"),"utf8"));
		assert.equal(prior.route,route);assert.equal(prior.result,"passed");assert.deepEqual(prior.archive,a);
		assert.ok(!identities.has(a.sha256));identities.add(a.sha256);
		const root=await mkdtemp(join(tmpdir(),"wit-lean-future-"));
		try
		{
			// Extract only the public consumer files; never compile the author tree.
			const paths=["include/lbc_pulse.h","lib/liblbc_pulse.so","lib/liblean_bridge_native.so","lib/libleanshared.so"];
			run("tar",["-xzf",join(from,a.path),"-C",root,"--strip-components=1","--no-same-owner","--no-same-permissions",...paths.map(p=>"pulse-1.0.0-c/"+p)]);
			const wasm=run(process.env.WASM_TOOLS??"wasm-tools",["parse","-"],canonicalChannelFixture("future",true));
			run(process.env.WASM_TOOLS??"wasm-tools",["validate","--features","cm-async,cm-async-builtins","-"],wasm);
			const file=join(root,"app.wasm"),app=join(root,"read-future");await writeFile(file,wasm,{flag: "wx"});
			const source=resolve("tests/fixtures/wit-canonical-async/native.c");
			run("cc",["-std=c11","-Wall","-Wextra","-Werror",source
				, "-I"+join(root,"include")
				, "-I"+join(sdk,"include")
				, "-L"+join(root,"lib")
				, "-L"+join(sdk,"lib")
				, "-Wl,-rpath,"+join(root,"lib")
				, "-Wl,-rpath,"+join(sdk,"lib")
				, "-llbc_pulse"
				, "-lwasmtime"
				, "-o"
				, app]);
			const shared=run("ldd",[app]).toString();
			for(const lib of ["liblbc_pulse.so","libleanshared.so","liblean_bridge_native.so","libwasmtime.so"])
				assert.ok(shared.includes(lib+" => "+join(lib==="libwasmtime.so"?sdk:root,"lib",lib)),shared);
			const output=run(app,[file]).toString().trim();assert.match(output,/three parked Lean tasks crossed canonical future<s64>/u);
			t.diagnostic(route+" "+a.sha256+": "+output);
		} finally
{await rm(root,{recursive: true,force: true});}
	}
});
