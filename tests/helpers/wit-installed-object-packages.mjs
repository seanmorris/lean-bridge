/** @file Extract ordinary and reviewed WIT archives and run separately built object guests. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {copyFile,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename,join,resolve} from "node:path";
import {promisify} from "node:util";
import test from "node:test";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {witCoreInterface} from "../../src/backends/wit/application-operations.mjs";
import {prepareNativeHostFixture} from "./native-host-import-check.mjs";
import {extendWitMembers} from "./wit-application-project.mjs";
import {installWitAuthor} from "./wit-installed-author.mjs";
import {assertJsonSchema} from "./json-schema.mjs";

const exec=promisify(execFile),json=async path=>JSON.parse(await readFile(path,"utf8"));
const fixtures=resolve("tests/fixtures/static-host-workers"),wasm=process.env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools";
test("relocated WIT packages execute synchronous Lean IO with application-owned objects",{timeout: 900000},async t=>{
	const root=await mkdtemp(join(tmpdir(),"wit-installed-objects-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const cli=await installWitAuthor(root);
	let original;
	for(const route of ["ordinary","reviewed"])
{
		const work=join(root,route),src=join(work,"source"),out=join(work,"release");
		await mkdir(work);await prepareNativeHostFixture(src,"wit-wasi");await extendWitMembers(src);await copyFile("LICENSE",join(src,"LICENSE"));
		if(original)await writeFile(join(src,"workshop.binding-ir.json"),canonicalJson(original));
		await exec(process.execPath,[cli,"build","--project",src,"--target","wit-wasi","--output",out,"--json","--progress","none"],{cwd: work});
		const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(out,"package-set-receipt.json")});
		await assertJsonSchema("package-set-receipt",receipt);
		assert.equal(receipt.packages.length,1);const [pkg]=receipt.packages,[a]=pkg.artifacts;
		assert.equal(pkg.profile,"native-wit-object-io-v1");assert.equal(pkg.runtimeDelivery,"embedded");
		const relocated=join(work,"extract with spaces");await mkdir(relocated);
		await exec("tar",["-xzf",join(out,a.path),"-C",relocated,"--no-same-owner","--no-same-permissions"]);
		const prefix=join(relocated,"installed");await rename(join(relocated,basename(a.path,".tar.gz")),prefix);
		const meta=await json(join(prefix,"lean-bridge-package.json")),api=await json(join(prefix,"share/lean-bridge/binding-ir.json"));
		assert.deepEqual(meta.inputs,["objects","application"]);assert.equal(meta.bindingIrSha256,hashBindingIr(api));
		for(const [path,digest] of Object.entries(meta.files))
{
			const b=await readFile(join(prefix,path));assert.equal(b.length,digest.bytes,path);assert.equal(sha256(b),digest.sha256,path);
}
		if(original)
{assert.deepEqual(api,original);assert.equal(meta.reviewedSourceSha256,sha256(canonicalJson(original)));}
		else
{assert.equal(meta.reviewedSourceSha256,undefined);original=api;}
		const wit=join(prefix,"wit"),objects=join(wit,"deps/objects.wit");
		const iface=/^package ([^;]+)@1\.0\.0;/u.exec(await readFile(objects,"utf8"))[1]+"/objects@1.0.0";
		const wc=(...args)=>exec(wasm,args,{cwd: work});
		for(const [id,spec,world] of [["guest-box",objects,"owner"],["lean-consumer",wit,"application"]])
{
			const code=(await readFile(join(fixtures,id+".wat.in"),"utf8")).replaceAll("@IFACE@",witCoreInterface(iface)).replaceAll("@OPS@",witCoreInterface("lean-bridge:workshop/api@1.0.0"))
				.replace(";; @installed-drop-observer@","(if (i32.eq (i32.load (local.get $p)) (i32.const 77777)) (then (return (call $result (i32.const 0) (global.get $drops)))))")
				.replace(";; @installed-drop-checks@",`(call $make (i32.const 77777) (i32.const 0)) (local.set $monitor (call $ok))
    (call $read (local.get $monitor) (i32.const 0)) (local.set $before (call $ok))
    (call $expect (i32.eq (call $exercise (i32.const 42) (i32.const 73)) (i32.const 73)))
    (call $read (local.get $monitor) (i32.const 0)) (call $expect (i32.eq (call $ok) (i32.add (local.get $before) (i32.const 3))))
    (call $expect (i32.eq (call $exercise (i32.const -1) (i32.const -2)) (i32.const 105)))
    (call $read (local.get $monitor) (i32.const 0)) (call $expect (i32.eq (call $ok) (i32.add (local.get $before) (i32.const 5))))
    (call $drop (local.get $monitor))`);
			await writeFile(join(work,id+".wat"),code);
			await wc("component","embed",spec,"--world",world,id+".wat","-o",id+".core");await wc("component","new",id+".core","-o",id+".wasm");
			await wc("component","targets",spec,"--world",world,id+".wasm");
}
		await rm(src,{recursive: true});await rm(out,{recursive: true});
		const invoke=(...args)=>exec(join(prefix,meta.command),args,{cwd: work,timeout: 20000,env: {PATH: "/no-tools",RAYON_NUM_THREADS: "1",LEAN_NUM_THREADS: "1"}});
		assert.equal((await invoke("guest-box.wasm","lean-consumer.wasm")).stdout.trim(),"1");
		await assert.rejects(invoke("lean-consumer.wasm","guest-box.wasm"),e=>e.code===1 && /WIT application failed/u.test(e.stderr));
		await writeFile(join(work,"private.wat"),'(component (import "private-exchange" (instance)) (core module $m (func (export "run") (result i64) (i64.const 1))) (core instance $i (instantiate $m)) (func (export "run") (result s64) (canon lift (core func $i "run"))))');
		await wc("parse","private.wat","-o","private.wasm");await wc("validate","private.wasm");
		await assert.rejects(invoke("guest-box.wasm","private.wasm"),e=>e.code===1 && /private-exchange/u.test(e.stderr));
		// Same core ABI, different Component Model contracts. A wrong run type
		// must fail graph validation, before the trapping initializer can run.
		for(const ty of ["u64","s64"])
		{
			const wat='(component (core module $m (func $init unreachable) (start $init) (func (export "f") (result i64) i64.const 1)) (core instance $i (instantiate $m))';
			await writeFile(join(work,ty+".wat"),wat+` (func (export "run") (result ${ty}) (canon lift (core func $i "f"))))`);
			await wc("parse",ty+".wat","-o",ty+".wasm");await wc("validate",ty+".wasm");
			await assert.rejects(invoke("guest-box.wasm",ty+".wasm"),e=>e.code===1 && (ty==="s64"
				? /unreachable/u.test(e.stderr) : /type|ascri/u.test(e.stderr) && !/unreachable/u.test(e.stderr)));
		}
		t.diagnostic(route+" "+a.bytes+" bytes "+a.sha256+" — original owners, exact IO/EIO errors, mutation and cleanup; no SDK on PATH");
		await rm(work,{recursive: true});
}
});
