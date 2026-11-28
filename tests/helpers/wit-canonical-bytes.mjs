/** @file Check binary future and stream ownership using installed Wasmtime commands. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {copyFile,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename,join,resolve} from "node:path";
import test from "node:test";
import {promisify} from "node:util";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";

const exec=promisify(execFile),fixture=resolve("tests/fixtures/wit-canonical-bytes");
const tools=process.env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools";
const json=async path=>JSON.parse(await readFile(path,"utf8"));
test("relocated canonical futures and streams own their binary values", {timeout: 900000},async t=>{
	const temp=await mkdtemp(join(tmpdir(),"canonical-bytes-"));t.after(()=>rm(temp,{recursive: true,force: true}));
	const guest=join(temp,"app.wasm");
	await exec(tools,["parse",join(fixture,"application.wat"),"-o",guest]);
	await exec(tools,["validate","--features","cm-async,cm-async-builtins",guest]);
	let ordinary,hash;
	for(const route of ["ordinary","reviewed"])
	{
		const existing=process.env["LEAN_BRIDGE_CANONICAL_BYTES_"+route.toUpperCase()],out=existing?resolve(existing):join(temp,route);
		if(!existing)
		{
			const src=join(temp,"src");await mkdir(src);
			for(const f of ["Packet.lean","lean-bridge.exports.json","lakefile.toml"]) await copyFile(join(fixture,f),join(src,f));
			await copyFile(resolve("tests/fixtures/wit-canonical-latches/lean-toolchain"),join(src,"lean-toolchain"));
			if(ordinary) await writeFile(join(src,"packet.binding-ir.json"),canonicalJson(ordinary),{flag: "wx"});
			await exec(process.execPath,[resolve("scripts/lean-bridge.mjs"),"build","--project",src,"--target","wit-wasi","--output",out,"--json","--progress","none"])
				.catch(e=>{throw new Error(route+" WIT package: "+e.stdout+"\n"+e.stderr,{cause: e});});
			await rm(src,{recursive: true});
		}
		const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(out,"package-set-receipt.json")});
		const [pkg]=receipt.packages,[a]=pkg.artifacts;assert.equal(pkg.profile,"native-wit-canonical-task-v1");
		const api=await json(join(out,"binding-ir.json")),proof=await json(join(out,"host-export-evidence.json"));
		assert.equal(proof.reviewedSourceSha256,ordinary?sha256(canonicalJson(ordinary)):null);
		if(ordinary)
{assert.deepEqual(api,ordinary);assert.notEqual(a.sha256,hash);}
		else
{ordinary=api;hash=a.sha256;}
		const area=await mkdtemp(join(temp,"install-")),prefix=join(area,"installed binary channels");
		try
		{
			await exec("tar",["-xzf",join(out,a.path),"-C",area,"--no-same-owner","--no-same-permissions"]);
			await rename(join(area,basename(a.path,".tar.gz")),prefix);
			if(!existing) await rm(out,{recursive: true});
			const inner=await json(join(prefix,"lean-bridge-package.json")),world=join(prefix,inner.world);
			const source=await readFile(world,"utf8");
			assert.match(await readFile(join(prefix,"README.md"),"utf8"),/ByteArray values use list<u8>/u);
			assert.match(source,/result<future<result<list<u8>, list<u8>>>, list<u8>>/u);
			assert.match(source,/stream<result<list<u8>, list<u8>>>/u);
			await exec(tools,["component","targets",world,guest]);
			const run=await exec(join(prefix,inner.command),[guest],{cwd: area,env: {PATH: "/no-consumer-tools",LEAN_NUM_THREADS: "1",RAYON_NUM_THREADS: "1"},timeout: 20000});
			assert.equal(run.stdout.trim(),"2");t.diagnostic(route+" "+a.bytes+" bytes "+a.sha256);
		}
		finally
{await rm(area,{recursive: true,force: true});}
	}
});
