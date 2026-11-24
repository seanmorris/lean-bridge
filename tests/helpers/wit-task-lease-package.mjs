/** @file Verify independently built, relocated WIT packages exchange the same mutable Lean object. */
import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { linuxBrokerHeader } from "../../src/backends/native/runtime-broker.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import { buildCliNpmPackage } from "../../src/release/cli-npm-package.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { writeWitLeaseProject } from "./wit-task-lease-project.mjs";
import { writeWitParkedProject } from "./wit-task-parked-project.mjs";

const parked=process.env.LEAN_BRIDGE_WIT_PARKED_LEASE_TEST==="1";
const retained=process.env.LEAN_BRIDGE_WIT_RETAINED_LEASE_TEST==="1";
const modules=parked?["Depot"]:retained?["Peer","Depot"]:["Depot","Peer"], names=modules.map(m=>m.toLowerCase());
test(parked?"installed WIT tasks anchor borrowed objects through cancellation and late completion"
	:retained?"installed WIT tasks keep foreign Lean borrows alive across retained callbacks"
	:"installed WIT sessions exchange a nominal lease without exchanging stores",{
	skip: !parked && !retained && process.env.LEAN_BRIDGE_WIT_LEASE_PACKAGE_TEST!=="1"
	},async t=>{
	const root=await mkdtemp(join(tmpdir(),"wit-lease-install-")); t.after(()=>rm(root,{recursive: true,force: true}));
	const env={...process.env,npm_config_cache: join(root,"cache")};delete env.NODE_TEST_CONTEXT;
	const run=async (command,args,cwd=root,environment=env)=>{
		try
		{ return await processBuildRunner.capture({command,args,cwd,env: environment}); }
		catch(e)
		{ t.diagnostic(e.details?.stderr??e.message);throw e; }
	};
	const author=join(root,"author"),bundle=await buildCliNpmPackage({outputRoot: join(root,"cli")});
	await run("npm",["install","--offline","--ignore-scripts","--no-audit","--no-fund","--no-package-lock","--prefix",author,bundle.archive]);
	const cli=join(author,"node_modules/.bin/lean-bridge"),invoke=args=>run(process.execPath,[cli,...args]);
	const build=(project,out)=>invoke(["build","--project",project,"--target","wit-wasi","--output",out]);
	const reviews={}, manifests={}, receiptPaths={};
	const evidence=parked?env.LEAN_BRIDGE_WIT_PARKED_LEASE_EVIDENCE:env.LEAN_BRIDGE_WIT_LEASE_PACKAGE_EVIDENCE;
	if(evidence) await mkdir(evidence);
	for(const route of ["ordinary","reviewed"])
	{
		const phase=join(root,route);await mkdir(phase);
		const consumer=join(phase,"consumer"); await mkdir(consumer);
		for(const module of modules)
		{
			const name=module.toLowerCase(),project=join(phase,"source-"+name),out=join(phase,"handoff-"+name);
			const review=route==="reviewed"?reviews[name]:null;
			if(parked) await writeWitParkedProject(project,review);
			else await writeWitLeaseProject(project,module,review,false,retained);
			await build(project,out);
			await rm(project,{recursive: true});
			const receiptPath=join(out,"package-set-receipt.json");
			await invoke(["verify","--receipt",receiptPath]);
			const {receipt}=await readVerifiedPackageSetReceipt({receiptPath}),[pkg]=receipt.packages;
			assert.equal(receipt.packages.length,1);assert.equal(pkg.profile,"native-wit-task-v1");
			assert.equal(pkg.name,name);assert.equal(pkg.runtimeDelivery,"embedded");assert.equal(pkg.artifacts.length,1);
			const archive=join(out,pkg.artifacts[0].path);
			const base=name+"-"+pkg.version+"-wit-wasi";
			const paths=(await run("tar",["-tzf",archive])).stdout.trim().split("\n");
			assert.ok(paths.every(path=>path.startsWith(base+"/") && !path.split("/").includes("..")));
			await run("tar",["-xzf",archive],consumer);
			const dest=join(consumer,name);await rename(join(consumer,base),dest);
			const read=path=>readFile(join(dest,path)), manifest=JSON.parse(await read("lean-bridge-package.json"));
			const ir=JSON.parse(await read("share/lean-bridge/binding-ir.json"));
			if(route==="ordinary") reviews[name]=ir; else assert.deepEqual(ir,reviews[name]);
			assert.equal(Boolean(manifest.reviewedSourceSha256),route==="reviewed");
			const [ledger,...extra]=Object.keys(manifest.files).filter(path=>/^lib\/liblb_task_resources_[a-f0-9]{64}\.so$/u.test(path));
			assert.ok(ledger && !extra.length); assert.equal(sha256(await read(ledger)),manifest.files[ledger].sha256);
			const record={ledger,ledgerDigest: manifest.files[ledger].sha256,component: manifest.componentSha256};
			if(route==="ordinary") manifests[name]=record; else assert.deepEqual(record,manifests[name]);
			receiptPaths[route+"-"+name]=sha256(await readFile(receiptPath));
			t.diagnostic(JSON.stringify({route,name,receipt: receiptPaths[route+"-"+name],archive: pkg.artifacts[0],...record}));
			if(evidence) await cp(out,join(evidence,route+"-"+name),{recursive: true});
			await rm(out,{recursive: true});
		}
		if(!parked)
		{
			assert.equal(manifests.depot.ledger,manifests.peer.ledger);
			assert.equal(manifests.depot.ledgerDigest,manifests.peer.ledgerDigest);
		}
		const relocated=join(phase,"relocated install");await rename(consumer,relocated);
		await cp(resolve("tests/fixtures/wit-task-package",parked?"parked-leases.c":retained?"retained-leases.c":"leases.c"),join(phase,"main.c"));
		await writeFile(join(phase,"lean_bridge_native_runtime.h"),linuxBrokerHeader);
		const clean={PATH: "/usr/bin:/bin",PKG_CONFIG_LIBDIR: names.map(n=>join(relocated,n,"lib/pkgconfig")).join(":")};
		const flags=(await run("pkg-config",["--cflags","--libs",...names.map(n=>n+"-wit")],phase,clean)).stdout.trim().match(/(?:\\.|[^\s\\])+/gu).map(s=>s.replace(/\\(.)/gu,"$1"));
		await run("cc",["-std=c11","-Wall","-Wextra","-Werror","-DCHECK_LEDGER","-I.","main.c",...flags,"-ldl","-o","consumer-program"],phase,clean);
		const actual=await run(join(phase,"consumer-program"),[],phase,{PATH: "/no-producer-tools",RAYON_NUM_THREADS: "1"});
		assert.equal(actual.stderr,"");assert.match(actual.stdout,parked?/Installed WIT leases: .* passed/u:/Independent WIT packages: .* passed/u);
		t.diagnostic(route+": "+actual.stdout.trim());
		await rm(phase,{recursive: true});
	}
	if(parked) return;
	const changed=join(root,"changed"),refused=join(root,"refused");await writeWitLeaseProject(changed,"Peer",reviews.peer,true,retained);
	await assert.rejects(build(changed,refused),e=>/Reviewed API differs/u.test([e.details?.stdout,e.details?.stderr].join("\n")));
	await assert.rejects(access(refused),{code: "ENOENT"});}
);
