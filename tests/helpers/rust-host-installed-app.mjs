/** @file Compile downstream Rust applications from a checksum-verified offline registry. */
import assert from "node:assert/strict";
import {copyFile,mkdir,mkdtemp,readFile,readdir,rename,rm,writeFile} from "node:fs/promises";
import {homedir} from "node:os";
import {join} from "node:path";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {installVerifiedRustCrate,rustLockPackages} from "./rust-task-install.mjs";

/**
 * Install the verified component and runtime in a fresh offline Cargo project.
 *
 * @param options - Release, consumer source, toolchain and optional async feature.
 */
export const installRustHostApp=async options=>{
	const {root,out,receipt,worker=false,env,source,peer,component="workshop",preserveHandoff=false}=options;
	const pkg=receipt.packages.find(p=>p.role==="component");assert.equal(pkg?.name,component);
	const temp=await mkdtemp(join(root,"install-")),vendor=join(temp,"vendor"),src=join(temp,"consumer"),runtime=join(temp,"runtime");
	await mkdir(vendor);await mkdir(join(src,"src"),{recursive: true});await mkdir(join(src,".cargo"));await mkdir(runtime);
	const installed=new Map(),releases=[{out,receipt}];
	if(peer) releases.push(peer);
	for(const release of releases) for(const p of release.receipt.packages)
	{
		const [a]=p.artifacts;
		const prior=installed.get(p.name);
		if(prior)
		{
			assert.equal(p.role,"runtime");assert.equal(p.version,prior.version);assert.equal(a.sha256,prior.hash);continue;
		}
		const dir=await installVerifiedRustCrate(vendor,p.name,p.version,join(release.out,a.path),a.sha256,env);
		installed.set(p.name,{dir,hash: a.sha256,version: p.version});
	}
	if(!preserveHandoff) await rm(out,{recursive: true});
	const cache=join(env.CARGO_HOME??join(homedir(),".cargo"),"registry/cache"),indexes=await readdir(cache);
	const lock=await readFile(join(installed.get(component).dir,"Cargo.lock"),"utf8");
	for(const p of rustLockPackages(lock).filter(x=>x.source))
	{
		if(installed.has(p.name))
		{assert.equal(installed.get(p.name).hash,p.checksum);continue;}
		const name=p.name+"-"+p.version+".crate";let path;
		for(const index of indexes) if((await readdir(join(cache,index))).includes(name))
		{path=join(cache,index,name);break;}
		assert.ok(path,"Locked offline dependency missing: "+name);
		await installVerifiedRustCrate(vendor,p.name,p.version,path,p.checksum,env);
	}
	await writeFile(join(src,".cargo/config.toml"),'[source.crates-io]\nreplace-with="verified"\n[source.verified]\ndirectory='+JSON.stringify(vendor)+'\n');
	const dependency=JSON.stringify(component)+"="+JSON.stringify("="+pkg.version)+"\n";
	await writeFile(join(src,"Cargo.toml"),'[package]\nname="host-consumer"\nversion="1.0.0"\nedition="2021"\n[features]\nworker=[]\n[dependencies]\n'+dependency+(worker?'async-io="=2.6.0"\n':"")+(peer?'inspector="=1.0.0"\n':"")+'[profile.dev]\ndebug=0\nincremental=false\n');
	await copyFile(source,join(src,"src/main.rs"));
	const cargo=env.LEAN_BRIDGE_CARGO??"cargo",target=join(temp,"target");
	const ce={...env,CARGO_HOME: join(temp,"empty-home"),CARGO_NET_OFFLINE: "true",CARGO_TARGET_DIR: target,CARGO_BUILD_JOBS: "1",RUSTC: env.LEAN_BRIDGE_RUSTC??"rustc",RUSTFLAGS: "-Dwarnings -Ccodegen-units=1"};
	await run(cargo,["generate-lockfile","--offline"],src,ce);
	const flags=worker?["--features","worker"]:[];
	await run(cargo,["build","--locked","--offline","-j1",...flags],src,ce);
	const bin=join(runtime,"application");await rename(join(target,"debug/host-consumer"),bin);
	const isolate=async()=>{
		for(const path of [src,target,ce.CARGO_HOME,vendor])await rm(path,{recursive: true,force: true});
		return {PATH: "/no-tools",LD_LIBRARY_PATH: "",LEAN_NUM_THREADS: "1",TMPDIR: runtime};
	};
	return {temp,src,runtime,cargo,ce,bin,isolate};
};
