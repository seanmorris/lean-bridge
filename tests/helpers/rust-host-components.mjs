/** @file Compile two ordinary Cargo API crates and run their customer with no publisher tools. */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { rustHostFacade } from "../../src/backends/rust/host-facade.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { buildRustHostPair } from "./rust-host-pair.mjs";

test("two Cargo components share Rust application objects and original member errors across real Lean calls", async t => {
	const env=process.env, root=await mkdtemp(join(tmpdir(),"rust-host-client-"));
	t.after(()=>rm(root,{recursive: true,force: true}));
	const replay=env.LEAN_BRIDGE_RUST_HOST_LIBS;
	const prefix=replay?resolve(replay):join(root,"native");
	if(!replay) await buildRustHostPair(root,prefix,env);
	const {packages,libs}=JSON.parse(await readFile(join(prefix,"pair.json"),"utf8"));
	const work=join(root,"sources"),stage=join(root,"staged"),app=join(root,"relocated");
	await mkdir(work);await mkdir(stage);
	for(const [name,expected] of Object.entries(libs))
	{
		assert.match(name,/^lib[a-z0-9_]+\.so$/u);
		const bytes=await readFile(join(prefix,name));assert.equal(sha256(bytes),expected);
		await writeFile(join(stage,name),bytes);
	}
	const crate=async (name,dependency,src)=>{
		const dir=join(work,name);await mkdir(join(dir,"src"),{recursive: true});
		await writeFile(join(dir,"Cargo.toml"),'[package]\nname="'+name+'"\nversion="1.0.0"\nedition="2021"\n'+dependency);
		await writeFile(join(dir,"src/lib.rs"),src);return dir;
	};
	const runtimeSrc=resolve("src/backends/rust/task-runtime/src");
	for(const name of ["lean-bridge-host-runtime","duplicate-owner"])
	{
		const runtime=await crate(name,'[features]\ndefault=["host-objects"]\nasync=[]\nhost-objects=[]\n',await readFile(join(runtimeSrc,"lib.rs"),"utf8"));
		for(const file of ["resource.rs","owner.rs","port.rs"]) await copyFile(join(runtimeSrc,file),join(runtime,"src",file));
	}
	for(const pkg of packages)
	{
		assert.ok(["workshop","peer"].includes(pkg.name));assert.ok(Object.hasOwn(libs,pkg.component) && Object.hasOwn(libs,pkg.domain));
		await crate(pkg.name,'[dependencies]\nlean-bridge-host-runtime={path="../lean-bridge-host-runtime"}\n',rustHostFacade(pkg));
		if(pkg.name==="peer") await crate("impostor",'[dependencies]\nlean-bridge-host-runtime={package="duplicate-owner",path="../duplicate-owner"}\n',rustHostFacade(pkg));
	}
	const client=join(work,"client");await mkdir(join(client,"src"),{recursive: true});
	await writeFile(join(client,"Cargo.toml"),'[package]\nname="client"\nversion="1.0.0"\nedition="2021"\n[dependencies]\nworkshop={path="../workshop"}\npeer={path="../peer"}\nimpostor={path="../impostor"}\n[profile.dev]\ndebug=0\nincremental=false\n');
	await copyFile("tests/fixtures/rust-host-members/client.rs",join(client,"src/main.rs"));
	const cargo=env.LEAN_BRIDGE_CARGO??"cargo";
	const ce={...env,CARGO_NET_OFFLINE: "true",CARGO_HOME: join(root,"empty-cargo"),CARGO_BUILD_JOBS: "1",CARGO_TARGET_DIR: join(root,"build"),RUSTC: env.LEAN_BRIDGE_RUSTC??"rustc",RUSTFLAGS: "-Dwarnings -Lnative="+prefix+" -Clink-arg=-Wl,-rpath-link,"+prefix+" -Clink-arg=-Wl,-rpath,$ORIGIN"};
	await run(cargo,["generate-lockfile","--offline"],client,ce);await run(cargo,["build","--locked","--offline","-j1"],client,ce);
	await copyFile(join(ce.CARGO_TARGET_DIR,"debug/client"),join(stage,"client"));await rm(work,{recursive: true});await rm(ce.CARGO_TARGET_DIR,{recursive: true});await rename(stage,app);
	const isolated={PATH: "/no-publisher-tools",LANG: "C",LEAN_NUM_THREADS: "1",LD_LIBRARY_PATH: ""};
	const deps=await run("ldd",["./client"],app,{...env,LD_LIBRARY_PATH: ""});
	const found=new Set();
	for(const line of deps.split("\n"))
	{
		const m=/^\s*(\S+) => (.+?) \(/u.exec(line);
		if(!m || !Object.hasOwn(libs,m[1])) continue;
		assert.equal(await realpath(m[2]),join(app,m[1]));found.add(m[1]);
	}
	assert.deepEqual([...found].sort(),Object.keys(libs).sort());
	for(const mode of ["forward","reverse"]) assert.match(await run("./client",[mode],app,isolated),/original Rc and error/u);
	t.diagnostic(canonicalJson(libs));
});
