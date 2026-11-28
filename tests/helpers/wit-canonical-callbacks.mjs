/** @file Execute the store-owner responder with a real guest-defined Wasm callback. */
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {canonicalCallbackResponder} from "../../src/backends/wit/canonical-callback.mjs";

const run=(command,args,input)=>{
	const r=spawnSync(command,args,{input,env: {...process.env,RAYON_NUM_THREADS: "1"},timeout: 90000});
	if(r.error) throw r.error;
	assert.equal(r.status,0,r.stderr.toString());return r.stdout;
};
const tools=process.env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools";
test("canonical callback consumes requests on success, guest failure and late settlement",async t=>{
	const dir=await mkdtemp(join(tmpdir(),"wit-owner-dispatch-"));t.after(()=>rm(dir,{recursive: true,force: true}));
	const template=await readFile(new URL("../fixtures/wit-canonical-async/callback-dispatch.wat",import.meta.url),"utf8");
	const responder=canonicalCallbackResponder({arg: "bytes",reply: "int64"}).replace("(component","(component $responder");
	const wasm=run(tools,["parse","-"],template.replace(";; INSERT-RESPONDER",()=>responder));
	run(tools,["validate","-"],wasm);
	const file=join(dir,"guest.wasm");await writeFile(file,wasm);
	assert.equal(run(process.env.WASMTIME??"wasmtime",["run","--invoke","run()",file]).toString().trim(),"3");
});
test("the responder lowers all copied callback carriers, including signed subwords and indirect strings and bytes",()=>{
	const names=["bool","char","uint8","int8","uint16","int16","uint32","int32","uint64","int64","float32","float64","string","bytes"];
	for(const [i,arg] of names.entries())
	{
		const reply=names[(i+3)%names.length];
		run(tools,["validate","-"],run(tools,["parse","-"],canonicalCallbackResponder({arg,reply})));
	}
	assert.throws(()=>canonicalCallbackResponder({arg: "pointer",reply: "uint32"}),/Unsupported copied/u);
});
