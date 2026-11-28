/** @file Install ordinary and reviewed synchronous WIT cursor packages as an offline consumer. */
import assert from "node:assert/strict";
import {access,copyFile,cp,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {processBuildRunner} from "../../src/build/process-runner.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";

test("ordinary and reviewed WIT cursor archives run without producer inputs",async t=>{
	const work=await mkdtemp(join(tmpdir(),"wit-cursor-install-")); t.after(()=>rm(work,{recursive: true,force: true}));
	const cli=resolve("scripts/lean-bridge.mjs");
	const run=async(command,args,cwd,env=process.env)=>{
		try
		{ return await processBuildRunner.capture({command,args,cwd,env}); }
		catch(e)
		{ throw new Error([command,e.message,e.details?.stderr,e.details?.stdout].filter(Boolean).join("\n"),{cause: e}); }
	};
	let review;
	for(const route of ["ordinary","reviewed"])
	{
		const base=join(work,route),src=join(base,"source"),out=join(base,"release"),consumer=join(base,"consumer");
		await mkdir(base); await cp(resolve("tests/fixtures/native-immediate-cursor"),src,{recursive: true});
		const config=join(src,"lean-bridge.exports.json"),cfg=JSON.parse(await readFile(config));
		cfg.targets={"wit-wasi": {name: "dials",version: "1.0.0"}};
		if(review)
		{ delete cfg.exports; await writeFile(join(src,"public.binding-ir.json"),review); }
		await writeFile(config,canonicalJson(cfg));
		const build=()=>run(process.execPath,[cli,"build","--project",src,"--target","wit-wasi","--output",out],base);
		await build(); const receiptPath=join(out,"package-set-receipt.json");
		await run(process.execPath,[cli,"verify","--receipt",receiptPath],base);
		const {receipt}=await readVerifiedPackageSetReceipt({receiptPath});
		assert.equal(receipt.packages.length,1); const [pkg]=receipt.packages; assert.equal(pkg.profile,"native-wit-io-v1");
		assert.equal(pkg.artifacts.length,1); const [archive]=pkg.artifacts;
		const receiptHash=sha256(await readFile(receiptPath));
		const ir=JSON.parse(await readFile(join(out,"binding-ir.json"))); assert.equal(ir.declarations.filter(d=>d.resultMode==="iterator").length,3);
		await mkdir(consumer); await copyFile(resolve("tests/fixtures/wit-sync-io/cursor.c"),join(consumer,"client.c"));
		const packed=join(consumer,"package.tar.gz"); await rename(join(out,archive.path),packed);
		await rm(src,{recursive: true}); await rm(out,{recursive: true});
		await run("tar",["-xzf",packed],consumer); await rm(packed);
		const installed=join(consumer,"relocated");
		await rename(join(consumer,"dials-1.0.0-wit-wasi"),installed);
		const metadata=join(installed,"share/lean-bridge"),evidence=JSON.parse(await readFile(join(metadata,"elaboration.json")));
		assert.equal(evidence.selection.iterators.length,3);
		if(review)
		{
			assert.equal(evidence.reviewedSourceSha256,sha256(review));
			assert.equal(await readFile(join(metadata,"reviewed.binding-ir.json"),"utf8"),review);
		} else
		{
			assert.equal(evidence.reviewedSourceSha256,null);
			ir.documentation.summary="Independently reviewed Dials iterator interface."; review=JSON.stringify(ir,null,4)+"\n";
		}
		const environment={PATH: "/usr/bin:/bin",PKG_CONFIG_LIBDIR: join(installed,"lib/pkgconfig"),RAYON_NUM_THREADS: "1"};
		const {stdout}=await run("pkg-config",["--cflags","--libs","dials-wit"],consumer,environment);
		const flags=stdout.trim().match(/(?:\\.|[^\s\\])+/gu).map(s=>s.replace(/\\(.)/gu,"$1"));
		await run("cc",["-std=c11","-Wall","-Wextra","-Werror","client.c",...flags,"-o","client"],consumer,environment);
		for(const args of [[],[join(installed,"component/dials.wasm")]])
		{
			const client=await run(join(consumer,"client"),args,consumer,{PATH: "/no-tools",RAYON_NUM_THREADS: "1"});
			assert.equal(client.stdout.trim(),"direct-wit:6 opens;8 pulls;6 closes"); assert.equal(client.stderr,"");
			assert.equal(await readFile(join(consumer,"state"),"utf8"),"closed"); await rm(join(consumer,"state"));
		}
		const wat=await readFile(join(installed,"component/dials.wat"),"utf8");
		const factory=/\(alias export \$host "sequence" \(func \$host(\d+)\)\)/u.exec(wat);
		assert.ok(factory); const open="call $f"+factory[1]+"\n";
		const trap=wat.replace(open,open+"      unreachable\n"); assert.notEqual(trap,wat);
		await writeFile(join(consumer,"trap.wat"),trap);
		const tools=process.env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools";
		await run(tools,["parse","trap.wat","-o","trap.wasm"],consumer);
		await run(tools,["component","targets",join(installed,"wit/dials.wit"),"trap.wasm"],consumer);
		const fault=await run(join(consumer,"client"),["trap.wasm","trap"],consumer,{PATH: "/no-tools",RAYON_NUM_THREADS: "1"});
		assert.equal(fault.stdout.trim(),"direct-wit:trapped;output-unchanged;peer-retired");
		await assert.rejects(access(join(consumer,"state")),{code: "ENOENT"});
		const exit=await run(join(consumer,"client"),["exit"],consumer,{PATH: "/no-tools",RAYON_NUM_THREADS: "1"});
		assert.equal(exit.stdout.trim(),"direct-wit:abandoned-at-exit");
		assert.equal(await readFile(join(consumer,"state"),"utf8"),"closed");
		t.diagnostic(route+" receipt="+receiptHash+" archive="+archive.sha256+"; private and external store consumers passed");
		await rm(base,{recursive: true}); await assert.rejects(access(base),{code: "ENOENT"});
	}
});

test("WIT direct cursor packaging rejects a missing close grant and scheduled exports",async t=>{
	const root=await mkdtemp(join(tmpdir(),"wit-cursor-refusal-")); t.after(()=>rm(root,{recursive: true,force: true}));
	const src=join(root,"src"),out=join(root,"release"),config=join(src,"lean-bridge.exports.json");
	await cp(resolve("tests/fixtures/native-immediate-cursor"),src,{recursive: true});
	const cfg=JSON.parse(await readFile(config)); cfg.targets={"wit-wasi": {name: "dials",version: "1.0.0"}};
	for(const [extra,expected] of [[{nativeEffects: []},/Dials\.finish requires nativeEffects "filesystem"/u]
		, [{taskExports: ["Dials.counts"]},/standalone synchronous IO package/u]]){
		await writeFile(config,canonicalJson({...cfg,...extra}));
		await assert.rejects(processBuildRunner.capture({command: process.execPath
			, args: [resolve("scripts/lean-bridge.mjs"),"build","--project",src,"--target","wit-wasi","--output",out]
			, cwd: root})
			,e=>expected.test([e.details?.stderr,e.details?.stdout,e.message].join(" ")));
		await assert.rejects(access(out),{code: "ENOENT"});
		}
});
