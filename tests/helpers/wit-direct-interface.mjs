/** @file Check the emitted WIT ownership, real component and downstream C declarations. */
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {generateOwnedCValues} from "../../src/backends/c/owned-values.mjs";
import {compileOwnedWitGraphModel} from "../../src/backends/wit/owned-graph-model.mjs";
import {ownedWitPublicPrefix} from "../../src/backends/wit/owned-package.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runNativeTool} from "./native-effect-consumers.mjs";
import {leasedClosureFieldReviewedIr} from "./owned-aggregate-fixture.mjs";
import {assertDirectWitWorld} from "./wit-direct-world.mjs";

test("visitor borrows a callable resource in the compiled WIT world and both client translation units compile",async t=>{
	const ir=leasedClosureFieldReviewedIr({staged: true,incoming: true}),m=compileOwnedWitGraphModel(ir);
	assertDirectWitWorld(m.wit);
	const lines=m.wit.split("\n"),i=lines.findIndex(l=>/invoke-[^:]+: func\(self: borrow<[^>]+>, arg0: borrow<[^>]+>, arg1: u32\) -> u32;/u.test(l));
	assert.notEqual(i,-1);lines[i]=lines[i].replace("arg0: borrow<","arg0: own<");
	assert.throws(()=>assertDirectWitWorld(lines.join("\n")));
	const empty=compileOwnedWitGraphModel(leasedClosureFieldReviewedIr({staged: true}));
	assert.throws(()=>assertDirectWitWorld(empty.wit));
	const w=await mkdtemp(join(tmpdir(),"wit-incoming-api-"));t.after(()=>rm(w,{recursive: true,force: true}));
	const run=(cmd,args)=>runNativeTool(cmd,args,w,process.env);
	await saveLakeFile(w,"world.wit",m.wit);await saveLakeFile(w,"component.wat",m.wat);
	const tool=process.env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools";
	await run(tool,["parse","component.wat","-o","component.wasm"]);
	await run(tool,["validate","--features","component-model","component.wasm"]);
	await run(tool,["component","targets","world.wit","component.wasm"]);
	const values=generateOwnedCValues(ir,{hostCallbacks: true,valueCopies: true,publicPrefix: ownedWitPublicPrefix(ir)});
	assert.ok(values.callbackArgumentViews && !values.anchoredResults);
	await saveLakeFile(w,values.prefix+".h",values.header);
	const files=["tariff-incoming-wasmtime.c","tariff-incoming-wasmtime-observer.c"].map(n=>resolve("tests/fixtures/structured-types",n));
	await run(process.env.CC??"cc",["-std=c11","-Wall","-Wextra","-Werror","-UNDEBUG","-fsyntax-only","-I",w,...files]);
});
