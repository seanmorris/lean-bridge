/** @file Check generated application-owned host types with the actual Lean compiler. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";
import {promisify} from "node:util";
import {generateLeanHostObjectAdapters} from "../../src/backends/lean/host-object.mjs";
import {staticHostMembers} from "../../src/backends/native/static-host-members.mjs";
import {emitWordHostMembers} from "../../src/backends/native/word-host-members.mjs";

const exec=promisify(execFile);
test("Lean compiles each native host namespace and rejects an object from its neighbor",async t=>{
	const root=await mkdtemp(join(tmpdir(),"nominal-imports-"));
	t.after(()=>rm(root,{recursive: true,force: true}));
	const ir=JSON.parse(await readFile(new URL("../fixtures/javascript-host-meter/lean-bridge.hosts.json",import.meta.url),"utf8"));
	const targets={c: "C",cpp: "Cpp",rust: "Rust","wit-wasi": "WitWasi"};
	ir.types[0].host.targets=Object.keys(targets);
	const generated=generateLeanHostObjectAdapters(ir);
	const prefix=process.env.LEAN_BRIDGE_LEAN_PREFIX;
	const lean=(...args)=>exec(prefix?join(prefix,"bin/lean"):"lean",["-j1","-R",root,...args],
		{cwd: root,env: {...process.env,LEAN_PATH: root,LEAN_NUM_THREADS: "1"},timeout: 120000});
	const names=Object.values(targets);
	let source=names.map(n=>"import LeanBridge.Host."+n).join("\n")+"\n";
	for(const name of names)
	{
		const path="LeanBridge/Host/"+name;
		await mkdir(dirname(join(root,path)),{recursive: true});
		await writeFile(join(root,path+".lean"),generated[path+".lean"]);
		await lean("-o",path+".olean","-c",path+".c",path+".lean");
		const host="LeanBridge.Host."+name+".Box";
		source+="def exercise"+name+" (b : "+host+") (n : UInt32) : IO UInt32 := do\n"
			+"  "+host+".setLevel b n\n  "+host+".getLevel b\n";
	}
	await writeFile(join(root,"Consumer.lean"),source);
	await lean("-c","Consumer.c","Consumer.lean");
	const consumer=await readFile(join(root,"Consumer.c"),"utf8");
	for(const [language,name] of Object.entries(targets))
	{
		const c=consumer+await readFile(join(root,"LeanBridge/Host/"+name+".c"),"utf8");
		for(const member of ["get_level","set_level"])
			assert.ok(c.includes("lean_bridge_host_"+language.replaceAll("-","_")+"_box_"+member),name+"."+member);
	}
	// The provider and Lean compiler must agree in the *same* translation
	// unit, including borrowed receivers, scalar widths and IO results.
	const model=staticHostMembers(ir,"c"), impl=emitWordHostMembers(ir,model,"c");
	const sdk=(await lean("--print-prefix")).stdout.trim();
	const backend=dir=>fileURLToPath(new URL("../../src/backends/"+dir+"/",import.meta.url));
	await writeFile(join(root,"Provider.c"),'#include "LeanBridge/Host/C.c"\n'+impl.header+"\n"+impl.native);
	await exec(process.env.CC??"cc",["-std=gnu11","-Werror=incompatible-pointer-types","-DLB_DN_DOMAIN_PREFIX=checked_domain_",
		"-I"+join(sdk,"include"),"-I"+backend("dotnet"),"-I"+backend("c"),"-c","Provider.c","-o","Provider.o"],{cwd: root});
	const symbols=(await exec("nm",["-g","--defined-only","Provider.o"],{cwd: root})).stdout;
	for(const m of model.members) assert.ok(symbols.split("\n").some(s=>s.endsWith(" T "+m.symbol)),m.symbol);
	for(const [i,name] of names.entries())
	{
		const other=names[(i+1)%names.length];
		await writeFile(join(root,"Wrong.lean"),source+"\ndef wrong (b : LeanBridge.Host."+other+".Box) := exercise"+name+" b 1\n");
		await assert.rejects(lean("Wrong.lean"),e=>e.code===1 && /type mismatch/iu.test(e.stdout+e.stderr)
			&& (e.stdout+e.stderr).includes(other+".Box") && (e.stdout+e.stderr).includes(name+".Box"));
	}
});
