/** @file Verify original object identity across independently installed Lean packages. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {basename,join} from "node:path";
import {tmpdir} from "node:os";
import test from "node:test";
import {promisify} from "node:util";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {prepareWitPeerProject,buildWitPeerGuests,checkWitPeerWorld} from "./wit-peer-project.mjs";
import {installWitAuthor} from "./wit-installed-author.mjs";

const exec=promisify(execFile),json=async path=>JSON.parse(await readFile(path,"utf8"));
test("independent WIT packages share a guest object through success, mutation and declared failure",{timeout: 1200000},async t=>{
	const root=await mkdtemp(join(tmpdir(),"wit-peer-installs-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const cli=await installWitAuthor(root);
	const original={},packages={},runner="bin/lean-bridge-wit-run",plugin="lib/lean-bridge-wit-peer.so";
	for(const [route,name] of [["ordinary","workshop"],["ordinary","gauge"],["reviewed","workshop"],["reviewed","gauge"],["incompatible","gauge"]])
{
		const dest=join(root,route+" "+name),work=await mkdtemp(join(root,"build-")),src=join(work,"src"),out=join(work,"release");
		await prepareWitPeerProject(src,name);
		if(route==="reviewed")
{
			const path=join(src,"lean-bridge.exports.json"),config=await json(path);delete config.exports;
			await writeFile(path,canonicalJson(config));await writeFile(join(src,name+".binding-ir.json"),canonicalJson(original[name]));
}
		if(route==="incompatible")
{
			const path=join(src,"lean-bridge.hosts.json"),contract=await json(path);
			const extra=structuredClone(contract.declarations.find(d=>d.name==="identity"));
			extra.name="secondIdentity";extra.id+=".second";extra.overloadKey=extra.source.declaration="Box.secondIdentity";
			contract.declarations.push(extra);await writeFile(path,canonicalJson(contract));
}
		await exec(process.execPath,[cli,"build","--project",src,"--target","wit-wasi","--output",out,"--json","--progress","none"],{cwd: work})
			.catch(e=>{throw new Error([e.message,e.stderr,e.stdout].filter(Boolean).join("\n"),{cause: e});});
		const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(out,"package-set-receipt.json")});
		const [pkg]=receipt.packages,[a]=pkg.artifacts;assert.equal(pkg.profile,"native-wit-object-io-v1");
		await exec("tar",["-xzf",join(out,a.path),"-C",work,"--no-same-owner","--no-same-permissions"]);
		await rename(join(work,basename(a.path,".tar.gz")),dest);
		const meta=await json(join(dest,"lean-bridge-package.json")),ir=await json(join(dest,"share/lean-bridge/binding-ir.json"));
		for(const f of [runner,plugin])assert.equal(meta.files[f].sha256,sha256(await readFile(join(dest,f))));
		assert.deepEqual(ir.declarations.map(d=>d.source.declaration),name==="gauge"?["Gauge.increase","Gauge.reject"]:["Workshop.choose","Workshop.mapped"]);
		if(route==="ordinary")
{original[name]=ir;assert.equal(meta.reviewedSourceSha256,undefined);}
		if(route==="reviewed")
{assert.deepEqual(original[name],ir);assert.equal(meta.reviewedSourceSha256,sha256(canonicalJson(ir)));}
		packages[route+"-"+name]={dest,meta};t.diagnostic(route+" "+name+" "+a.bytes+" "+a.sha256);
		await rm(work,{recursive: true});
}
	const out=join(root,"application");await mkdir(out);
	const first=packages["ordinary-workshop"],other=packages["ordinary-gauge"];
	assert.notEqual(first.meta.library,other.meta.library);assert.equal(first.meta.hostDomain,other.meta.hostDomain);
	const run=(...args)=>exec(process.env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools",args,{cwd: out});
	await buildWitPeerGuests(join(first.dest,"wit/deps/objects.wit"),out,run);
	await checkWitPeerWorld(join(first.dest,"wit"),join(other.dest,"wit"),out,run);
	const invoke=(dirs,file,owner="objects")=>exec(join(dirs[0],runner),[...dirs,"--",owner+".wasm",file+".wasm"],{cwd: out,env: {PATH: "/no-tools",LEAN_NUM_THREADS: "1",RAYON_NUM_THREADS: "1"},timeout: 30000});
	for(const l of ["ordinary","reviewed"])for(const r of ["ordinary","reviewed"])
{
		const dirs=[packages[l+"-workshop"].dest,packages[r+"-gauge"].dest];
		for(const order of [dirs,dirs.toReversed()])assert.deepEqual(await invoke(order,"application"),{stdout: "73\n",stderr: ""});
}
	const normal=[first.dest,other.dest],fails=(xs,file,re)=>assert.rejects(invoke(xs,file),e=>e.code===1 && re.test(e.stderr));
	await fails(normal,"private",/private-exchange/u);
	await fails(normal,"foreign",/resource|type mismatch/u);
	await assert.rejects(invoke(normal,"application","foreign-owner"),e=>e.code===1 && /retain-box/u.test(e.stderr) && /type|expected/u.test(e.stderr));
	await assert.rejects(invoke(normal,"wrong-run"),e=>e.code===1 && /type|ascri/u.test(e.stderr) && !/unreachable/u.test(e.stderr));
	await fails([first.dest,first.dest],"application",/duplicate WIT package interface/u);
	await fails([first.dest,packages["incompatible-gauge"].dest],"application",/incompatible WIT object contract/u);
	t.diagnostic("eight route/order combinations returned 73; rejected a foreign kind, second defining instance, private import, wrong run signature, duplicate API and incompatible package");
});
