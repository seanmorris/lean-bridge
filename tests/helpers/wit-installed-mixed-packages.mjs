/** @file Run ordinary and reviewed mixed Lean applications from relocated release archives. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename,join,resolve} from "node:path";
import {promisify} from "node:util";
import test from "node:test";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {buildInstalledWitGuests} from "./wit-application-command-client.mjs";
import {prepareStaticWorkerProject} from "./static-worker-project.mjs";
import {extendWitApplication} from "./wit-application-project.mjs";
import {assertJsonSchema} from "./json-schema.mjs";

const exec=promisify(execFile),cli=resolve("scripts/lean-bridge.mjs"),json=async p=>JSON.parse(await readFile(p,"utf8"));
test("installed mixed WIT applications run original objects, callbacks, futures and streams on both release routes",{timeout: 900000},async t=>{
	const root=await mkdtemp(join(tmpdir(),"wit-installed-mixed-"));t.after(()=>rm(root,{recursive: true,force: true}));
	let original;
	for(const route of ["ordinary","reviewed"])
{
		const work=join(root,route),src=join(work,"source"),out=join(work,"release"),consumer=join(work,"independent guest");
		await mkdir(work);await prepareStaticWorkerProject(src,"wit-wasi");await extendWitApplication(src);
		if(original)await writeFile(join(src,"workshop.binding-ir.json"),canonicalJson(original));
		await exec(process.execPath,[cli,"build","--project",src,"--target","wit-wasi","--output",out,"--json","--progress","none"]);
		const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(out,"package-set-receipt.json")});
		await assertJsonSchema("package-set-receipt",receipt);assert.equal(receipt.packages.length,1);
		const [pkg]=receipt.packages,[artifact]=pkg.artifacts;assert.equal(pkg.profile,"native-wit-object-task-v1");assert.equal(pkg.runtimeDelivery,"embedded");
		const relocated=join(work,"deploy with spaces");await mkdir(relocated);
		await exec("tar",["-xzf",join(out,artifact.path),"-C",relocated,"--no-same-owner","--no-same-permissions"]);
		const prefix=join(relocated,"installed");await rename(join(relocated,basename(artifact.path,".tar.gz")),prefix);
		const meta=await json(join(prefix,"lean-bridge-package.json")),ir=await json(join(prefix,"share/lean-bridge/binding-ir.json"));
		assert.equal(meta.profile,pkg.profile);assert.deepEqual(meta.inputs,["objects","callbacks","application"]);assert.equal(meta.bindingIrSha256,hashBindingIr(ir));
		for(const [path,digest] of Object.entries(meta.files))
{
			const bytes=await readFile(join(prefix,path));assert.equal(bytes.length,digest.bytes,path);assert.equal(sha256(bytes),digest.sha256,path);
}
		if(original)
{assert.deepEqual(ir,original);assert.equal(meta.reviewedSourceSha256,sha256(canonicalJson(original)));}
		else
{assert.equal(meta.reviewedSourceSha256,undefined);original=ir;}
		const paths=await buildInstalledWitGuests({out: consumer,wit: join(prefix,"wit"),wasm: process.env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools",run: (p,a,cwd)=>exec(p,a,{cwd,maxBuffer: 4194304})});
		await rm(src,{recursive: true});await rm(out,{recursive: true});
		const invoke=args=>exec(join(prefix,meta.command),args,{cwd: consumer,timeout: 30000,env: {PATH: "/no-tools",LEAN_NUM_THREADS: "1",RAYON_NUM_THREADS: "1"}});
		assert.equal((await invoke(paths)).stdout.trim(),"73");
		const guest=id=>[...paths.slice(0,2),join(consumer,id+".wasm")];
		assert.equal((await invoke(guest("sync-suite"))).stdout.trim(),"1");
		assert.equal((await invoke(guest("early"))).stdout.trim(),"17");
		await assert.rejects(invoke(guest("trap")),e=>e.code===1 && /unreachable/u.test(e.stderr));
		await assert.rejects(invoke([...paths.slice(0,2),join(consumer,"private.wasm")]),e=>e.code===1 && /turn-series/u.test(e.stderr));
		await assert.rejects(invoke(paths.slice(1)),e=>e.code===2 && /objects.wasm.*callbacks.wasm.*application.wasm/u.test(e.stderr));
		t.diagnostic(route+" "+artifact.bytes+" bytes "+artifact.sha256+" — installed stream to retained callback to reentrant Lean update to future: 73");
		await rm(work,{recursive: true});
}
});
