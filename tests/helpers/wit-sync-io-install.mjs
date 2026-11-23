/** @file Exercise a relocated synchronous WIT host using only its consumer files. */
import assert from "node:assert/strict";
import { appendFile, copyFile, cp, link, mkdir, rename } from "node:fs/promises";
import { join, resolve } from "node:path";

// Keep large, immutable runtime inputs on one inode when possible. Never
// modify a linked library: the rejection fixture below uses a private copy.
const stageLibrary = async (source,destination) => {
	try
	{ await link(source,destination); }
	catch(error)
	{
		if(error.code!=="EXDEV") throw error;
		await copyFile(source,destination);
	}
};

/**
 * Link against a consumer layout, move it, and hide the original build before
 * executing. The program gets no producer paths or build tools at runtime.
 *
 * @param options - Verified libraries, producer paths and consumer test configuration.
 */
export const testRelocatedWitIO = async options => {
	const {work,app,runtimeRoot,host,cc,run,t,module,wide} = options;
	const sdk = join(app,"wasmtime"), stage = join(work,"prepared"), dest = join(work,"relocated");
	const libs = join(stage,"lib"), inc = join(stage,"include");
	await mkdir(libs,{recursive: true});
	await cp(join(sdk,"include"),inc,{recursive: true});
	await copyFile(join(app,host.header),join(inc,host.header));
	for(const file of ["world.wit","component.wasm"]) await copyFile(join(app,file),join(stage,file));
	await copyFile(join(app,host.library),join(libs,host.library));
	for(const {name} of host.dependencies)
	{
		const root = name==="libwasmtime.so"?sdk:runtimeRoot;
		await stageLibrary(join(root,"lib",name),join(libs,name));
	}
	await run(cc,["-std=c11","-O1","-Wall","-Wextra","-Werror"
		, "-DWIT_HEADER="+JSON.stringify(host.header),"-DWIT_PREFIX="+host.prefix
		, ...(module==="Ledger"?["-DLEDGER"]:[]),...(wide?["-DWIDE"]:[])
		, "-I",inc,resolve("tests/fixtures/wit-sync-io/consumer.c")
		, "-L",libs,"-l:"+host.library,"-lwasmtime","-Wl,-rpath-link,"+libs
		, "-Wl,-rpath,$ORIGIN/lib","-o",join(stage,"consumer")]);
	await rename(stage,dest); await rename(app,join(work,"disabled-producer"));
	const env = {PATH: "/no-build-tools",RAYON_NUM_THREADS: "1"};
	const launch = (args,e)=>run(join(dest,"consumer"),args,dest,e);
	const ran = await launch([],env);
	assert.match(ran.stdout,/^wasmtime-io:\d+\n$/u); assert.equal(ran.stderr,"");
	t.diagnostic("relocated "+ran.stdout.trim()+"; host SHA-256 "+host.librarySha256);
	if(module==="Ledger")
	{
		const alt = join(work,"other"), name = "liblean_bridge_native.so";
		await mkdir(alt); await copyFile(join(dest,"lib",name),join(alt,name));
		await appendFile(join(alt,name),"different installation");
		const rejected = await launch(["dependency"],{...env,LD_LIBRARY_PATH: alt});
		assert.equal(rejected.stdout.trim(),"mismatched-loaded-dependency:rejected");
		assert.equal(rejected.stderr,""); t.diagnostic(rejected.stdout.trim());
	}
};
