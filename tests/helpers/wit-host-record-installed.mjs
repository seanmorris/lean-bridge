/** @file Compile real application guests against two relocated WIT packages and the original defining resource. */
import assert from "node:assert/strict";
import {access,appendFile,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename,dirname,join,resolve} from "node:path";
import test from "node:test";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {prepareWitPeerProject,buildWitPeerGuests,checkWitPeerWorld} from "./wit-peer-project.mjs";
import {installWitAuthor} from "./wit-installed-author.mjs";

const read=async path=>JSON.parse(await readFile(path,"utf8"));
test("WIT records own guest objects through compiled functions and two installed packages",{timeout: 3_600_000},async t=>{
	const keep=process.env.LEAN_BRIDGE_WIT_RECORD_HANDOFFS;
	const root=await mkdtemp(join(keep??tmpdir(),"wit-record-"));
	if(!keep) t.after(()=>rm(root,{recursive: true,force: true}));
	const replay=process.env.LEAN_BRIDGE_WIT_RECORD_REPLAY;
	assert.ok(!(replay && keep));
	const cli=replay?null:await installWitAuthor(root),env={...process.env,RAYON_NUM_THREADS: "1"};
	const receiptFile="package-set-receipt.json",metaPath="share/lean-bridge/binding-ir.json";
	let ordinary;
	const install=async(route,name)=>{
		const dest=join(replay?resolve(replay):root,route),project=join(root,route+"-source"),out=join(root,route+"-release");
		if(!replay)
		{
			await prepareWitPeerProject(project,name);
			if(name==="workshop")
			{
				const path=join(project,"lean-bridge.exports.json"),cfg=await read(path);
				const gauge=await readFile("tests/fixtures/dotnet-host-record/Workshop.lean","utf8");
				await writeFile(join(project,"Meters.lean"),gauge.replaceAll("LeanBridge.Host.Dotnet","LeanBridge.Host.WitWasi").replaceAll("Gauge","Meters").replace("def choose (","def selectMeter ("));
				await appendFile(join(project,"lakefile.toml"),'\n[[lean_lib]]\nname="Meters"\n');
				cfg.modules.push("Meters");
				cfg.exports.push(...["createPair","flip","sumRead","selectMeter","duplicateSample"].map(n=>"Meters."+n));
				if(route==="reviewed")
				{
					const review=structuredClone(ordinary);
					review.types.find(r=>r.id==="lean:Meters.Pair").fields[0].documentation.summary="The guest's first meter.";
					delete cfg.exports;await writeFile(join(project,"public.binding-ir.json"),canonicalJson(review));
				}
				await writeFile(path,canonicalJson(cfg));
			}
			const build=target=>run(process.execPath,[cli,"build","--target","wit-wasi","--project",project,"--output",target,"--json","--progress","none"],root,env,1_200_000);
			await build(out);
			const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(out,receiptFile)});
			if(route==="reviewed")
			{
				const path=join(project,"public.binding-ir.json"),review=await read(path);
				const fields=review.types.find(r=>r.id==="lean:Meters.Pair").fields;
				[fields[0],fields[3]]=[fields[3],fields[0]];await writeFile(path,canonicalJson(review));
				const refused=join(root,"refused");await assert.rejects(build(refused),/Reviewed API differs/u);await assert.rejects(access(refused),{code: "ENOENT"});
			}
			const [a]=receipt.packages[0].artifacts;
			await mkdir(dirname(join(dest,a.path)),{recursive: true});
			for(const f of [a.path,receiptFile,receiptFile+".sha256"]) await rename(join(out,f),join(dest,f));
			await rm(out,{recursive: true});await rm(project,{recursive: true});
		}
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(dest,receiptFile)});
		const [pkg]=receipt.packages,[a]=pkg.artifacts;assert.equal(receipt.packages.length,1);assert.equal(pkg.name,name);assert.equal(pkg.profile,"native-wit-object-io-v1");
		const stage=join(root,route+"-install");await mkdir(stage);
		await run("tar",["-xzf",join(dest,a.path),"-C",stage,"--no-same-owner","--no-same-permissions"],root,env);
		const dir=join(stage,basename(a.path,".tar.gz")),ir=await read(join(dir,metaPath)),meta=await read(join(dir,"lean-bridge-package.json"));
		for(const f of ["bin/lean-bridge-wit-run","lib/lean-bridge-wit-peer.so",metaPath,"wit/api.wit"]) assert.equal(sha256(await readFile(join(dir,f))),meta.files[f].sha256);
		assert.equal(ir.schemaVersion,route==="peer"?3:4);
		if(route==="ordinary") ordinary=ir;
		if(route==="reviewed")
		{
			const expected=structuredClone(ordinary);expected.types.find(r=>r.id==="lean:Meters.Pair").fields[0].documentation.summary="The guest's first meter.";
			assert.deepEqual(ir,expected);assert.deepEqual(await read(join(dir,"share/lean-bridge/reviewed.binding-ir.json")),expected);
		}
		return {dir,meta,receiptSha256: result.receiptSha256,archiveSha256: a.sha256};
	};
	const peer=await install("peer","gauge"),first=await install("ordinary","workshop"),second=await install("reviewed","workshop");
	const client=await readFile("tests/fixtures/static-host-workers/peer-object-record.wat.in","utf8"),app=join(root,"application");await mkdir(app);
	const wasm=async(...args)=>({stdout: await run(process.env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools",args,app,env)});
	const spec=await readFile(join(first.dir,"wit/deps/objects.wit"),"utf8"),obj=/^package ([^;]+)@1\.0\.0;/u.exec(spec)[1]+"/objects@1";
	await buildWitPeerGuests(join(first.dir,"wit/deps/objects.wit"),app,wasm);
	await checkWitPeerWorld(join(first.dir,"wit"),join(peer.dir,"wit"),app,wasm);
	await writeFile(join(app,"record.wat"),client.replaceAll("@OBJECTS@",obj));await wasm("component","embed","wit","--world","meters","record.wat","-o","record.core");
	await wasm("component","new","record.core","-o","record.wasm");await wasm("component","targets","wit","--world","meters","record.wasm");
	const output=resolve(process.env.LEAN_BRIDGE_WIT_RECORD_OUTPUT??"build/wit-host-record");await mkdir(output,{recursive: true});
	const guestSha256=sha256(await readFile(join(app,"record.wasm"))),ownerSha256=sha256(await readFile(join(app,"objects.wasm")));
	for(const [route,r] of [["ordinary",first],["reviewed",second]])
	{
		assert.notEqual(r.meta.library,peer.meta.library);assert.equal(r.meta.hostDomain,peer.meta.hostDomain);
		const checks={};for(const [order,dirs] of [["workshop-first",[r.dir,peer.dir]],["peer-first",[peer.dir,r.dir]]])
		{
			const execute=owner=>run(join(dirs[0],"bin/lean-bridge-wit-run"),[...dirs,"--",owner+".wasm","record.wasm"],app,{PATH: "/no-author-tools",LEAN_NUM_THREADS: "1",RAYON_NUM_THREADS: "1"},60_000);
			assert.equal(await execute("objects"),"42");
			await assert.rejects(execute("foreign-owner"),e=>e.cause?.code===1 && /retain-box/u.test(e.cause.stderr) && /type|expected/u.test(e.cause.stderr) && !/unreachable/u.test(e.cause.stderr));
			checks[order]="42; foreign owner rejected";
		}
		await writeFile(join(output,route+".json"),canonicalJson({route,checks,guestSha256,ownerSha256,clientSha256: sha256(client),receiptSha256: r.receiptSha256,archiveSha256: r.archiveSha256,peerReceiptSha256: peer.receiptSha256,peerArchiveSha256: peer.archiveSha256}));
	}
	t.diagnostic("Both record routes and both package orders verified. Handoffs: "+(replay??root));
});
