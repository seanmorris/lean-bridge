/** @file Drive the public native WIT IO CLI from ordinary and independently reviewed Lean inputs. */
import assert from "node:assert/strict";
import test from "node:test";
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";

const testPackage = process.env.LEAN_BRIDGE_WIT_IO_PACKAGE_TEST==="1";
test("public WIT IO release: ordinary, reviewed, relocated and rejected projects", {skip: !testPackage}, async t=>{
	const keep = process.env.LEAN_BRIDGE_WIT_IO_EVIDENCE, root = keep ?? await mkdtemp(join(tmpdir(),"wit-io-release-"));
	if(keep) await mkdir(root); else t.after(()=>rm(root,{recursive: true,force: true}));
	const src = join(root,"source"), config = join(src,"lean-bridge.exports.json");
	await cp(resolve("tests/fixtures/native-sync-io"),src,{recursive: true});
	const cfg = JSON.parse(await readFile(config));
	const cli = resolve(process.env.LEAN_BRIDGE_WIT_IO_CLI ?? "scripts/lean-bridge.mjs");
	const install = resolve("tests/helpers/wit-sync-io-package.mjs");
	const run = (args,env=process.env)=>{
		const standalone = {...env}; delete standalone.NODE_TEST_CONTEXT;
		return processBuildRunner.capture({command: process.execPath,args,cwd: resolve("."),env: standalone});
	};
	const build = output=>run([cli,"build","--project",src,"--target","wit-wasi","--output",output]);
	const check = async (out,review)=>{
		const result = await run(["--test",install],{...process.env,LEAN_BRIDGE_WIT_IO_HANDOFF: out,LEAN_BRIDGE_WIT_IO_EXPECT_REVIEW: review?"1":"0"});
		assert.match(result.stdout,/custom-store:trap:discard:peer-retired/u); assert.match(result.stdout,/wasmtime-io:27/u);
		t.diagnostic(result.stdout.split("\n").filter(s=>s.startsWith("# journal") || s.startsWith("# custom-store")).join("\n"));
	};
	const reference = process.env.LEAN_BRIDGE_WIT_IO_ORDINARY, ordinary = reference ?? join(root,"ordinary");
	try
	{
		if(!reference) await build(ordinary);
		await check(ordinary,false);
		const reviewed = join(root,"reviewed"), file = join(src,"public.binding-ir.json");
		const ir = JSON.parse(await readFile(join(ordinary,"binding-ir.json")));
		ir.documentation.summary="Reviewed Journal synchronous IO API.";
		const reviewSource = JSON.stringify(ir,null,4)+"\n";
		await writeFile(file,reviewSource,{flag: "wx"}); delete cfg.exports;
		await writeFile(config,canonicalJson(cfg)); await build(reviewed); await check(reviewed,true);
		const bad = join(root,"refused");
		const reject = async (reason)=>{
			await assert.rejects(build(bad),e=>{
				assert.match([e.details?.stderr,e.details?.stdout,e.message].join("\n"),reason); return true;
			});
			await assert.rejects(access(bad),{code: "ENOENT"});
		};
		const alter = ir.declarations.find(d=>d.source.declaration==="Journal.count"); alter.result.type.name="uint64";
		await writeFile(file,canonicalJson(ir)); await reject(/Reviewed API differs/u);
		await writeFile(file,reviewSource);
		await writeFile(config,canonicalJson({...cfg,nativeEffects: []})); await reject(/requires nativeEffects "filesystem"/u);
		await writeFile(config,canonicalJson({...cfg,taskExports: ["Journal.count"]})); await reject(/standalone synchronous exports/u);
		t.diagnostic("Changed review, missing grant and incompatible task selection refused with no release directory.");
	}
	catch(e)
	{ t.diagnostic([e.details?.stderr,e.details?.stdout].filter(Boolean).join("\n")); throw e; }
});
