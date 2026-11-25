/** @file Install an object task with no callback provider and no synchronous Lean exports. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {basename,join,resolve} from "node:path";
import {tmpdir} from "node:os";
import {promisify} from "node:util";
import test from "node:test";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {witCoreInterface} from "../../src/backends/wit/application-operations.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {prepareStaticWorkerProject} from "./static-worker-project.mjs";
import {extendWitApplication} from "./wit-application-project.mjs";

const exec=promisify(execFile),cli=resolve("scripts/lean-bridge.mjs"),json=async path=>JSON.parse(await readFile(path,"utf8"));
test("a task-only WIT package needs neither synchronous Lean functions nor callback registrations",{timeout: 900000},async t=>{
    const root=await mkdtemp(join(tmpdir(),"wit-task-only-"));t.after(()=>rm(root,{recursive: true,force: true}));
    const wasm=process.env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools",fixtures=resolve("tests/fixtures/static-host-workers");let review;
    for(const route of ["ordinary","reviewed"])
{
        const work=join(root,route),src=join(work,"src"),release=join(work,"release"),dir=join(work,"installed world");
        await mkdir(work);await prepareStaticWorkerProject(src,"wit-wasi");await extendWitApplication(src);
        const path=join(src,"lean-bridge.exports.json"),config=await json(path);
        config.exports=["Jobs.echo"];config.taskExports=["Jobs.echo"];delete config.asyncIterators;delete config.taskIOErrors;
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
        assert.deepEqual(meta.inputs,["objects","application"]);assert.deepEqual(ir.declarations.map(d=>d.source.declaration),["Jobs.echo"]);
        if(review)
{assert.deepEqual(ir,review);assert.equal(meta.reviewedSourceSha256,sha256(canonicalJson(review)));}
        else
{assert.equal(meta.reviewedSourceSha256,undefined);review=ir;}
        const wit=join(dir,"wit"),owner=join(wit,"deps/objects.wit"),iface=/^package ([^;]+)@1\.0\.0;/u.exec(await readFile(owner,"utf8"))[1]+"/objects@1.0.0";
        const source=async f=>readFile(join(fixtures,f+".wat.in"),"utf8"),run=(...args)=>exec(wasm,args,{cwd: work});
        await writeFile(join(work,"owner.wat"),(await source("guest-box")).replaceAll("@IFACE@",witCoreInterface(iface)));
        await run("component","embed",owner,"--world","owner","owner.wat","-o","owner.core");await run("component","new","owner.core","-o","owner.wasm");
        await writeFile(join(work,"app.wat"),(await source("installed-echo")).replaceAll("@OBJECTS@",iface).replaceAll("@TASKS@","lean-bridge:workshop/object-tasks@1.0.0"));
        await run("parse","app.wat","-o","app.wasm");await run("component","targets",wit,"--world","application","app.wasm");
        await rm(src,{recursive: true});await rm(release,{recursive: true});
        const result=await exec(join(dir,meta.command),["owner.wasm","app.wasm"],{cwd: work,timeout: 30000,env: {PATH: "/no-tools",LEAN_NUM_THREADS: "1",RAYON_NUM_THREADS: "1"}});
        assert.equal(result.stdout.trim(),"83");t.diagnostic(route+" "+a.bytes+" "+a.sha256+"; echoed original guest object: 83");
        await rm(work,{recursive: true});
}
});
