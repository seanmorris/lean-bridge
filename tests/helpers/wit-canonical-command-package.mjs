/** @file Install ordinary and reviewed WIT releases and run an independently compiled application component. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {copyFile,mkdir,mkdtemp,readFile,rename,rm,stat,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename,join,resolve} from "node:path";
import test from "node:test";
import {promisify} from "node:util";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {assertJsonSchema} from "./json-schema.mjs";
import {validateExportConfiguration} from "../../src/analyze/export-configuration.mjs";
import {canonicalAppModel,splitCanonicalTemplate,splitWitApplicationSlots} from "../../src/backends/wit/canonical-app.mjs";

const exec=promisify(execFile),json=async p=>JSON.parse(await readFile(p)),cli=resolve("scripts/lean-bridge.mjs");
const fixture=resolve("tests/fixtures/wit-canonical-command"),latches=resolve("tests/fixtures/wit-canonical-latches");
const tools=process.env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools",input=process.env.LEAN_BRIDGE_PREPARED_WIT_RELEASES;
test("the private guest section cannot collide with an ordinary component name",async t=>{
	const temp=await mkdtemp(join(tmpdir(),"wit-slot-"));t.after(()=>rm(temp,{recursive: true,force: true}));
	const wat=join(temp,"test.wat"),wasm=join(temp,"test.wasm"),marker="lean-bridge-guest-slot-v1";
	const marked='(component (@custom "'+marker+'" "1"))';
	const bin=async source=>{await writeFile(wat,source);await exec(tools,["parse",wat,"-o",wasm]);return readFile(wasm);};
	const original=await bin('(component (component (import "'+marker+'" (func))) '+marked+')');
	const [head,tail]=splitCanonicalTemplate(original);
	assert.ok(head.includes(Buffer.from(marker)));assert.ok(!tail.includes(Buffer.from(marker)));
	for(const bad of ["(component "+marked+" "+marked+")",'(component (component (@custom "'+marker+'" "old")))'])
	{
		const data=await bin(bad);assert.throws(()=>splitCanonicalTemplate(data),/guest slot/u);
	}
	assert.throws(()=>splitCanonicalTemplate(original.subarray(0,original.length-1)),/truncated/u);
	const roles=["objects","callbacks","application"],slot=r=>'(component (@custom "'+marker+'" "'+r+'"))';
	const template=rs=>bin("(component "+rs.map(slot).join(" ")+")");
	const sections=splitWitApplicationSlots(await template(roles),roles);
	assert.equal(sections.length,4);
	const all=await bin("(component (component) (component) (component))");
	const empty=Buffer.concat([Buffer.from([4,8]),all.subarray(0,8)]);
	assert.deepEqual(Buffer.concat(sections.flatMap((b,i)=>i<3?[b,empty]:[b])),all);
	for(const invalid of [roles.slice(1),[...roles,"application"],[...roles].reverse(),["objects","other","application"]])
{
		const b=await template(invalid);assert.throws(()=>splitWitApplicationSlots(b,roles),/guest slot/u);
}
	const nested=await bin("(component (component "+slot("objects")+") "+slot("application")+")");
	assert.throws(()=>splitWitApplicationSlots(nested,["objects","application"]),/guest slot/u);
});
test("canonical scheduling is an explicit WIT-only author choice",async()=>{
	const config=await json(join(fixture,"lean-bridge.exports.json"));
	validateExportConfiguration(config);await assertJsonSchema("lean-export-configuration",config);
	for(const [target,value] of [["wit-wasi","background"],["wit-wasi",true],["c","canonical"]])
	{
		const invalid={...config,targets: {[target]: {name: "latches",version: "1.0.0",asyncAbi: value}}};
		assert.throws(()=>validateExportConfiguration(invalid));await assert.rejects(assertJsonSchema("lean-export-configuration",invalid));
	}
});
test("relocated canonical WIT packages execute a guest against real Lean tasks; no SDK on the consumer path",{timeout: 900000},async t=>{
    const temp=await mkdtemp(join(tmpdir(),"wit-command-"));t.after(()=>rm(temp,{recursive: true,force: true}));
    const guest=join(temp,"application.wasm");
    await exec(tools,["parse",join(fixture,"application.wat"),"-o",guest]);
    await exec(tools,["validate","--features","cm-async,cm-async-builtins",guest]);
    const archives=new Set(),ids=new Set();let ordinary;
    for(const route of ["ordinary","reviewed"])
{
        const out=join(input?resolve(input):temp,route);
        if(!input)
{
            const src=join(temp,route+"-src");await mkdir(src);
            for(const [from,files] of [[fixture,["Immediate.lean","lakefile.toml","lean-bridge.exports.json"]],[latches,["Latches.lean","lean-toolchain"]]])
                for(const name of files) await copyFile(join(from,name),join(src,name));
            if(ordinary) await writeFile(join(src,"latches.binding-ir.json"),canonicalJson(ordinary),{flag: "wx"});
            await exec(process.execPath,[cli,"build","--project",src,"--target","wit-wasi","--output",out,"--json","--progress","none"]);
}
        const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(out,"package-set-receipt.json")});
        await assertJsonSchema("package-set-receipt",receipt);
        assert.equal(receipt.packages.length,1);const [pkg]=receipt.packages,[a]=pkg.artifacts;
        assert.deepEqual([pkg.target,pkg.ecosystem,pkg.runtimeDelivery,pkg.profile],["wit-wasi","wit-wasi","embedded","native-wit-canonical-task-v1"]);
        const api=await json(join(out,"binding-ir.json")),proof=await json(join(out,"host-export-evidence.json"));
        const entries=proof.metadata.entries.map(e=>({...e,name: api.declarations.find(d=>d.source.declaration===e.declaration).name}));
        const model=(decls,es=entries)=>canonicalAppModel({name: "latches",version: "1.0.0",prefix: "lbc_latches",api: {...api,declarations: decls},entries: es});
        const [first,...rest]=api.declarations;
        for(const change of [{capabilities: ["filesystem"]}
            , {resultMode: "async-iterator"}
            , {failure: {...first.failure,mode: "typed"}}
            , {parameters: Array(17).fill(first.parameters[0])}
            , {result: {...first.result,ownership: "lease"}}])
            assert.throws(()=>model([{...first,...change},...rest]),TypeError);
        assert.throws(()=>model(api.declarations,[{...entries[0],declaration: "Other.task"},...entries.slice(1)]),TypeError);
        assert.equal(receipt.profiles[0].bindingIrSha256,hashBindingIr(api));assert.equal(receipt.source.treeSha256,proof.sourceTreeSha256);
        assert.equal(proof.reviewedSourceSha256,ordinary?sha256(canonicalJson(ordinary)):null);
        if(ordinary) assert.deepEqual(api,ordinary);ordinary=api;
        assert.ok(!archives.has(a.sha256));archives.add(a.sha256);
        const area=await mkdtemp(join(temp,"install-")),installed=join(area,"relocated prefix");
        try
{
            await exec("tar",["-xzf",join(out,a.path),"-C",area,"--no-same-owner","--no-same-permissions"]);
            await rename(join(area,basename(a.path,".tar.gz")),installed);
            const inner=await json(join(installed,"lean-bridge-package.json"));
            assert.equal(inner.profile,pkg.profile);assert.equal(inner.runtimeIdentity,pkg.runtimeIdentity);assert.equal(inner.bindingIrSha256,hashBindingIr(api));
            assert.ok(!ids.has(inner.componentIdentity));ids.add(inner.componentIdentity);
            for(const [p,id] of Object.entries(inner.files))
{
                const file=join(installed,p);assert.equal((await stat(file)).size,id.bytes,p);assert.equal(sha256(await readFile(file)),id.sha256,p);
}
            const app=join(installed,inner.command),wit=join(installed,inner.world);
            await exec(tools,["component","targets",wit,guest]);
            assert.deepEqual(await json(join(installed,"share/lean-bridge/binding-ir.json")),api);
            const shared=(await exec("ldd",[app],{env: {PATH: "/usr/bin:/bin"}})).stdout;
            for(const lib of ["liblbc_latches.so","libwasmtime.so","liblean_bridge_native.so","libleanshared.so"])
                assert.ok(shared.split("\n").some(line=>line.includes(lib+" => "+installed+"/") && line.includes("/lib/"+lib)),shared);
            const opts={env: {PATH: "/no-tools-on-consumer-path",RAYON_NUM_THREADS: "1",LEAN_NUM_THREADS: "1"},cwd: area,timeout: 12000};
            assert.equal((await exec(app,[guest],opts)).stdout.trim(),"99999999999999983");
            const wrong=join(area,"wrong.wasm");
            await writeFile(wrong,Buffer.from([0,97,115,109,1,0,0,0]));
            await assert.rejects(exec(app,[wrong],opts),/expected a Component Model binary/u);
            await writeFile(wrong,Buffer.from([0,97,115,109,13,0,1,0]));
            await assert.rejects(exec(app,[wrong],opts),e=>e.code===1 && !e.killed);
            const wat=join(area,"app.wat");
            const compose=async body=>{
                await writeFile(wat,body);await exec(tools,["parse",wat,"-o",wrong]);
            };
            const shell=(imports,additions,body)=>`(component ${imports}
                (core func $ret (canon task.return (result s64)))
                (core module $m (import "" "ret" (func $ret (param i64))) ${additions[0]}
                    (func (export "run") (result i32) ${body}) (func (export "cb") (param i32 i32 i32) (result i32) unreachable))
                (core instance $i (instantiate $m (with "" (instance (export "ret" (func $ret)) ${additions[1]}))))
                (func (export "run") async (result s64) (canon lift (core func $i "run") async (callback (func $i "cb")))))`;
            await compose(shell("",["",""],"(call $ret (i64.const -9223372036854775808)) (i32.const 0)"));
            assert.equal((await exec(app,[wrong],opts)).stdout.trim(),"-9223372036854775808");
            await compose(shell('(import "private" (func $x))',["",""],"unreachable"));
            await assert.rejects(exec(app,[wrong],opts),e=>e.code===1 && !e.killed && /private/u.test(e.stderr));
            await compose(shell('(type $f (future s64)) (import "parked" (func $open (param "slot" u32) (param "value" s64) (result $f))) (core func $open (canon lower (func $open)))',
                ['(import "" "open" (func $open (param i32 i64) (result i32)))','(export "open" (func $open))'],
                '(drop (call $open (i32.const 1) (i64.const 42))) unreachable'));
            await assert.rejects(exec(app,[wrong],opts),e=>e.code===1 && !e.killed && /unreachable/u.test(e.stderr));
            t.diagnostic(route+" "+a.sha256+" — immediate then second then first; orphan closed on exit, exact signed result");
}finally
{await rm(area,{recursive: true,force: true});}
}
});
