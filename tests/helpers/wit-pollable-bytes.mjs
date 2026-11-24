/** @file Build pollable binary task releases with an installed CLI; link a plain C consumer. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {copyFile,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename,join,resolve} from "node:path";
import test from "node:test";
import {promisify} from "node:util";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {buildCliNpmPackage} from "../../src/release/cli-npm-package.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";

const exec=promisify(execFile),fixture=resolve("tests/fixtures/wit-pollable-bytes");
const json=async file=>JSON.parse(await readFile(file,"utf8"));
test("installed Wasmtime pollable tasks, streams and owner callbacks copy binary values",{timeout: 900000},async t=>{
	const temp=await mkdtemp(join(tmpdir(),"pollable-bytes-"));
	t.after(()=>rm(temp,{recursive: true,force: true}));
	const env={...process.env,npm_config_cache: join(temp,"npm-cache")},author=join(temp,"author");
	const cliPackage=await buildCliNpmPackage({outputRoot: join(temp,"cli")});
	await exec("npm",["install","--offline","--ignore-scripts","--no-audit","--no-fund","--no-package-lock","--prefix",author,cliPackage.archive],{env});
	const cli=join(author,"node_modules/.bin/lean-bridge");let ordinary,hash;
	for(const route of ["ordinary","reviewed"])
	{
		const src=join(temp,"source"),out=join(temp,"handoff"),area=join(temp,"install");
		await mkdir(src);await mkdir(area);
		for(const f of ["Host.lean","lean-bridge.exports.json","lakefile.toml"]) await copyFile(join(fixture,f),join(src,f));
		await copyFile(resolve("tests/fixtures/wit-canonical-bytes/Packet.lean"),join(src,"Packet.lean"));
		await copyFile(resolve("tests/fixtures/wit-tasks/lean-toolchain"),join(src,"lean-toolchain"));
		if(ordinary) await writeFile(join(src,"packet.binding-ir.json"),canonicalJson(ordinary),{flag: "wx"});
		await exec(process.execPath,[cli,"build","--project",src,"--target","wit-wasi","--output",out,"--json","--progress","none"],{env})
			.catch(e=>{throw new Error(route+" WIT package: "+e.stdout+"\n"+e.stderr,{cause: e});});
		const path=join(out,"package-set-receipt.json");
		await exec(process.execPath,[cli,"verify","--receipt",path],{env});
		const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: path});
		const [pkg]=receipt.packages,[a]=pkg.artifacts;assert.equal(pkg.profile,"native-wit-task-v1");
		const api=await json(join(out,"binding-ir.json")),proof=await json(join(out,"host-export-evidence.json"));
		assert.equal(proof.reviewedSourceSha256,ordinary?sha256(canonicalJson(ordinary)):null);
		if(ordinary)
{assert.deepEqual(api,ordinary);assert.notEqual(a.sha256,hash);}
		else
{ordinary=api;hash=a.sha256;}
		await exec("tar",["-xzf",join(out,a.path),"-C",area,"--no-same-owner","--no-same-permissions"]);
		const prefix=join(area,"relocated pollable");await rename(join(area,basename(a.path,".tar.gz")),prefix);
		await rm(src,{recursive: true});await rm(out,{recursive: true});
		const world=join(prefix,"wit/packet.wit");
		await exec(process.env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools",["component","targets",world,join(prefix,"component/packet.wasm")]);
		assert.match(await readFile(world,"utf8"),/list<u8>/u);
		const clean={PATH: "/usr/bin:/bin",PKG_CONFIG_LIBDIR: join(prefix,"lib/pkgconfig")};
		const flags=(await exec("pkg-config",["--cflags","--libs","packet-wit"],{env: clean})).stdout.trim().match(/(?:\\.|[^\s\\])+/gu).map(s=>s.replace(/\\(.)/gu,"$1"));
		await exec("cc",["-std=c11","-Wall","-Wextra","-Werror",join(fixture,"consumer.c"),...flags,"-o","consumer"],{cwd: area,env: clean});
		const run=await exec(join(area,"consumer"),[],{cwd: area,env: {PATH: "/no-author-tools",RAYON_NUM_THREADS: "1",LEAN_NUM_THREADS: "1"},timeout: 20000});
		assert.equal(run.stdout.trim(),"pollable binary delivery: passed");assert.equal(run.stderr,"");
		t.diagnostic(route+" "+a.bytes+" bytes "+a.sha256);await rm(area,{recursive: true});
	}
});
