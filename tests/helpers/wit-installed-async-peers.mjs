/** @file Run two independently published WIT worker packages in one offline installation. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {copyFile,link,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename,join,resolve} from "node:path";
import {promisify} from "node:util";
import test from "node:test";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {installWitAuthor} from "./wit-installed-author.mjs";
import {prepareStaticWorkerProject} from "./static-worker-project.mjs";
import {extendWitApplication} from "./wit-application-project.mjs";
import {buildInstalledWitGuests} from "./wit-application-command-client.mjs";
import {prepareGaugeWorker,buildAsyncPeerApplication,checkAsyncPeerWorld} from "./wit-async-peer-project.mjs";

const exec=promisify(execFile),json=async p=>JSON.parse(await readFile(p,"utf8")),receipt="package-set-receipt.json";
const verify=dir=>readVerifiedPackageSetReceipt({receiptPath: join(dir,receipt)});
const preserve=async(src,dest)=>{
	try
	{await link(src,dest);}
	catch(e)
	{if(e.code!=="EXDEV")throw e;await copyFile(src,dest);}
};
const prepareClient=async(root,a,b)=>{
	const client=join(root,"independently authored application"),wasm=process.env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools";
	const run=(cmd,args,cwd)=>exec(cmd,args,{cwd,maxBuffer: 4194304});
	const tool=(...args)=>run(wasm,args,client);
	const [owner]=await buildInstalledWitGuests({out: client,wit: join(a.installed,"wit"),wasm,run});
	await buildAsyncPeerApplication(client,tool);await checkAsyncPeerWorld(client,join(b.installed,"wit"),tool);
	const provider=join(client,"peer-provider.wasm");
	const env={PATH: "/no-tools",LEAN_NUM_THREADS: "1",RAYON_NUM_THREADS: "1"};
	const invoke=(dirs,inputs)=>exec(join(dirs[0],"bin/lean-bridge-wit-run"),[...dirs,"--",...inputs],{env,cwd: client,timeout: 30000});
	const bothOrders=async dirs=>{
		for(const order of [dirs,dirs.toReversed()])assert.deepEqual(await invoke(order,[owner,provider,"peers.wasm"]),{stdout: "73\n",stderr: ""});
	};
	return {invoke,bothOrders,owner,provider};
};
test("installed async WIT peers share an original box and cancel only the selected reader", {timeout: 3600000},async t=>{
	const root=await mkdtemp(join(tmpdir(),"wit-async-pair-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const replay=process.env.LEAN_BRIDGE_WIT_ASYNC_PEER_REPLAY,keep=process.env.LEAN_BRIDGE_WIT_ASYNC_PEER_HANDOFFS;
	const releases=replay?resolve(replay):await mkdtemp(join(keep??root,"wit-async-releases-"));
	if(keep || replay)t.diagnostic("verified handoff location: "+releases);
	const cli=replay?null:await installWitAuthor(root),pkgs={},reviews={};
	let client;
	for(const route of ["ordinary","reviewed"])for(const name of ["workshop","gauge"])
	{
		const key=route+"-"+name,work=join(root,key),src=join(work,"source"),out=join(work,"release");
		const handoff=join(releases,key),installed=join(root,"installed "+key);
		await mkdir(work);
		if(!replay)
		{
			if(name==="gauge")await prepareGaugeWorker(src);
			else
			{await prepareStaticWorkerProject(src,"wit-wasi");await extendWitApplication(src);}
			if(route==="reviewed")await writeFile(join(src,name+".binding-ir.json"),canonicalJson(reviews[name]));
			const args=[cli,"build","--project",src,"--target","wit-wasi","--output",out,"--json","--progress","none"];
			await exec(process.execPath,args,{cwd: work,maxBuffer: 4194304}).catch(e=>{
				throw new Error([e.message,e.stdout,e.stderr].filter(Boolean).join("\n"),{cause: e});
			});
			const checked=await verify(out),[archive]=checked.receipt.packages[0].artifacts;
			await mkdir(join(handoff,"archives"),{recursive: true});
			for(const file of [receipt,receipt+".sha256",archive.path])await preserve(join(out,file),join(handoff,file));
			await rm(src,{recursive: true});await rm(out,{recursive: true});
		}
		const {receipt: r}=await verify(handoff);
		assert.equal(r.packages.length,1);const [pkg]=r.packages,[a]=pkg.artifacts;
		assert.equal(pkg.profile,"native-wit-object-task-v1");assert.equal(pkg.name,name);
		await exec("tar",["-xzf",join(handoff,a.path),"-C",work,"--no-same-owner","--no-same-permissions"]);
		await rename(join(work,basename(a.path,".tar.gz")),installed);
		const meta=await json(join(installed,"lean-bridge-package.json")),ir=await json(join(installed,"share/lean-bridge/binding-ir.json"));
		if(route==="ordinary")
		{assert.equal(meta.reviewedSourceSha256,undefined);reviews[name]=ir;}
		else
		{assert.deepEqual(ir,reviews[name]);assert.equal(meta.reviewedSourceSha256,sha256(canonicalJson(ir)));}
		assert.deepEqual(meta.inputs,name==="gauge"?["objects","application"]:["objects","callbacks","application"]);
		for(const f of ["bin/lean-bridge-wit-run","lib/lean-bridge-wit-async-peer.so"])assert.equal(meta.files[f].sha256,sha256(await readFile(join(installed,f))));
		pkgs[key]={installed,meta};
		t.diagnostic(key+" "+a.bytes+" "+a.sha256);await rm(work,{recursive: true});
		if(key==="ordinary-gauge")
		{
			const first=pkgs["ordinary-workshop"];
			assert.notEqual(first.meta.library,meta.library);assert.equal(first.meta.hostDomain,meta.hostDomain);
			client=await prepareClient(root,first,pkgs[key]);await client.bothOrders([first.installed,installed]);
		}
	}
	const a=pkgs["ordinary-workshop"],b=pkgs["ordinary-gauge"];
	const {owner,provider,invoke,bothOrders}=client;
	for(const left of ["ordinary","reviewed"])for(const right of ["ordinary","reviewed"])
	{
		if(left==="reviewed" || right==="reviewed")await bothOrders([pkgs[left+"-workshop"].installed,pkgs[right+"-gauge"].installed]);
	}
	const dirs=[a.installed,b.installed];
	await assert.rejects(invoke(dirs,[owner,provider,"trap.wasm"]),e=>e.code===1 && /unreachable/u.test(e.stderr));
	await assert.rejects(invoke(dirs,[owner,provider,"private-scheduler.wasm"]),e=>e.code===1 && /workshop\/scheduler/u.test(e.stderr));
	await assert.rejects(invoke(dirs,[owner,"peers.wasm"]),e=>e.code===2 && /callbacks.wasm/u.test(e.stderr));
	await assert.rejects(invoke([a.installed,a.installed],[owner,provider,"peers.wasm"]),e=>e.code===1 && /duplicate WIT package interface/u.test(e.stderr));
	t.diagnostic("8 release/order combinations: one parked Gauge pull, one close, original Workshop callback result 73");
});
