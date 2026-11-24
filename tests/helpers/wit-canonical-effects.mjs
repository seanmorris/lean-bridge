/** @file Run the public fallible WIT world against actual ordinary and reviewed Lean releases. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {copyFile,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename,join,resolve} from "node:path";
import test from "node:test";
import {promisify} from "node:util";
import {canonicalArena} from "../../src/backends/wit/canonical-arena.mjs";
import {canonicalAppModel} from "../../src/backends/wit/canonical-app.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";

const exec=promisify(execFile),json=async p=>JSON.parse(await readFile(p)),fixture=resolve("tests/fixtures/wit-canonical-effects");
const tools=process.env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools",prepared=process.env.LEAN_BRIDGE_CANONICAL_EFFECTS_RELEASES;
test("releasing an allocation group reuses its blocks without touching pending writers",async t=>{
    const temp=await mkdtemp(join(tmpdir(),"wit-alloc-"));t.after(()=>rm(temp,{recursive: true,force: true}));
    const wat=join(temp,"arena.wat"),wasm=join(temp,"arena.wasm");
    await writeFile(wat,canonicalArena(65536,1).replace("(core module $mem","(module"));
    await exec(tools,["parse",wat,"-o",wasm]);
    const {instance}=await WebAssembly.instantiate(await readFile(wasm)),{m,select,release,realloc}=instance.exports;
    select(48);const parked=realloc(0,0,1,9);new Uint8Array(m.buffer)[parked]=0xca;
    select(44);const small=realloc(0,0,1,9);new Uint8Array(m.buffer)[small]=0xfe;
    const grown=realloc(small,9,1,65536);assert.equal(new Uint8Array(m.buffer)[grown],0xfe);
    const high=m.buffer.byteLength;release(44);
    for(let i=0;i<4097;i++)
{
        assert.equal(realloc(0,0,1,65536),grown);release(44);
}
    assert.equal(m.buffer.byteLength,high);assert.equal(new Uint8Array(m.buffer)[parked],0xca);
    select(12);assert.equal(realloc(0,0,1,9),small);
    assert.throws(()=>realloc(0,0,1,16777217),WebAssembly.RuntimeError);
    release(12);release(48);
});
test("a relocated component distinguishes factory failure, worker failure and a returned Except",{timeout: 900000},async t=>{
    const temp=await mkdtemp(join(tmpdir(),"wit-errors-"));t.after(()=>rm(temp,{recursive: true,force: true}));
    const guest=join(temp,"app.wasm");await exec(tools,["parse",join(fixture,"application.wat"),"-o",guest]);
    await exec(tools,["validate","--features","cm-async,cm-async-builtins",guest]);
    let ordinary;const digests=new Set();
    for(const route of ["ordinary","reviewed"])
{
        const out=join(prepared?resolve(prepared):temp,route);
        if(!prepared)
{
            const src=join(temp,route+"-src");await mkdir(src);
            for(const f of ["Direct.lean","lean-bridge.exports.json","lakefile.toml"]) await copyFile(join(fixture,f),join(src,f));
            await copyFile(resolve("tests/fixtures/wit-task-package/effects.lean"),join(src,"Meter.lean"));
            await copyFile(resolve("tests/fixtures/wit-canonical-latches/lean-toolchain"),join(src,"lean-toolchain"));
            if(ordinary) await writeFile(join(src,"meter.binding-ir.json"),canonicalJson(ordinary),{flag: "wx"});
            await exec(process.execPath,[resolve("scripts/lean-bridge.mjs"),"build","--project",src,"--target","wit-wasi","--output",out,"--json","--progress","none"]);
            await rm(src,{recursive: true});
}
        const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(out,"package-set-receipt.json")});
        const [pkg]=receipt.packages,[a]=pkg.artifacts;assert.equal(pkg.profile,"native-wit-canonical-task-v1");
        assert.ok(!digests.has(a.sha256));digests.add(a.sha256);
        const api=await json(join(out,"binding-ir.json")),proof=await json(join(out,"host-export-evidence.json"));
        assert.equal(proof.reviewedSourceSha256,ordinary?sha256(canonicalJson(ordinary)):null);
        if(ordinary) assert.deepEqual(api,ordinary);ordinary=api;
        const entries=api.declarations.map(d=>({...proof.metadata.entries.find(e=>e.declaration===d.source.declaration),name: d.name}));
        const build=api=>canonicalAppModel({api,entries,name: "meter",version: "1.0.0",prefix: "lbc_meter"});
        const phase=api.declarations.find(d=>d.name==="phase");
        const wrong=change=>({...api,declarations: api.declarations.map(d=>d===phase?{...d,...change}:d)});
        assert.throws(()=>build(wrong({failure: {...phase.failure,errors: ["error:TaskIO.Error"]}})),/failure contract/u);
        assert.throws(()=>build(wrong({source: {...phase.source,extensions: {...phase.source.extensions,"lean-bridge.dev/task-failure": "Other"}}})),/unsupported export/u);
        assert.throws(()=>build({...api,errors: api.errors.map(e=>e.id==="error:EIO.Meter.checked"?{...e,payload: null}:e)}),/error definition/u);
        const area=await mkdtemp(join(temp,"install-")),prefix=join(area,"relocated effects");
        try
{
            await exec("tar",["-xzf",join(out,a.path),"-C",area,"--no-same-owner","--no-same-permissions"]);
            await rename(join(area,basename(a.path,".tar.gz")),prefix);
            if(!prepared) await rm(out,{recursive: true});
            const inner=await json(join(prefix,"lean-bridge-package.json"));
            await exec(tools,["component","targets",join(prefix,inner.world),guest]);
            assert.equal((await exec(join(prefix,inner.command),[guest],{cwd: area,env: {PATH: "/no-consumer-tools",LEAN_NUM_THREADS: "1",RAYON_NUM_THREADS: "1"},timeout: 15000})).stdout.trim(),String(0xdecafbad));
            t.diagnostic(route+" "+a.sha256+" — 96 factory rejections, 96 read/drop rounds, typed startup/worker/value branches, exact 64-bit bounds and delayed UTF-8/NUL");
} finally
{await rm(area,{recursive: true,force: true});}
}
});
