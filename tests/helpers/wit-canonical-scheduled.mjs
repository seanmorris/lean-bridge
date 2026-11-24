/** @file Build and run the same ordinary application against ordinary and reviewed native providers. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {cp,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {promisify} from "node:util";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {renderCanonicalFutureProducer} from "../../src/backends/wit/canonical-future.mjs";
import {scheduledApplication} from "./wit-canonical-scheduled-app.mjs";

const exec=promisify(execFile), fixture=resolve("tests/fixtures/wit-canonical-latches");
const json=async path=>JSON.parse(await readFile(path,"utf8"));
const build=async(source,output)=>exec(process.execPath,[resolve("scripts/lean-bridge.mjs"),"build","--project",source,"--target","c","--output",output,"--json","--progress","none"]);
const sdk=process.env.LEAN_BRIDGE_ASYNC_WASMTIME_C_API;
test("two independently parked Lean tasks wake an async WIT consumer without a guest delivery call",{timeout: 900000},async t=>{
    assert.ok(sdk,"Set LEAN_BRIDGE_ASYNC_WASMTIME_C_API to the Wasmtime 51.0.0 C SDK");
    assert.equal(sha256(await readFile(join(sdk,"lib/libwasmtime.so"))),"e3b6f82a76730979875b0c336e573583e1bd9deb052ac44be771e19b1dc51e00");
    const tmp=await mkdtemp(join(tmpdir(),"wit-scheduled-"));t.after(()=>rm(tmp,{recursive: true,force: true}));
    const hashes=new Set();let ordinary;
    for(const route of ["ordinary","reviewed"])
{
        const existing=process.env["LEAN_BRIDGE_CANONICAL_LATCHES_"+route.toUpperCase()];
        const src=join(tmp,route+"-source"),out=existing?resolve(existing):join(tmp,route+"-output");
        if(!existing)
{
            await cp(fixture,src,{recursive: true,errorOnExist: true,force: false});
            if(route==="reviewed") await writeFile(join(src,"latches.binding-ir.json"),canonicalJson(ordinary),{flag: "wx"});
            await build(src,out);
}
        const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(out,"package-set-receipt.json")});
        const ir=await json(join(out,"binding-ir.json")),evidence=await json(join(out,"host-export-evidence.json"));
        assert.deepEqual(receipt.profiles.map(x=>[x.id,x.bindingIrSha256]),[["native-c-task-v1",hashBindingIr(ir)]]);
        assert.equal(evidence.sourceTreeSha256,receipt.source.treeSha256);
        assert.equal(evidence.reviewedSourceSha256,route==="ordinary"?null:sha256(canonicalJson(ordinary)));
        if(route==="ordinary") ordinary=ir;else assert.deepEqual(ir,ordinary);
        const [pkg]=receipt.packages,[a]=pkg.artifacts;
        assert.deepEqual([pkg.name,pkg.version,pkg.profile,pkg.runtimeDelivery],["latches","1.0.0","native-c-task-v1","embedded"]);
        assert.ok(!hashes.has(a.sha256));hashes.add(a.sha256);
        const d=ir.declarations.find(x=>x.source.declaration==="Latches.parked");
        for(const changes of [{resultMode: "value"}
            , {parameters: Array(17).fill(d.parameters[0])}
            , {capabilities: ["net"]}
            , {source: {...d.source,producer: "another"}}
            , {failure: {...d.failure,mode: "typed"}}
            , {result: {...d.result,ownership: "borrow"}}
            , {source: {...d.source,extensions: {...d.source.extensions,"lean-lang.org/effect": "IO"}}}])
            assert.throws(()=>renderCanonicalFutureProducer({...d,...changes}),TypeError);
        for(const slots of [0,1025,1.25]) assert.throws(()=>renderCanonicalFutureProducer(d,slots),TypeError);
        const stage=await mkdtemp(join(tmp,"consumer-"));
        try
{
            const archive=join(out,a.path),files=["include/lbc_latches.h","lib/liblbc_latches.so","lib/liblean_bridge_native.so","lib/libleanshared.so"];
            await exec("tar",["-xzf",archive,"-C",stage,"--strip-components=1","--no-same-owner","--no-same-permissions",...files.map(x=>"latches-1.0.0-c/"+x)]);
            const wat=join(stage,"app.wat"),wasm=join(stage,"app.wasm"),bin=join(stage,"app");
            await writeFile(wat,scheduledApplication(ir),{flag: "wx"});
            const tools=process.env.WASM_TOOLS??"wasm-tools";
            await exec(tools,["parse",wat,"-o",wasm]);await exec(tools,["validate","--features","cm-async,cm-async-builtins",wasm]);
            await exec("cc",["-std=c11","-Wall","-Wextra","-Werror"
                , resolve("tests/fixtures/wit-canonical-async/scheduled.c")
                , "-I"+resolve("src/backends/wit")
                , "-I"+join(stage,"include")
                , "-I"+join(sdk,"include")
                , "-L"+join(stage,"lib")
                , "-L"+join(sdk,"lib")
                , "-Wl,-rpath,"+join(stage,"lib")
                , "-Wl,-rpath,"+join(sdk,"lib")
                , "-llbc_latches"
                , "-lwasmtime"
                , "-o"
                , bin]);
            const env={PATH: "/usr/bin:/bin",RAYON_NUM_THREADS: "1",LEAN_NUM_THREADS: "1"};
            const shared=(await exec("ldd",[bin],{env})).stdout;
            for(const lib of ["liblbc_latches.so","libleanshared.so","liblean_bridge_native.so","libwasmtime.so"])
                assert.ok(shared.includes(lib+" => "+join(lib==="libwasmtime.so"?sdk:stage,"lib",lib)),shared);
            const {stdout}=await exec(bin,[wasm],{cwd: stage,env,timeout: 25000});
            assert.match(stdout,/canonical futures woke the app in order 2,1; exact sum 100000000000000002; both owners consumed/u);
            assert.match(stdout,/shutdown closed the seventh pending owner once/u);
            t.diagnostic(route+" "+a.sha256+": "+stdout.trim());
}finally
{await rm(stage,{recursive: true,force: true});}
}
});
