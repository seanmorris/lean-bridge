/** @file Exercise the installed typed C API, without private headers or a Lean toolchain on the client path. */
import assert from "node:assert/strict";
import {access,appendFile,copyFile,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {prepareNativeHostFixture} from "./native-host-import-check.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {installOfflineAuthor} from "./offline-author-cli.mjs";

test("offline C packages return typed Lean functions and revoke one binding without touching another",{timeout: 1800000},async t=>{
	const root=await mkdtemp(join(tmpdir(),"c-host-closures-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const src=join(root,"source"),file=join(src,"lean-bridge.exports.json"),env=process.env,fixture=resolve("tests/fixtures/c-host-closures");
	const cli=await installOfflineAuthor(root);
	await prepareNativeHostFixture(src,"c");await copyFile("LICENSE",join(src,"LICENSE"));
	await copyFile(join(fixture,"Closures.lean"),join(src,"Closures.lean"));
	await appendFile(join(src,"lakefile.toml"),'\n[[lean_lib]]\nname = "Closures"\n');
	const cfg=JSON.parse(await readFile(file));cfg.modules.push("Closures");cfg.exports.push("Closures.remember","Closures.reader","Closures.identityReader");
	const build=out=>run(process.execPath,[cli,"build","--project",src,"--target","c","--output",out,"--json","--progress","none"],root,env);
	await writeFile(file,canonicalJson({...cfg,exports: [...cfg.exports,"Closures.fileReader"]}));
	const denied=join(root,"no-grant");
	await assert.rejects(build(denied),e=>e.message.includes("Closures.fileReader requires nativeEffects") && e.message.includes("filesystem"));
	await assert.rejects(access(denied),{code: "ENOENT"});
	let first;
	for(const route of ["ordinary","reviewed","worker"])
	{
		const out=join(root,route),review=join(src,"public.binding-ir.json");
		if(route==="reviewed")
		{delete cfg.exports;await writeFile(review,canonicalJson(first));}
		if(route==="worker")
		{
			await rm(review);cfg.exports=["Workshop.make","Closures.remember","Closures.reader","Closures.identityReader","Closures.fileReader","Closures.echoBox"];
			cfg.taskExports=["Closures.echoBox"];cfg.nativeEffects=["filesystem"];
		}
		await writeFile(file,canonicalJson(cfg));await build(out);
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(out,"package-set-receipt.json")});
		const [pkg]=receipt.packages;assert.deepEqual([pkg.name,pkg.profile],["workshop","native-c-host-v1"]);
		const api=JSON.parse(await readFile(join(out,"binding-ir.json"))),row=api.declarations.find(d=>d.source.declaration==="Closures.remember");
		const kind=api.types.find(k=>k.id===row.result.type.id);
		assert.equal(row.result.ownership,"lease");assert.equal(kind.source.extensions["lean-bridge.dev/closure-owner"],"c-host-binding");
		assert.equal(kind.callable.invocation,"many");assert.equal(kind.callable.selfDisposal,"defer");
		assert.ok(kind.callable.failure.errors.includes("error:CHostError"));
		if(route==="reviewed")assert.deepEqual(api,first);else if(!first)first=api;
		const dest=join(root,"unpacked"),client=join(root,"client"),installed=join(client,"install");
		await mkdir(dest);await mkdir(client);await run("tar",["-xzf",join(out,pkg.artifacts[0].path),"--strip-components=1","-C",dest],root,env);
		await rm(out,{recursive: true});await rename(dest,installed);
		const pc={...env,PKG_CONFIG_PATH: "",PKG_CONFIG_LIBDIR: join(installed,"lib/pkgconfig")};
		const flags=(await run("pkg-config",["--cflags","--libs","workshop"],client,pc)).split(/\s+/u);
		await copyFile(join(fixture,"consumer.c"),join(client,"consumer.c"));
		await run("cc",["-std=c11","-Wall","-Wextra","-Werror","-pthread",...route==="worker"?["-DTEST_WORKER=1"]:[],"consumer.c",...flags,"-o","consumer"],client,pc);
		const isolated={PATH: "/no-tools",LD_LIBRARY_PATH: "",LEAN_NUM_THREADS: "1"};
		const msg=await run(join(client,"consumer"),[],client,isolated);
		assert.match(msg,/stale copies; two disposals/u);t.diagnostic(route+" "+result.receiptSha256+" "+msg);
		assert.match(await run(join(client,"consumer"),["poison"],client,isolated),/sibling refused, binding-local captures released once/u);
		await rm(client,{recursive: true});
	}
});
