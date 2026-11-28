/** @file Verify, extract and execute a CLI-built WIT IO archive outside its producer. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

const handoff = process.env.LEAN_BRIDGE_WIT_IO_HANDOFF;
test("install the verified synchronous WIT CLI archive and call Journal without producer tools", {skip: !handoff}, async t=>{
	const work = await mkdtemp(join(tmpdir(),"wit-archive-consumer-")); t.after(()=>rm(work,{recursive: true,force: true}));
	const cwd = join(work,"consumer"); await mkdir(cwd);
	const run = async (command,args,env=process.env)=>{
		try
		{ return await processBuildRunner.capture({command,args,cwd,env}); }
		catch(error)
		{ t.diagnostic(error.details?.stderr ?? error.message); throw error; }
	};
	const receiptPath = resolve(handoff,"package-set-receipt.json");
	const cli = resolve(process.env.LEAN_BRIDGE_WIT_IO_CLI ?? "scripts/lean-bridge.mjs");
	await run(process.execPath,[cli,"verify","--receipt",receiptPath]);
	const {receipt, result} = await readVerifiedPackageSetReceipt({receiptPath});
	assert.equal(receipt.packages.length,1); const [pkg] = receipt.packages;
	assert.equal(pkg.profile,"native-wit-io-v1"); assert.equal(pkg.target,"wit-wasi");
	assert.equal(pkg.runtimeDelivery,"embedded"); assert.equal(pkg.artifacts.length,1);
	const [a] = pkg.artifacts, archive = join(dirname(receiptPath),a.path);
	const root = pkg.name+"-"+pkg.version+"-wit-wasi";
	assert.equal(a.path,"archives/"+root+".tar.gz");
	const paths = (await run("tar",["-tzf",archive])).stdout.trim().split("\n");
	assert.ok(paths.every(s=>s.startsWith(root+"/") && !s.split("/").includes("..")));
	await run("tar",["-xzf",archive]); const dest = join(work,"installed");
	await rename(join(cwd,root),dest);
	const read = p=>readFile(join(dest,p)), json = async p=>JSON.parse(await read(p));
	const manifest = await json("lean-bridge-package.json");
	assert.equal(manifest.profile,pkg.profile);
	assert.deepEqual(manifest.nativeEffects,["filesystem"]);
	assert.equal(manifest.runtimeIdentity,pkg.runtimeIdentity);
	const files = await nativeArtifactPaths(dest);
	assert.deepEqual(files,["lean-bridge-package.json",...Object.keys(manifest.files)].sort());
	for(const [file,id] of Object.entries(manifest.files))
	{
		const bytes = await read(file); assert.equal(bytes.length,id.bytes); assert.equal(sha256(bytes),id.sha256,file);
	}
	const api = await json("share/lean-bridge/binding-ir.json");
	const evidence = await json("share/lean-bridge/elaboration.json");
	assert.equal(hashBindingIr(api),receipt.profiles[0].bindingIrSha256);
	assert.equal(evidence.sourceTreeSha256,receipt.source.treeSha256);
	assert.equal(evidence.selection.synchronousIO,true);
	assert.equal(canonicalJson(api),await readFile(join(handoff,"binding-ir.json"),"utf8"));
	assert.equal(evidence.reviewedSourceSha256!==null,process.env.LEAN_BRIDGE_WIT_IO_EXPECT_REVIEW==="1");
	if(evidence.reviewedSourceSha256!==null)
	{
		const source = await read("share/lean-bridge/reviewed.binding-ir.json");
		assert.equal(sha256(source),evidence.reviewedSourceSha256);
		assert.equal(manifest.reviewedSourceSha256,evidence.reviewedSourceSha256);
		assert.equal(hashBindingIr(JSON.parse(source)),hashBindingIr(api));
	}
	const wasmTools = process.env.LEAN_BRIDGE_WASM_TOOLS ?? "wasm-tools";
	await run(wasmTools,["component","targets",join(dest,"wit",pkg.name+".wit"),join(dest,"component",pkg.name+".wasm")]);
	const flags = await run("pkg-config",["--cflags","--libs",pkg.name+"-wit"],{PATH: process.env.PATH,PKG_CONFIG_LIBDIR: join(dest,"lib/pkgconfig")});
	// All three paths may contain spaces, for which pkg-config writes "\ ".
	const tokens = flags.stdout.trim().match(/(?:\\.|[^\s\\])+/gu).map(s=>s.replace(/\\(.)/gu,"$1"));
	const clientSha256 = {};
	for(const name of ["consumer.c","scalars.h","custom.c"])
	{
		const bytes = await readFile(join("tests/fixtures/wit-sync-io",name));
		await writeFile(join(cwd,name),bytes,{flag: "wx"});
		clientSha256[name] = sha256(bytes);
	}
	await run(process.env.CC ?? "cc",["-std=c11","-Wall","-Wextra","-Werror"
		, '-DWIT_HEADER="journal_wasmtime.h"',"-DWIT_PREFIX=journal"
		, "consumer.c",...tokens,"-o","app"]);
	const ran = await run(join(cwd,"app"),[],{PATH: "/no-tools",RAYON_NUM_THREADS: "1"});
	assert.equal(ran.stdout.trim(),"wasmtime-io:27"); assert.equal(ran.stderr,"");
	await run(process.env.CC ?? "cc",["-std=c11","-Wall","-Wextra","-Werror","custom.c",...tokens,"-o","custom"]);
	const binary = join(dest,"component",pkg.name+".wasm"), wat = await readFile(join(dest,"component",pkg.name+".wat"),"utf8");
	const bump = api.declarations.findIndex(d=>d.source.declaration==="Journal.bump"); assert.notEqual(bump,-1);
	const call = "call $f"+bump+"\n", bad = wat.replace(call,call+"      unreachable\n"); assert.notEqual(wat,bad);
	await writeFile(join(cwd,"trap.wat"),bad); await run(wasmTools,["parse","trap.wat","-o","trap.wasm"]);
	await run(wasmTools,["component","targets",join(dest,"wit",pkg.name+".wit"),"trap.wasm"]);
	const iface = "lean-bridge:"+pkg.name+"/api@"+pkg.version;
	const stores = {};
	for(const [file,mode,expected] of [[binary,"success","ready:peer-count:2"],[join(cwd,"trap.wasm"),"trap","trap:discard:peer-retired"]])
	{
		const custom = await run(join(cwd,"custom"),[file,iface,mode],{PATH: "/no-tools",RAYON_NUM_THREADS: "1"});
		assert.equal(custom.stdout.trim(),"custom-store:"+expected); assert.equal(custom.stderr,""); t.diagnostic(custom.stdout.trim());
		stores[mode] = custom.stdout.trim();
	}
	const output = process.env.LEAN_BRIDGE_WIT_IO_RESULTS;
	if(output)
	{
		const route = evidence.reviewedSourceSha256 === null ? "ordinary" : "reviewed";
		const record = {route, receiptSha256: result.receiptSha256, archiveSha256: a.sha256, archiveBytes: a.bytes,
			sourceTreeSha256: receipt.source.treeSha256, reviewedSourceSha256: evidence.reviewedSourceSha256,
			bindingIrSha256: hashBindingIr(api), runtimeIdentity: pkg.runtimeIdentity, nativeEffects: manifest.nativeEffects,
			clientSha256, session: ran.stdout.trim(), stores};
		await mkdir(output,{recursive: true});
		await writeFile(join(output,route+".json"),canonicalJson(record));
	}
	t.diagnostic([pkg.name+"@"+pkg.version,a.bytes+" bytes",a.sha256,ran.stdout.trim()].join("; "));
});
