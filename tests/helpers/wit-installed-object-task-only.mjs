/** @file Install independent resource and copied workers with no callback provider. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {lstat,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {basename,join,resolve} from "node:path";
import {tmpdir} from "node:os";
import {promisify} from "node:util";
import test from "node:test";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {prepareStaticWorkerProject} from "./static-worker-project.mjs";
import {extendWitApplication} from "./wit-application-project.mjs";
import {prepareWitObjectCopiedProject,buildWitCopiedConsumers} from "./wit-object-copied-project.mjs";
import {canonicalCopiedWorker} from "../../src/backends/wit/canonical-app.mjs";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";

const exec=promisify(execFile),cli=resolve("scripts/lean-bridge.mjs"),json=async path=>JSON.parse(await readFile(path,"utf8"));
for(const copied of [false,true])test(copied?"installed WIT copied and guest-owned workers operate on the same owner":"a task-only WIT package needs neither synchronous Lean functions nor callback registrations",{timeout: 900000},async t=>{
    const root=await mkdtemp(join(tmpdir(),"wit-task-only-"));t.after(()=>rm(root,{recursive: true,force: true}));
    const wasm=process.env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools";let review;
    for(const route of ["ordinary","reviewed"])
{
        const work=join(root,route),src=join(work,"src"),release=join(work,"release"),dir=join(work,"installed world");
        await mkdir(work);
        if(copied)await prepareWitObjectCopiedProject(src);
        else
{await prepareStaticWorkerProject(src,"wit-wasi");await extendWitApplication(src);}
        const path=join(src,"lean-bridge.exports.json"),config=await json(path);
        if(!copied)
{config.exports=["Jobs.echo"];config.taskExports=["Jobs.echo"];delete config.asyncIterators;delete config.taskIOErrors;}
        if(review)delete config.exports;
        config.targets["wit-wasi"].asyncAbi="canonical";await writeFile(path,canonicalJson(config));
        if(review)await writeFile(join(src,"workshop.binding-ir.json"),canonicalJson(review));
        await exec(process.execPath,[cli,"build","--project",src,"--target","wit-wasi","--output",release,"--json","--progress","none"]).catch(e=>{
            throw new Error([e.message,e.stdout,e.stderr].filter(Boolean).join("\n"),{cause: e});
        });
        const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(release,"package-set-receipt.json")});
        assert.equal(receipt.packages.length,1);const [pkg]=receipt.packages,[a]=pkg.artifacts;assert.equal(pkg.profile,"native-wit-object-task-v1");
        await exec("tar",["-xzf",join(release,a.path),"-C",work,"--no-same-owner","--no-same-permissions"]);
        await rename(join(work,basename(a.path,".tar.gz")),dir);
        const meta=await json(join(dir,"lean-bridge-package.json")),ir=await json(join(dir,"share/lean-bridge/binding-ir.json"));
        assert.deepEqual(meta.inputs,["objects","application"]);
        assert.deepEqual(ir.declarations.map(d=>d.source.declaration).sort(),copied?["Jobs.echo","Packet.chunks","Packet.closed","Packet.release","PacketCompose.packet"]:["Jobs.echo"]);
        if(copied)
{
            const source=ir.declarations.find(d=>d.source.declaration==="Packet.chunks"),bytes={kind: "primitive",name: "bytes"};
            const protocol={open: "Packet.chunks",next: "Packet.next",close: "Packet.finish"};
            const entry={
                name: "chunks",declaration: "Packet.chunks",effect: "BaseIO"
                , delivery: "async-iterator"
                , parameters: [{name: "value",type: bytes}]
                , result: bytes,stepError: bytes,protocol};
            assert.equal(canonicalCopiedWorker(source,entry,ir.errors).stream,true);
            for(const mutate of [
                d=>{d.source.extensions["lean-bridge.dev/host-member-phases"].pull=["Box.read"];}
                , d=>{d.source.extensions["lean-bridge.dev/error-payload-site"]=d.result;}
                , d=>{d.parameters[0].ownership="lease";}
                , d=>{d.parameters[0].mutability="write";}
            ]){
                const changed=structuredClone(source);mutate(changed);
                assert.throws(()=>canonicalCopiedWorker(changed,entry,ir.errors),/copied worker sites|ABI disagrees/u);
            }
}
        if(review)
{assert.deepEqual(ir,review);assert.equal(meta.reviewedSourceSha256,sha256(canonicalJson(review)));}
        else
{assert.equal(meta.reviewedSourceSha256,undefined);review=ir;}
        await buildWitCopiedConsumers({wit: join(dir,"wit"),out: work,run: (...args)=>exec(wasm,args,{cwd: work}),copied});
        await rm(src,{recursive: true});await rm(release,{recursive: true});
        const invoke=name=>exec(join(dir,meta.command),["owner.wasm",name+".wasm"],{cwd: work,timeout: 30000,env: {PATH: "/no-tools",LEAN_NUM_THREADS: "1",RAYON_NUM_THREADS: "1"}});
        assert.equal((await invoke("echo")).stdout.trim(),"83");
        if(copied)
{assert.equal((await invoke("bytes")).stdout.trim(),"2");assert.equal((await invoke("overlap")).stdout.trim(),"253");}
        t.diagnostic(route+" "+a.bytes+" "+a.sha256+"; echoed original guest object: 83"+(copied?"; copied packet suite: 2; interleaved object and packet: 253":""));
        await rm(work,{recursive: true});
}
});

test("guest-object packages reject ambient effects hidden in a copied cursor finalizer",{timeout: 300000},async t=>{
	const root=await mkdtemp(join(tmpdir(),"wit-cursor-effect-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const src=join(root,"source"),out=join(root,"release");await prepareWitObjectCopiedProject(src);
	const path=join(src,"Packet.lean"),before=await readFile(path,"utf8");
	const after=before.replace(":= closes.modify (· + 1)",':= do\n  let value ← IO.getEnv "PACKET_CLOSE"\n  closes.modify (· + (if value.isSome then 2 else 1))');
	assert.notEqual(after,before);await writeFile(path,after);
	const build=()=>buildCanonicalProject({projectRoot: src,outputRoot: out,targets: ["wit-wasi"],environment: process.env});
	await assert.rejects(build,/Packet\.finish requires nativeEffects "environment" via IO\.getEnv/u);
	await assert.rejects(lstat(out),{code: "ENOENT"});
	const configPath=join(src,"lean-bridge.exports.json"),config=await json(configPath);
	config.nativeEffects=["environment"];await writeFile(configPath,canonicalJson(config));
	await assert.rejects(build,/Application-owned WIT packages require .*no external OS capabilities/u);
	await assert.rejects(lstat(out),{code: "ENOENT"});
});
