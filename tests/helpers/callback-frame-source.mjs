/** @file Resolve immutable archive inputs or authenticate a completed compiler stage for an adapter spot check. */
import assert from "node:assert/strict";
import {mkdir,readFile,symlink} from "node:fs/promises";
import {join,resolve} from "node:path";
import {readVerifiedNativeComponent,readVerifiedNativeRuntime,verifyNativeFiles} from "../../src/build/native-artifacts.mjs";
import {sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";

/**
 * Prepare the linker inputs without modifying the original compiler stage.
 *
 * @param o - Input selection, author route, scratch directory and tool runner.
 */
export const frameReplaySource=async o=>{
	const {env,route,work,run,direct}=o;
	const prefix="tariff-quotes-1.0.0-c",installed=join(work,prefix),lib=join(installed,"lib");
	const json=async(root,name)=>JSON.parse(await readFile(join(root,name+".json")));
	const stage=env.LEAN_BRIDGE_FRAME_NATIVE_STAGE;
	let model,component,metadata,origin;
	if(stage)
	{
		assert.ok(direct && !env.LEAN_BRIDGE_FRAME_C_HANDOFF && route==="ordinary");
		const native=resolve(stage,"component"),runtime=resolve(stage,"runtime"),adapter=resolve(stage,"owned-c-binding");
		const {identity}=await readVerifiedNativeRuntime(runtime);
		({model,receipt: component}=await readVerifiedNativeComponent(native,identity,{ownedGraphs: true,ownedHostCallbacks: true}));
		metadata=await json(native,"metadata");const a=await json(adapter,"native-c-adapter");await verifyNativeFiles(adapter,a.files);
		await mkdir(lib,{recursive: true});await symlink(join(adapter,"gmp/include"),join(installed,"include"));
		const libraries=[[native,component.library]
			, [join(adapter,"gmp/lib"),"libgmp.so.10"]
			, [join(runtime,"lib"),"libleanshared.so"]
			, [join(runtime,"lib"),"liblean_bridge_native.so"]];
		for(const [root,file] of libraries)
			await symlink(join(root,file),join(lib,file));
		origin="verified compiler stage "+component.nativeLibrary.sha256;
	}
	else
	{
		assert.ok(env.LEAN_BRIDGE_FRAME_C_HANDOFF,"Set a C handoff root or a direct-input compiler stage");
		const set=resolve(env.LEAN_BRIDGE_FRAME_C_HANDOFF,route);
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(set,"package-set-receipt.json")});
		assert.deepEqual(result.packages,[{target: "c",ecosystem: "c",name: "tariff-quotes",version: "1.0.0"}]);
		const [artifact]=receipt.packages[0].artifacts,archive=join(set,artifact.path);
		const files=(await run("tar",["-tzf",archive])).split("\n");
		assert.ok(files.every(p=>p.startsWith(prefix+"/") && !p.split("/").includes("..")));
		await run("tar",["-xzf",archive]);
		const boundary=join(installed,"share/lean-bridge/component");
		[model,component,metadata]=await Promise.all(["model","native-component","metadata"].map(n=>json(boundary,n)));
		assert.equal(sha256(await readFile(join(lib,component.library))),component.nativeLibrary.sha256);
		origin="archive "+artifact.sha256;
	}
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr),route==="reviewed");
	assert.ok(model.bindingIr.declarations.some(d=>d.name===(direct?"visitQuote":"exchangeTariff")));
	if(direct)
	{
		const fixture=new URL("../fixtures/",import.meta.url);
		const a=await readFile(new URL("onboarding/leased-closure-fields/Owned.lean",fixture),"utf8");
		const b=await readFile(new URL("structured-types/visit-quote.lean",fixture),"utf8");
		assert.equal(component.sourceIdentity.modules.find(m=>m.module==="Owned").source.sha256,sha256(a+"\n"+b));
	}
	return {model,component,metadata,installed,lib,origin};
};
