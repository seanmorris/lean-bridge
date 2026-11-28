/** @file Check installed canonical and pollable WIT cursors against the same throwing Lean pull. */
import assert from "node:assert/strict";
import { access, copyFile, link, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCliNpmPackage } from "../../src/release/cli-npm-package.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { witInstalledReceipt } from "./wit-async-installed-receipt.mjs";

const fixture=resolve("tests/fixtures/wit-cursor-io");
const json=async p=>JSON.parse(await readFile(p,"utf8"));
const field="lean-bridge.dev/step-failure", ei="error:AsyncStep.Watch.feed";
const profiles=["native-wit-task-v1","native-wit-canonical-task-v1"];
const preserve=async (from,to)=>{
	try
	{ await link(from,to); }
	catch(e)
	{ if(e.code!=="EXDEV") throw e; await copyFile(from,to); }
};
const replay=process.env.LEAN_BRIDGE_WIT_CURSOR_REPLAY;
const selected=process.env.LEAN_BRIDGE_WIT_CURSOR_PROFILE??"both";
if(!["both","canonical","pollable"].includes(selected)) throw new Error("Expected WIT cursor profile: both, canonical or pollable");
const prepare=async (src,canonical,review)=>{
	await mkdir(src);
	await copyFile(join(fixture,"Watch.lean"),join(src,"Watch.lean"));
	await copyFile(resolve("tests/fixtures/wit-canonical-latches/lean-toolchain"),join(src,"lean-toolchain"));
	await copyFile(resolve("LICENSE"),join(src,"LICENSE"));
	await writeFile(join(src,"lakefile.toml"),'name = "watch"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Watch"\n');
	const counts=canonical?"Watch.closedNow":"Watch.closed";
	const cfg={schemaVersion: 1,modules: ["Watch"]
		, ...review?{}:{exports: ["Watch.feed","Watch.business",counts]}
		, ...canonical?{}:{taskExports: [counts]}
		, asyncIterators: [{open: "Watch.feed",next: "Watch.pull",close: "Watch.close"}
			, {open: "Watch.business",next: "Watch.businessPull",close: "Watch.businessClose"}]
		, targets: {"wit-wasi": {name: "watch",version: "1.0.0",...canonical?{asyncAbi: "canonical"}:{}}}};
	await writeFile(join(src,"lean-bridge.exports.json"),canonicalJson(cfg));
	if(review) await writeFile(join(src,"watch.binding-ir.json"),canonicalJson(review));
};
const probes=async ({prefix,archive,area,canonical,wasm,tools,env})=>{
	await run("tar",["-xzf",archive,"-C",area,"--no-same-owner","--no-same-permissions"],area,env);
	await rename(join(area,basename(archive,".tar.gz")),prefix);
	const runtime={PATH: "/no-author-tools",LEAN_NUM_THREADS: "1",RAYON_NUM_THREADS: "1"};
	if(canonical)
	{
		const manifest=await json(join(prefix,"lean-bridge-package.json")), world=join(prefix,manifest.world);
		assert.match(await readFile(world,"utf8"),/stream<result<result<u32, string>, string>>/u);
		await run(tools,["component","targets",world,wasm],area,env);
		const stdout=await run(join(prefix,manifest.command),[wasm],area,runtime);
		assert.equal(stdout,"4");
		return {client: "application.wat",clientSha256: sha256(await readFile(join(fixture,"application.wat"))),wasmSha256: sha256(await readFile(wasm)),stdout};
	} else
	{
		const world=join(prefix,"wit/watch.wit");
		assert.match(await readFile(world,"utf8"),/io-failed\(string\)/u);
		await run(tools,["component","targets",world,join(prefix,"component/watch.wasm")],area,env);
		const ccenv={PATH: "/usr/bin:/bin",PKG_CONFIG_LIBDIR: join(prefix,"lib/pkgconfig")};
		const args=await run("pkg-config",["--cflags","--libs","watch-wit"],area,ccenv);
		const flags=args.match(/(?:\\.|[^\s\\])+/gu).map(s=>s.replace(/\\(.)/gu,"$1"));
		await run("cc",["-std=c11","-Wall","-Wextra","-Werror",join(fixture,"consumer.c"),...flags,"-o","consumer"],area,ccenv);
		const stdout=await run(join(area,"consumer"),[],area,runtime);
		assert.equal(stdout,"pollable cursor: item, end, IO error, typed error, four closes");
		return {client: "consumer.c",clientSha256: sha256(await readFile(join(fixture,"consumer.c"))),stdout};
	}
};
const guest=async (temp,env)=>{
	const tools=env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools", wasm=join(temp,"app.wasm");
	await run(tools,["parse",join(fixture,"application.wat"),"-o",wasm],temp,env);
	await run(tools,["validate","--features","cm-async,cm-async-builtins",wasm],temp,env);
	return {tools,wasm,env};
};
const installed=async (out,area,options)=>{
	const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(out,"package-set-receipt.json")});
	assert.equal(receipt.packages.length,1);
	const [pkg]=receipt.packages; assert.ok(profiles.includes(pkg.profile));
	assert.deepEqual([pkg.target,pkg.role,pkg.runtimeDelivery,pkg.artifacts.length],["wit-wasi","component","embedded",1]);
	const [a]=pkg.artifacts;
	await mkdir(area);
	const prefix=join(area,"relocated watch");
	const observation=await probes({...options,area,canonical: pkg.profile===profiles[1],prefix,archive: join(out,a.path)});
	if(process.env.LEAN_BRIDGE_WIT_CURSOR_OBSERVATIONS)
	{
		const release=await witInstalledReceipt(prefix,{receipt,result});
		await writeFile(join(process.env.LEAN_BRIDGE_WIT_CURSOR_OBSERVATIONS,pkg.profile+"-"+release.route+".json"),canonicalJson({release,observation}),{flag: "wx"});
	}
	return result.receiptSha256;
};
if(replay) test("replay the installed WIT cursor consumer against one original receipt",async t=>{
	const temp=await mkdtemp(join(tmpdir(),"wit-cursor-replay-"));
	t.after(()=>rm(temp,{recursive: true,force: true}));
	t.diagnostic("replayed receipt "+await installed(resolve(replay),join(temp,"install"),await guest(temp,process.env)));
});
else test("installed WIT consumers distinguish an IO pull failure from typed failure and exhaustion: "+selected,{timeout: 5_400_000},async t=>{
	const temp=await mkdtemp(join(tmpdir(),"wit-cursor-io-"));
	t.after(()=>rm(temp,{recursive: true,force: true}));
	const candidate=await buildCliNpmPackage({outputRoot: join(temp,"candidate")}), author=join(temp,"author");
	const env={...process.env,npm_config_cache: join(temp,"npm-cache")};
	await run("npm",["install","--prefix",author,"--offline","--ignore-scripts","--no-audit","--no-fund",candidate.archive],temp,env);
	const cli=join(author,"node_modules/.bin/lean-bridge"), options=await guest(temp,env);
	const kept=env.LEAN_BRIDGE_WIT_CURSOR_HANDOFFS?await mkdtemp(join(env.LEAN_BRIDGE_WIT_CURSOR_HANDOFFS,"wit-cursor-releases-")):null;
	if(kept) t.diagnostic("retained handoffs: "+kept);
	for(const canonical of selected==="both"?[false,true]:[selected==="canonical"])
	{
		const profile=profiles[Number(canonical)];
		let ordinary;
		for(const route of ["ordinary","reviewed","rejected"])
		{
			const src=join(temp,"source"),out=join(temp,"output"),area=join(temp,"install");
			const review=ordinary?structuredClone(ordinary):null;
			if(route==="rejected") delete review.declarations.find(d=>d.source.declaration==="Watch.feed").source.extensions[field];
			await prepare(src,canonical,review);
			const publish=()=>run(process.execPath,[cli,"build","--project",src,"--target","wit-wasi","--output",out,"--json","--progress","none"],temp,env,900000);
			if(route==="rejected")
			{
				await assert.rejects(publish(),/reviewed.+(?:differs|match)/iu);
				await assert.rejects(access(join(out,"package-set-receipt.json")),{code: "ENOENT"});
				await rm(src,{recursive: true}); break;
			}
			await publish(); await rm(src,{recursive: true});
			const receiptPath=join(out,"package-set-receipt.json"), {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath});
			const [pkg]=receipt.packages,[a]=pkg.artifacts; assert.equal(pkg.profile,profile);
			const api=await json(join(out,"binding-ir.json")), ev=await json(join(out,"host-export-evidence.json"));
			assert.equal(ev.selection.witCursorIO,true);
			assert.equal(ev.reviewedSourceSha256,review?sha256(canonicalJson(review)):null);
			if(review) assert.deepEqual(api,ordinary); else ordinary=api;
			const op=name=>api.declarations.find(d=>d.source.declaration===name);
			assert.equal(op("Watch.feed").source.extensions[field],"IO.Error");
			assert.deepEqual(op("Watch.feed").failure.errors,[ei]); assert.equal(api.errors.find(e=>e.id===ei).payload,null);
			assert.equal(op("Watch.business").source.extensions[field],undefined);
			assert.deepEqual(api.errors.find(e=>e.id==="error:AsyncStep.Watch.business").payload,{kind: "primitive",name: "string"});
			let handoff=out;
			if(kept)
			{
				const dest=join(kept,profile+"-"+route);await mkdir(join(dest,"archives"),{recursive: true});
				for(const f of [a.path,"package-set-receipt.json","package-set-receipt.json.sha256","binding-ir.json","host-export-evidence.json"])
					await preserve(join(out,f),join(dest,f));
				handoff=dest;
			}
			assert.equal(await installed(handoff,area,options),result.receiptSha256);
			t.diagnostic(profile+" "+route+" "+a.bytes+" "+a.sha256+" receipt "+result.receiptSha256);
			await rm(area,{recursive: true}); await rm(out,{recursive: true});
		}
	}
});
