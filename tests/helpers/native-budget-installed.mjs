/** @file Check the native C/C++ worker admission gate in relocated downstream binaries. */
import assert from "node:assert/strict";
import {copyFile,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {buildNativeBudget,nativeBudgetReview} from "./native-budget-handoff.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

const fixture=resolve("tests/fixtures/native-callback-budget");
for(const target of ["c","cpp"]) test(target+" rejects duplicate worker requests before host dispatch",{timeout: 7200000},async t=>{
	const env=process.env,work=await mkdtemp(join(tmpdir(),"installed-budget-"+target+"-"));
	t.after(()=>rm(work,{recursive: true,force: true}));
	const keep=env.LEAN_BRIDGE_NATIVE_BUDGET_KEEP,replay=env.LEAN_BRIDGE_NATIVE_BUDGET_REPLAY;assert.ok(!(replay && keep));
	const sets=replay?resolve(replay):await mkdtemp(join(keep??work,"handoffs-"));
	const output=resolve(env.LEAN_BRIDGE_NATIVE_BUDGET_OUTPUT??"build/native-budget",target);await mkdir(output,{recursive: true});
	t.diagnostic("Handoffs: "+sets);
	let ordinary,runtime,first;
	for(const route of ["ordinary","reviewed"])
	{
		const set=join(sets,target,route);
		if(!replay) await buildNativeBudget({work,set,target,route,ordinary});
		const {result,receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(set,"package-set-receipt.json")});
		assert.equal(receipt.packages.length,1);const [pkg]=receipt.packages;
		assert.equal(pkg.name,target+"-budget");assert.equal(pkg.artifacts.length,1);
		const [archive]=pkg.artifacts,stage=join(work,"unpack-"+route),client=join(work,route+"-client"),prefix=join(client,"native");
		await mkdir(stage);await mkdir(client);
		await run("tar",["-xzf",join(set,archive.path),"--strip-components=1","-C",stage],work,env);
		await rename(stage,prefix);const meta=join(prefix,"share/lean-bridge");
		const api=JSON.parse(await readFile(join(meta,"binding-ir.json"))),proof=JSON.parse(await readFile(join(meta,"elaboration.json")));
		const manifest=JSON.parse(await readFile(join(prefix,"lean-bridge-package.json")));
		assert.equal(manifest.bindingIrSha256,hashBindingIr(api));assert.equal(manifest.runtimeIdentity,pkg.runtimeIdentity);
		for(const d of api.declarations) for(const p of d.parameters.slice(1))
		{
			const type=api.types.find(t=>t.id===p.type.id);
			assert.equal(type.callable.invocation,d.source.declaration==="Budget.probe" && p.name==="g"?"many":"once");
		}
		if(route==="ordinary")
		{
			ordinary=api;runtime=pkg.runtimeIdentity;first=archive.sha256;
			assert.equal(proof.reviewedSourceSha256,null);
		}
		else
		{
			assert.equal(pkg.runtimeIdentity,runtime);assert.notEqual(archive.sha256,first);
			assert.equal(api.documentation.summary,nativeBudgetReview);
			assert.equal(proof.reviewedSourceSha256,sha256(canonicalJson(api)));
		}
		const source="client."+target;await copyFile(join(fixture,source),join(client,source));
		await copyFile(join(fixture,"observer.h"),join(client,"observer.h"));
		const cpp=target==="cpp",compiler=cpp?env.CXX??"c++":env.CC??"cc";
		const compileEnv={...env,PKG_CONFIG_PATH: "",PKG_CONFIG_LIBDIR: join(prefix,"lib/pkgconfig")};
		const flags=(await run("pkg-config",["--cflags","--libs",pkg.name],client,compileEnv)).split(/\s+/u);
		await run(compiler,[cpp?"-std=c++20":"-std=c11","-Wall","-Wextra","-Werror",source,"-o","probe",...flags,"-ldl"],client,compileEnv);
		const isolated={PATH: "/unavailable",LD_LIBRARY_PATH: join(prefix,"lib"),LEAN_NUM_THREADS: "4"};
		const observation=await run(join(client,"probe"),[],client,isolated);
		assert.match(observation,/16 worker races; separate start, terminal and original/u);
		assert.ok(observation.endsWith("; zero leases"));
		const {sourceTreeSha256,reviewedSourceSha256}=proof;
		const clientSha256=sha256(await readFile(join(client,source)));
		const observerSha256=sha256(await readFile(join(client,"observer.h")));
		const report={target,route,archive,runtimeIdentity: runtime
			, receiptSha256: result.receiptSha256,sourceTreeSha256,reviewedSourceSha256
			, bindingIrSha256: hashBindingIr(api),clientSha256
			, observerSha256,observation};
		await writeFile(join(output,route+".json"),canonicalJson(report));
		await rm(client,{recursive: true});
	}
});
