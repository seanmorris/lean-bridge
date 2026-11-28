/** @file Verify original object identity across independently installed Lean packages. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {basename,dirname,join,resolve} from "node:path";
import {tmpdir} from "node:os";
import test from "node:test";
import {promisify} from "node:util";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {prepareWitPeerProject,buildWitPeerGuests,checkWitPeerWorld} from "./wit-peer-project.mjs";
import {installWitAuthor} from "./wit-installed-author.mjs";
import {extendWitFunctions} from "./wit-application-project.mjs";

const exec=promisify(execFile),json=async path=>JSON.parse(await readFile(path,"utf8"));
test("independent WIT packages share a guest object through success, mutation and declared failure",{timeout: 1200000},async t=>{
	const root=await mkdtemp(join(tmpdir(),"wit-peer-installs-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const keep=process.env.LEAN_BRIDGE_WIT_SYNC_PEER_HANDOFFS,replay=process.env.LEAN_BRIDGE_WIT_SYNC_PEER_REPLAY;
	const releases=replay?resolve(replay):await mkdtemp(join(keep??root,"wit-sync-releases-"));
	if(replay || keep)t.diagnostic("verified handoff location: "+releases);
	const cli=replay?null:await installWitAuthor(root);
	const original={},runner="bin/lean-bridge-wit-run",plugin="lib/lean-bridge-wit-peer.so",receiptFile="package-set-receipt.json";
	if(!replay)for(const [route,name] of [["ordinary","workshop"],["ordinary","gauge"],["reviewed","workshop"],["reviewed","gauge"],["incompatible","gauge"]])
	{
		const dest=join(releases,route+" "+name),work=await mkdtemp(join(root,"build-")),src=join(work,"src"),out=join(work,"release");
		await prepareWitPeerProject(src,name);await extendWitFunctions(src);
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
		const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(out,receiptFile)});
		const [pkg]=receipt.packages,[a]=pkg.artifacts;assert.equal(pkg.profile,"native-wit-object-io-v1");assert.equal(pkg.name,name);
		if(route==="ordinary")original[name]=await json(join(out,"binding-ir.json"));
		await mkdir(dirname(join(dest,a.path)),{recursive: true});
		for(const f of [a.path,receiptFile,receiptFile+".sha256"])await rename(join(out,f),join(dest,f));
		await rm(work,{recursive: true});
	}
	// Only extract the active pair. Their libraries remain separate copies;
	// sharing them via links could mask a failure in runtime or owner identity.
	const seen=new Set(),install=async(name,route)=>{
		const key=route+" "+name,handoff=join(releases,key),work=await mkdtemp(join(root,"consume-"));
		const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(handoff,receiptFile)});
		assert.equal(receipt.packages.length,1);const [pkg]=receipt.packages,[a]=pkg.artifacts;
		assert.equal(pkg.name,name);assert.equal(pkg.profile,"native-wit-object-io-v1");assert.equal(pkg.artifacts.length,1);
		if(!seen.has(key))t.diagnostic(key+" "+a.bytes+" "+a.sha256);seen.add(key);
		await exec("tar",["-xzf",join(handoff,a.path),"-C",work,"--no-same-owner","--no-same-permissions"]);
		const dest=join(work,basename(a.path,".tar.gz"));
		const meta=await json(join(dest,"lean-bridge-package.json")),ir=await json(join(dest,"share/lean-bridge/binding-ir.json"));
		for(const f of [runner,plugin])assert.equal(meta.files[f].sha256,sha256(await readFile(join(dest,f))));
		assert.deepEqual(ir.declarations.map(d=>d.source.declaration).sort(),["Closures.identityReader"
			, "Closures.reader"
			, "Closures.remember"
			, ...name==="gauge"?["Gauge.increase","Gauge.reject"]:["Workshop.choose","Workshop.mapped"]]);
		if(route==="ordinary")
		{
			if(original[name])assert.deepEqual(original[name],ir);else original[name]=ir;
			assert.equal(meta.reviewedSourceSha256,undefined);
		}
		if(route==="reviewed")
		{assert.deepEqual(original[name],ir);assert.equal(meta.reviewedSourceSha256,sha256(canonicalJson(ir)));}
		return {dest,meta,uninstall: ()=>rm(work,{recursive: true})};
	};
	const out=join(root,"application");await mkdir(out);
	const first=await install("workshop","ordinary"),other=await install("gauge","ordinary");
	assert.notEqual(first.meta.library,other.meta.library);assert.equal(first.meta.hostDomain,other.meta.hostDomain);
	const run=(...args)=>exec(process.env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools",args,{cwd: out});
	await buildWitPeerGuests(join(first.dest,"wit/deps/objects.wit"),out,run);
	await checkWitPeerWorld(join(first.dest,"wit"),join(other.dest,"wit"),out,run);
	const spec=await readFile(join(first.dest,"wit/deps/objects.wit"),"utf8"),obj=/^package ([^;]+)@1\.0\.0;/u.exec(spec)[1]+"/objects@1";
	const closureGuest=await readFile("tests/fixtures/static-host-workers/peer-functions.wat.in","utf8");
	await writeFile(join(out,"functions.wat"),closureGuest.replaceAll("@OBJECTS@",obj));
	await run("component","embed","wit","--world","meters","functions.wat","-o","functions.core");
	await run("component","new","functions.core","-o","functions.wasm");
	await run("component","targets","wit","--world","meters","functions.wasm");
	const wrongType=`(component
  (import "lean-bridge:workshop/api@1.0.0" (instance $a (export "remember-function" (type (sub resource)))))
  (alias export $a "remember-function" (type $f))
  (import "lean-bridge:gauge/api@1.0.0" (instance (export "remember-function" (type (eq $f)))))
  (core module $m (func (export "run") (result i64) unreachable))
  (core instance $r (instantiate $m)) (func (export "run") (result s64) (canon lift (core func $r "run"))))`;
	await writeFile(join(out,"foreign-function.wat"),wrongType);await run("parse","foreign-function.wat","-o","foreign-function.wasm");
	await run("validate","foreign-function.wasm");
	const invoke=(dirs,file,owner="objects")=>exec(join(dirs[0],runner),[...dirs,"--",owner+".wasm",file+".wasm"],{cwd: out,env: {PATH: "/no-tools",LEAN_NUM_THREADS: "1",RAYON_NUM_THREADS: "1"},timeout: 30000});
	const normal=[first.dest,other.dest],fails=(xs,file,re)=>assert.rejects(invoke(xs,file),e=>e.code===1 && re.test(e.stderr));
	await fails(normal,"private",/private-exchange/u);
	await fails(normal,"foreign",/resource|type mismatch/u);
	await assert.rejects(invoke(normal,"foreign-function"),e=>e.code===1 && /resource|type mismatch/u.test(e.stderr) && !/unreachable/u.test(e.stderr));
	await assert.rejects(invoke(normal,"application","foreign-owner"),e=>e.code===1 && /retain-box/u.test(e.stderr) && /type|expected/u.test(e.stderr));
	await assert.rejects(invoke(normal,"functions","cyclic-owner"),e=>e.code===1 && /lean-bridge:workshop\/api/u.test(e.stderr)
		&& /import|argument/u.test(e.stderr) && !/unreachable/u.test(e.stderr));
	await assert.rejects(invoke(normal,"wrong-run"),e=>e.code===1 && /type|ascri/u.test(e.stderr) && !/unreachable/u.test(e.stderr));
	await fails([first.dest,first.dest],"application",/duplicate WIT package interface/u);
	const pair=[first,other],bothOrders=async()=>{
		const dirs=pair.map(p=>p.dest);
		for(const order of [dirs,dirs.toReversed()])
		{
			assert.deepEqual(await invoke(order,"application"),{stdout: "73\n",stderr: ""});
			assert.deepEqual(await invoke(order,"functions"),{stdout: "42\n",stderr: ""});
		}
	};
	await bothOrders();
	for(const [index,name,route] of [[1,"gauge","reviewed"],[0,"workshop","reviewed"],[1,"gauge","ordinary"]])
	{
		await pair[index].uninstall();pair[index]=await install(name,route);await bothOrders();
	}
	await pair[1].uninstall();pair[1]=await install("gauge","incompatible");
	await fails(pair.map(p=>p.dest),"application",/incompatible WIT object contract/u);
	t.diagnostic("eight route/order combinations returned 73; rejected a foreign kind, second defining instance, private import, wrong run signature, duplicate API and incompatible package");
});
