/** @file Install checksum-verified host crates as normal, exact Cargo dependencies. */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { installVerifiedRustCrate, rustLockPackages } from "./rust-task-install.mjs";
import { publishRustHosts } from "./rust-host-publish.mjs";

const json=async f=>JSON.parse(await readFile(f,"utf8"));
const exercise=async (root,out,route,env,workers=false)=>{
	const temp=await mkdtemp(join(root,"install-")),vendor=join(temp,"registry"),client=join(temp,"client");
	try
	{
		await mkdir(vendor);await mkdir(join(client,"src"),{recursive: true});await mkdir(join(client,".cargo"));
		const installed=new Map(),reports=[];
		for(const name of [route,"peer"])
		{
			const dir=join(out,name),{receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(dir,"package-set-receipt.json")});
			assert.deepEqual(result.profiles,["native-rust-host-v1"]);assert.equal(result.archives,2);
			const api=await json(join(dir,"binding-ir.json")),ev=await json(join(dir,"host-export-evidence.json"));
			assert.equal(hashBindingIr(api),receipt.profiles[0].bindingIrSha256);
			if(workers) assert.equal(ev.selection.staticTaskOwner,"rust");
			let component,runtime;
			for(const pkg of receipt.packages)
			{
				const [art]=pkg.artifacts,old=installed.get(pkg.name);
				if(old)
				{assert.equal(old.hash,art.sha256);assert.equal(old.version,pkg.version);runtime=old;continue;}
				const path=await installVerifiedRustCrate(vendor,pkg.name,pkg.version,join(dir,art.path),art.sha256,env);
				const meta=await json(join(path,"lean-bridge/package-receipt.json"));
				for(const [file,record] of Object.entries(meta.files))
				{
					const b=await readFile(join(path,file));assert.equal(b.length,record.bytes);assert.equal(sha256(b),record.sha256);
				}
				const info={path,version: pkg.version,hash: art.sha256,support: meta.supportId};installed.set(pkg.name,info);
				if(pkg.role==="component")
				{
					component=info;assert.equal(meta.profile,"native-rust-host-v1");
					assert.deepEqual(await json(join(path,"lean-bridge/binding-ir.json")),api);
					assert.deepEqual(await json(join(path,"lean-bridge/elaboration.json")),ev);
					assert.equal(sha256(await readFile(join(path,"lean-bridge/host-imports.json"))),ev.hostImportsSourceSha256);
					if(workers)
					{
						assert.ok(meta.files["lean-bridge/generated-workers.lean"]);
						assert.equal(Object.keys(meta.files).filter(p=>/^native\/linux-x64\/liblb_task_resources_[a-f0-9]{64}\.so$/u.test(p)).length,1);
					}
				} else
				{runtime=info;assert.equal(pkg.name,"lean-bridge-task-runtime");assert.ok(meta.profiles.includes("native-rust-host-v1"));}
			}
			assert.ok(component && runtime);assert.equal(component.support,runtime.support);
			const proof=workers?{bindingIr: receipt.profiles[0].bindingIrSha256,owner: ev.selection.staticTaskOwner,reviewed: ev.reviewedSourceSha256,source: ev.sourceTreeSha256}:{};
			reports.push({name,receipt: result.receiptSha256,component: component.hash,runtime: runtime.hash,...proof});
		}
		const registry=join(env.CARGO_HOME??join(homedir(),".cargo"),"registry/cache");
		const indexes=await readdir(registry),lock=await readFile(join(installed.get("workshop").path,"Cargo.lock"),"utf8");
		for(const dep of rustLockPackages(lock).filter(pkg=>pkg.source))
		{
			assert.equal(dep.source,"registry+https://github.com/rust-lang/crates.io-index");
			if(installed.has(dep.name))
			{assert.equal(installed.get(dep.name).hash,dep.checksum);continue;}
			const file=dep.name+"-"+dep.version+".crate";let src;
			for(const d of indexes) if((await readdir(join(registry,d))).includes(file))
			{src=join(registry,d,file);break;}
			assert.ok(src,"Missing locked Cargo dependency "+file);await installVerifiedRustCrate(vendor,dep.name,dep.version,src,dep.checksum,env);
		}
		await writeFile(join(client,".cargo/config.toml"),'[source.crates-io]\nreplace-with="verified"\n[source.verified]\ndirectory='+JSON.stringify(vendor)+'\n');
		await writeFile(join(client,"Cargo.toml"),'[package]\nname="host-consumer"\nversion="1.0.0"\nedition="2021"\n[dependencies]\nworkshop="=1.0.0"\npeer="=1.0.0"\n'+(workers?'async-io="=2.6.0"\n':"")+'[profile.dev]\ndebug=0\nincremental=false\n');
		await copyFile("tests/fixtures/rust-host-members/archives.rs",join(client,"src/main.rs"));
		if(workers)
		{
			await copyFile("tests/fixtures/rust-host-members/archives.rs",join(client,"src/synchronous.rs"));
			await copyFile("tests/fixtures/static-host-workers/consumer.rs",join(client,"src/main.rs"));
			await copyFile("tests/fixtures/static-host-workers/effects.rs",join(client,"src/effects.rs"));
		}
		const cargo=env.LEAN_BRIDGE_CARGO??"cargo",ce={...env,CARGO_HOME: join(temp,"empty-cargo"),CARGO_NET_OFFLINE: "true",CARGO_TARGET_DIR: join(temp,"target"),CARGO_BUILD_JOBS: "1",RUSTC: env.LEAN_BRIDGE_RUSTC??"rustc",RUSTFLAGS: "-Dwarnings -Ccodegen-units=1"};
		await run(cargo,["generate-lockfile","--offline"],client,ce);
		const graph=JSON.parse(await run(cargo,["metadata","--locked","--offline","--format-version","1"],client,ce));
		const providers=graph.packages.filter(p=>p.name==="lean-bridge-task-runtime");assert.equal(providers.length,1);
		assert.equal(providers[0].version,installed.get("lean-bridge-task-runtime").version);assert.deepEqual(graph.resolve.nodes.find(n=>n.id===providers[0].id).features,workers?["async","default","host-objects"]:["host-objects"]);
		await run(cargo,["build","--locked","--offline","-j1"],client,ce);
		const bin=join(temp,"deployed"),scratch=join(temp,"runtime-temp");await mkdir(scratch);
		await rename(join(ce.CARGO_TARGET_DIR,"debug/host-consumer"),bin);
		for(const path of [client,ce.CARGO_TARGET_DIR,ce.CARGO_HOME,vendor]) await rm(path,{recursive: true,force: true});
		const isolated={PATH: "/no-tools",LEAN_NUM_THREADS: "1",TMPDIR: scratch,LANG: "C",LD_LIBRARY_PATH: ""};
		assert.doesNotMatch(await run("ldd",[bin],temp,{...env,LD_LIBRARY_PATH: ""}),/liblean|liblb_rust/u);
		for(const mode of workers?["workers","panic-worker"]:["forward","reverse","invalid-receiver","invalid-parameter","panic"])
		{
			const output=await run(bin,[mode],temp,isolated);
			assert.match(output,workers?/worker checks passed/u:/strong cleanup|retired both archives; closed cleanly/u);
		}
		return reports;
	} finally
	{await rm(temp,{recursive: true,force: true});}
};

for(const workers of [false,true]) test("ordinary and reviewed Rust "+(workers?"worker":"host")+" archives run offline through one exact Cargo provider",{timeout: 3600000},async t=>{
	const env=process.env,root=await mkdtemp(join(tmpdir(),"cargo-host-acceptance-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const replay=workers?env.LEAN_BRIDGE_RUST_WORKER_REPLAY:env.LEAN_BRIDGE_RUST_HOST_REPLAY,keep=env.LEAN_BRIDGE_RUST_HOST_HANDOFFS;
	const out=replay?resolve(replay):await mkdtemp(join(keep??root,"cargo-host-releases-"));
	const check=async route=>t.diagnostic(JSON.stringify(await exercise(root,out,route,env,workers)));
	if(!replay) await publishRustHosts(root,out,env,workers,check);
	else for(const route of ["ordinary","reviewed"]) await check(route);
});
