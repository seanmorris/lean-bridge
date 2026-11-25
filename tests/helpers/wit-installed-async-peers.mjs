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
import {extendWitApplication,extendWitFunctions} from "./wit-application-project.mjs";
import {buildInstalledWitGuests} from "./wit-application-command-client.mjs";
import {prepareGaugeWorker,buildAsyncPeerApplication,checkAsyncPeerWorld,buildAsyncPeerFailure} from "./wit-async-peer-project.mjs";
import {buildRegistrationCancellation,checkRegistrationCounts} from "./wit-peer-registration-cancel.mjs";

const exec=promisify(execFile),json=async p=>JSON.parse(await readFile(p,"utf8")),receipt="package-set-receipt.json";
const verify=dir=>readVerifiedPackageSetReceipt({receiptPath: join(dir,receipt)});
const preserve=async(src,dest)=>{
	try
	{await link(src,dest);}
	catch(e)
	{if(e.code!=="EXDEV")throw e;await copyFile(src,dest);}
};
const prepareClient=async(root,a,b,dual)=>{
	const client=join(root,"independently authored application"),wasm=process.env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools";
	const run=(cmd,args,cwd)=>exec(cmd,args,{cwd,maxBuffer: 4194304});
	const tool=(...args)=>run(wasm,args,client);
	const [owner]=await buildInstalledWitGuests({out: client,wit: join(a.installed,"wit"),wasm,run});
	await buildAsyncPeerApplication(client,tool);await checkAsyncPeerWorld(client,join(b.installed,"wit"),tool,dual);
	if(!dual)await buildAsyncPeerFailure(client,tool);
	await buildRegistrationCancellation(client,tool,dual,functions);
	const provider=join(client,"peer-provider.wasm");
	const env={PATH: "/no-tools",LEAN_NUM_THREADS: "1",RAYON_NUM_THREADS: "1"};
	const invoke=(dirs,inputs)=>exec(join(dirs[0],"bin/lean-bridge-wit-run"),[...dirs,"--",...inputs],{env,cwd: client,timeout: 30000});
	let checkedRegistrations=0;
	const bothOrders=async dirs=>{
		for(const order of [dirs,dirs.toReversed()])
		{
			if(dual)
			{
				const providers=["registration-provider.wasm","gauge-provider.wasm"];
				if(order[0]!==dirs[0])providers.reverse();
				for(const victim of ["workshop","gauge"])for(const create of [0,1])for(const read of [0,1])
				{
					const result=await invoke(order,[owner,...providers,"cancel-registration-"+victim+"-"+create+read+".wasm"]);
					assert.equal(result.stderr,"");checkRegistrationCounts(result.stdout);++checkedRegistrations;
				}
				for(const victim of ["workshop","gauge"])
				{
					const result=await invoke(order,[owner,...providers,"cancel-registration-"+victim+"-shared-10.wasm"]);
					assert.equal(result.stderr,"");checkRegistrationCounts(result.stdout);++checkedRegistrations;
				}
				continue;
			}
			assert.deepEqual(await invoke(order,[owner,provider,"peers.wasm"]),{stdout: "73\n",stderr: ""});
			assert.deepEqual(await invoke(order,["count-errors.wasm",provider,"peer-failure.wasm"]),{stdout: "65537\n",stderr: ""});
			for(const createOrder of [0,1])for(const readOrder of [0,1])
			{
				const result=await invoke(order,[owner,"registration-provider.wasm","cancel-registration-"+createOrder+readOrder+".wasm"]);
				assert.equal(result.stderr,"");checkRegistrationCounts(result.stdout);++checkedRegistrations;
			}
		}
	};
	return {invoke,bothOrders,owner,provider,count: ()=>checkedRegistrations};
};
const functions=process.env.LEAN_BRIDGE_WIT_REGISTRATION_FUNCTIONS==="1";
const dual=functions || process.env.LEAN_BRIDGE_WIT_INDEPENDENT_REGISTRATIONS==="1";
test(dual?"separately published WIT callback owners cancel only their own registration":"installed async WIT peers share an original box and cancel only the selected reader", {timeout: 3600000},async t=>{
	const root=await mkdtemp(join(tmpdir(),"wit-async-pair-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const replay=process.env.LEAN_BRIDGE_WIT_ASYNC_PEER_REPLAY,keep=process.env.LEAN_BRIDGE_WIT_ASYNC_PEER_HANDOFFS;
	const reuse=dual && !replay && process.env.LEAN_BRIDGE_WIT_WORKSHOP_HANDOFFS;
	const releases=replay?resolve(replay):await mkdtemp(join(keep??root,dual?"wit-dual-releases-":"wit-async-releases-"));
	if(keep || replay)t.diagnostic("verified handoff location: "+releases);
	const cli=replay?null:await installWitAuthor(root),reviews={};
	for(const route of ["ordinary","reviewed"])for(const name of ["workshop","gauge"])
	{
		const key=route+"-"+name,work=join(root,key),src=join(work,"source"),out=join(work,"release");
		const handoff=join(releases,key);
		await mkdir(work);
		if(reuse && name==="workshop")
		{
			const old=join(reuse,key),{receipt: r}=await verify(old),[a]=r.packages[0].artifacts;
			await mkdir(join(handoff,"archives"),{recursive: true});
			for(const file of [receipt,receipt+".sha256",a.path])await preserve(join(old,file),join(handoff,file));
		}
		else if(!replay)
		{
			if(name==="gauge")await prepareGaugeWorker(src,dual);
			else
			{await prepareStaticWorkerProject(src,"wit-wasi");await extendWitApplication(src);}
			if(functions)await extendWitFunctions(src);
			if(route==="reviewed")await writeFile(join(src,name+".binding-ir.json"),canonicalJson(reviews[name]));
			const args=[cli,"build","--project",src,"--target","wit-wasi","--output",out,"--json","--progress","none"];
			await exec(process.execPath,args,{cwd: work,maxBuffer: 4194304}).catch(e=>{
				throw new Error([e.message,e.stdout,e.stderr].filter(Boolean).join("\n"),{cause: e});
			});
			const checked=await verify(out),[archive]=checked.receipt.packages[0].artifacts;
			if(route==="ordinary")reviews[name]=await json(join(out,"binding-ir.json"));
			await mkdir(join(handoff,"archives"),{recursive: true});
			for(const file of [receipt,receipt+".sha256",archive.path])await preserve(join(out,file),join(handoff,file));
			await rm(src,{recursive: true});await rm(out,{recursive: true});
		}
	}
	// Every package is independently extracted. Only the active pair needs
	// to occupy disk while the downstream executable runs.
	const installedKeys=new Set();
	const install=async(route,name)=>{
		const key=route+"-"+name,work=join(root,key),handoff=join(releases,key),installed=join(root,"installed "+key);
		const {receipt: r}=await verify(handoff);
		assert.equal(r.packages.length,1);const [pkg]=r.packages,[a]=pkg.artifacts;
		assert.equal(pkg.profile,"native-wit-object-task-v1");assert.equal(pkg.name,name);
		await exec("tar",["-xzf",join(handoff,a.path),"-C",work,"--no-same-owner","--no-same-permissions"]);
		await rename(join(work,basename(a.path,".tar.gz")),installed);
		const meta=await json(join(installed,"lean-bridge-package.json")),ir=await json(join(installed,"share/lean-bridge/binding-ir.json"));
		if(functions)assert.ok(ir.declarations.some(d=>d.source.declaration==="Closures.remember"),key+" must publish its own function factory");
		if(route==="ordinary")
		{assert.equal(meta.reviewedSourceSha256,undefined);if(reviews[name])assert.deepEqual(ir,reviews[name]);reviews[name]=ir;}
		else
		{assert.deepEqual(ir,reviews[name]);assert.equal(meta.reviewedSourceSha256,sha256(canonicalJson(ir)));}
		assert.deepEqual(meta.inputs,name==="gauge" && !dual?["objects","application"]:["objects","callbacks","application"]);
		for(const f of ["bin/lean-bridge-wit-run","lib/lean-bridge-wit-async-peer.so"])assert.equal(meta.files[f].sha256,sha256(await readFile(join(installed,f))));
		if(!installedKeys.has(key))t.diagnostic(key+" "+a.bytes+" "+a.sha256);
		installedKeys.add(key);return {installed,meta};
	};
	const pair=[await install("ordinary","workshop"),await install("ordinary","gauge")],dirs=pair.map(p=>p.installed);
	assert.notEqual(pair[0].meta.library,pair[1].meta.library);assert.equal(pair[0].meta.hostDomain,pair[1].meta.hostDomain);
	const {owner,provider,invoke,bothOrders,count}=await prepareClient(root,pair[0],pair[1],dual);
	if(dual)
	{
		const consumer="cancel-registration-gauge-00.wasm";
		await assert.rejects(invoke(dirs,[owner,"registration-provider.wasm",consumer]),e=>e.code===2 && /callbacks.wasm/u.test(e.stderr));
		await assert.rejects(invoke(dirs,[owner,"gauge-provider.wasm","registration-provider.wasm",consumer]),e=>e.code===1 && e.stdout==="");
	} else
	{
		await assert.rejects(invoke(dirs,[owner,provider,"trap.wasm"]),e=>e.code===1 && /unreachable/u.test(e.stderr));
		await assert.rejects(invoke(dirs,[owner,provider,"private-scheduler.wasm"]),e=>e.code===1 && /workshop\/scheduler/u.test(e.stderr));
		await assert.rejects(invoke(dirs,[owner,"peers.wasm"]),e=>e.code===2 && /callbacks.wasm/u.test(e.stderr));
		await assert.rejects(invoke([dirs[0],dirs[0]],[owner,provider,"peers.wasm"]),e=>e.code===1 && /duplicate WIT package interface/u.test(e.stderr));
	}
	await bothOrders(dirs);
	for(const [slot,name,route] of [[1,"gauge","reviewed"],[0,"workshop","reviewed"],[1,"gauge","ordinary"]])
	{
		await rm(dirs[slot],{recursive: true});dirs[slot]=(await install(route,name)).installed;
		await bothOrders(dirs);
	}
	assert.equal(count(),dual?80:32);
	if(dual)
	{
		t.diagnostic("80 cross-package cases: 64 distinct-box first-read/factory orders and 16 same-box cancellations; both defining guests balance their own acquisitions and drops");
		if(functions)t.diagnostic("Each pending registration owned a returned Lean function; only the survivor invoked it, with a different input box; both captures were released.");
		return;
	}
	t.diagnostic("8 release/order combinations: one parked Gauge pull, one close, original Workshop callback result 73");
	t.diagnostic("8 nested error paths: Gauge member error returned through Workshop's callback future; one error issued, one destroyed");
	t.diagnostic("32 overlapping registration cases: independent factory/read orders, canceled read untouched, sibling invoked once, no remaining registrations");
});
