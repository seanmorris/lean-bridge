/** @file Verify demand, cancellation and terminal ordering against installed compiled Lean cursors. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {copyFile,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename,join,resolve} from "node:path";
import test from "node:test";
import {promisify} from "node:util";
import {canonicalAppModel} from "../../src/backends/wit/canonical-app.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";

const exec=promisify(execFile),json=async p=>JSON.parse(await readFile(p)),fixture=resolve("tests/fixtures/wit-canonical-stream");
const tools=process.env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools",cli=resolve("scripts/lean-bridge.mjs");
const prepare=async(src,route,ordinary)=>{
	await mkdir(src);
	await copyFile(join(fixture,"Observe.lean"),join(src,"Observe.lean"));
	await copyFile(resolve("tests/fixtures/wit-task-package/cursors.lean"),join(src,"Meter.lean"));
	await copyFile(resolve("tests/fixtures/wit-canonical-latches/lean-toolchain"),join(src,"lean-toolchain"));
	let lake=await readFile(join(fixture,"lakefile.toml"),"utf8");const config=await json(join(fixture,"lean-bridge.exports.json"));
	if(route==="mixed")
	{
		await copyFile(resolve("tests/fixtures/wit-canonical-latches/Latches.lean"),join(src,"Latches.lean"));
		lake+='\n[[lean_lib]]\nname = "Latches"\n';config.modules.push("Latches");
		config.exports.push("Latches.parked","Latches.release");config.taskExports=["Latches.parked"];
	}
	if(route==="reviewed" || route==="drift") await writeFile(join(src,"meter.binding-ir.json"),canonicalJson(ordinary),{flag: "wx"});
	if(route==="drift") config.asyncIterators[0].close="Meter.alternateFinish";
	await writeFile(join(src,"lakefile.toml"),lake);if(route==="ordinary" || route==="reviewed") await copyFile(join(fixture,"lean-bridge.exports.json"),join(src,"lean-bridge.exports.json"));
	else await writeFile(join(src,"lean-bridge.exports.json"),canonicalJson(config));
};
const build=(src,out)=>exec(process.execPath,[cli,"build","--project",src,"--target","wit-wasi","--output",out,"--json","--progress","none"]);
test("a relocated Wasm guest pulls real Lean cursors only on demand and closes them once",{timeout: 900000},async t=>{
    const temp=await mkdtemp(join(tmpdir(),"canonical-stream-"));t.after(()=>rm(temp,{recursive: true,force: true}));
    const apps={};
    for(const app of ["application","mixed"])
{
        apps[app]=join(temp,app+".wasm");
        await exec(tools,["parse",join(fixture,app+".wat"),"-o",apps[app]]);
        await exec(tools,["validate","--features","cm-async,cm-async-builtins",apps[app]]);
}
    let ordinary;const hashes=new Set();
    for(const route of ["ordinary","reviewed","mixed"])
{
        const existing=process.env["LEAN_BRIDGE_CANONICAL_STREAM_"+route.toUpperCase()],out=existing?resolve(existing):join(temp,route);
        if(!existing)
{const src=join(temp,route+"-src");await prepare(src,route,ordinary);await build(src,out);}
        const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(out,"package-set-receipt.json")});
        const [pkg]=receipt.packages,[a]=pkg.artifacts;assert.equal(pkg.profile,"native-wit-canonical-task-v1");
        assert.ok(!hashes.has(a.sha256));hashes.add(a.sha256);
        const api=await json(join(out,"binding-ir.json")),proof=await json(join(out,"host-export-evidence.json"));
        if(route==="ordinary") ordinary=api;
        if(route==="reviewed") assert.deepEqual(api,ordinary);
        assert.equal(proof.reviewedSourceSha256,route==="reviewed"?sha256(canonicalJson(ordinary)):null);
        assert.equal(api.declarations.some(d=>d.resultMode==="promise"),route==="mixed");
        const entries=api.declarations.map(d=>({...proof.metadata.entries.find(e=>e.declaration===d.source.declaration),name: d.name}));
        const feed=api.declarations.find(d=>d.name==="feed"),model=(d,es=entries)=>canonicalAppModel({api: {...api,declarations: api.declarations.map(x=>x===feed?d:x)},entries: es,name: "meter",version: "1.0.0",prefix: "lbc_meter"});
        assert.throws(()=>model({...feed,failure: {...feed.failure,errors: ["error:EIO.Meter.feed"]}}),/failure contract/u);
        assert.throws(()=>model(feed,entries.map(e=>e.name==="feed"?{...e,protocol: {...e.protocol,close: "Meter.alternateFinish"}}:e)),/unsupported export/u);
        const area=await mkdtemp(join(temp,"install-")),prefix=join(area,"relocated stream");
        try
{
            await exec("tar",["-xzf",join(out,a.path),"-C",area,"--no-same-owner","--no-same-permissions"]);await rename(join(area,basename(a.path,".tar.gz")),prefix);
            const inner=await json(join(prefix,"lean-bridge-package.json")),world=join(prefix,inner.world);
            assert.match(await readFile(world,"utf8"),/result<stream<result<result<s64, string>, u16>>, u32>/u);
            const opts={cwd: area,env: {PATH: "/no-consumer-tools",LEAN_NUM_THREADS: "1",RAYON_NUM_THREADS: "1"},timeout: 15000};
            const run=async(app,expected)=>{await exec(tools,["component","targets",world,apps[app]]);assert.equal((await exec(join(prefix,inner.command),[apps[app]],opts)).stdout.trim(),expected);};
            await run("application",String(11n*2n**32n+89n));
            if(route==="mixed") await run("mixed","-700000000000000029");
            t.diagnostic(route+" "+a.bytes+" "+a.sha256+" — 11 actual pulls / 89 closes"+(route==="mixed"?"; stream woke separately parked Lean future":""));
}finally
{await rm(area,{recursive: true,force: true});}
        if(!existing) await rm(out,{recursive: true,force: true});
}
    const drift=join(temp,"drift-src"),out=join(temp,"drift-out");await prepare(drift,"drift",ordinary);
    await assert.rejects(build(drift,out),e=>e.code===1 && /reviewed.+(?:differs|match)/iu.test(e.stdout));
    await assert.rejects(readFile(join(out,"package-set-receipt.json")),{code: "ENOENT"});
});
