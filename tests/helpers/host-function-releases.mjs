/** @file Build ordinary, reviewed and worker packages for a bound host-function client. */
import assert from "node:assert/strict";
import {access,appendFile,copyFile,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {prepareNativeHostFixture} from "./native-host-import-check.mjs";
import {installOfflineAuthor} from "./offline-author-cli.mjs";

const json=async path=>JSON.parse(await readFile(path,"utf8"));
/**
 * Verify the source selection and install the output from each publication route.
 *
 * @param t - Node test context that owns the disposable workspace.
 * @param o - Target module, expected release identities and real installation callback.
 */
export const checkHostFunctionReleases=async(t,o)=>{
	const root=await mkdtemp(join(tmpdir(),o.target+"-returned-functions-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const cli=await installOfflineAuthor(root),src=join(root,"project"),cfgFile=join(src,"lean-bridge.exports.json");
	await prepareNativeHostFixture(src,o.backend);await copyFile("LICENSE",join(src,"LICENSE"));
	const lean=await readFile("tests/fixtures/c-host-closures/Closures.lean","utf8");
	await writeFile(join(src,"Closures.lean"),lean.replaceAll("LeanBridge.Host.C","LeanBridge.Host."+o.module));
	await appendFile(join(src,"lakefile.toml"),'\n[[lean_lib]]\nname = "Closures"\n');
	const cfg=await json(cfgFile),sync=["Closures.remember","Closures.reader","Closures.identityReader"];
	if(o.addFunctions) sync.push(...await o.addFunctions(src));
	cfg.modules.push("Closures");cfg.exports.push(...sync);
	const build=out=>run(process.execPath,[cli,"build","--target",o.target,"--project",src,"--output",out,"--json","--progress","none"],root,process.env,900000);
	await writeFile(cfgFile,canonicalJson({...cfg,exports: [...cfg.exports,"Closures.fileReader"]}));
	const denied=join(root,"missing-grant");await assert.rejects(build(denied),e=>e.message.includes("Closures.fileReader requires nativeEffects") && e.message.includes("filesystem"));
	await assert.rejects(access(denied),{code: "ENOENT"});
	let first;
	for(const route of ["ordinary","reviewed","worker"])
	{
		const out=join(root,route),review=join(src,"workshop.binding-ir.json"),worker=route==="worker";
		if(route==="reviewed")
		{
			delete cfg.exports;await writeFile(cfgFile,canonicalJson(cfg));
			const bad=structuredClone(first),invalid=join(root,"wrong-owner");
			bad.types.find(k=>k.source.declaration==="Closures.remember").source.extensions["lean-bridge.dev/closure-owner"]="rust-host-binding";
			await writeFile(review,canonicalJson(bad));await assert.rejects(build(invalid),e=>e.message.includes("Reviewed API differs from compiled host exports"));
			await assert.rejects(access(invalid),{code: "ENOENT"});await writeFile(review,canonicalJson(first));
		}
		if(worker)
		{
			await rm(review);cfg.exports=["Workshop.make",...sync,"Closures.fileReader","Closures.echoBox"];
			cfg.taskExports=["Closures.echoBox"];cfg.nativeEffects=["filesystem"];
			if(o.addWorkers)await o.addWorkers(src,cfg);
		}
		await writeFile(cfgFile,canonicalJson(cfg));await build(out);
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(out,"package-set-receipt.json")});
		assert.deepEqual(result.profiles,[o.profiles[Number(worker)]]);assert.equal(result.archives,o.archives);
		const api=await json(join(out,"binding-ir.json")),decl=api.declarations.find(d=>d.source.declaration==="Closures.remember");
		const kind=api.types.find(k=>k.id===decl.result.type.id);
		assert.equal(kind.source.extensions["lean-bridge.dev/closure-owner"],o.backend+"-host-binding");assert.equal(decl.result.ownership,"lease");
		assert.equal(kind.callable.invocation,"many");assert.equal(kind.callable.selfDisposal,"defer");assert.ok(kind.callable.failure.errors.includes(o.error));
		if(route==="reviewed")assert.deepEqual(api,first);else if(!first)first=api;
		await o.consume({root,out,route,worker,receipt,src});t.diagnostic(route+" "+result.receiptSha256);
	}
};
