/** @file Installed publisher CLI to offline NuGet consumer, ordinary and reviewed source. */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { buildCliNpmPackage } from "../../src/release/cli-npm-package.mjs";
import { captureNativeHostHandoff } from "./native-host-handoff.mjs";
import { runDotnetHostConsumers } from "./dotnet-host-installed.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

test("offline installed NuGet components expose CLR host objects through ordinary and reviewed packages", { timeout: 7200000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "dotnet-host-release-")); t.after(() => rm(root, { recursive: true, force: true }));
	const archives = await mkdtemp(join(process.env.LEAN_BRIDGE_DOTNET_HOST_HANDOFF_TMP ?? tmpdir(), "dotnet-host-feed-")); t.after(() => rm(archives, { recursive: true, force: true }));
	const env=process.env, keep=env.LEAN_BRIDGE_CLR_ERROR_KEEP, replay=env.LEAN_BRIDGE_CLR_ERROR_REPLAY;
	assert.ok(!(keep && replay));
	const sets=replay ? resolve(replay) : await mkdtemp(join(keep ?? root,"handoffs-"));
	const sources={};
	for(const f of ["ErrorOwner.cs","Installed.cs","InstalledScalars.cs"]) sources[f]=sha256(await readFile(join("tests/fixtures/dotnet-host-meter",f)));
	if(!replay)
	{
		const candidate = await buildCliNpmPackage({ outputRoot: join(root, "cli") }), tools = join(root, "tools"); await mkdir(tools);
		await run("npm", ["install", "--prefix", tools, "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", join(root, "npm-cache"), candidate.archive], root, env);
		await rm(candidate.output, { recursive: true }); await rm(join(root, "npm-cache"), { recursive: true });
		for(const reviewed of [false,true]) for(const peer of [false,true])
		{
			const retain=join(sets,reviewed?"reviewed":"ordinary",peer?"Peer":"Workshop");
			const p=await captureNativeHostHandoff({root,archives,cli: join(tools,"node_modules/.bin/lean-bridge"),peer,reviewed,backend: "dotnet",retain});
			for(const file of p.files) await rm(file);
		}
	}
	for(const reviewed of [false, true])
	{
		const packages = [], feed=join(archives,reviewed?"reviewed":"ordinary"), route = reviewed ? "reviewed" : "ordinary";
		await mkdir(feed);
		for(const name of ["Workshop","Peer"])
		{
			const dir=join(sets,route,name), handoff=join(dir,"handoff");
			const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(handoff,"package-set-receipt.json")});
			const api=JSON.parse(await readFile(join(dir,"binding-ir.json"))), ev=JSON.parse(await readFile(join(dir,"host-export-evidence.json")));
			assert.equal(ev.sourceTreeSha256,receipt.source.treeSha256);
			assert.equal(receipt.profiles.length,1); assert.equal(receipt.profiles[0].id,"native-dotnet-io-v1");
			assert.equal(hashBindingIr(api),receipt.profiles[0].bindingIrSha256);
			const original=await readFile(join(sets,"ordinary",name,"binding-ir.json"));
			assert.deepEqual(api,JSON.parse(original));
			assert.equal(ev.reviewedSourceSha256,reviewed?sha256(canonicalJson(JSON.parse(original))):null);
			const reject=api.declarations.find(d=>d.source.declaration===name+".rejectBox");
			assert.equal(reject.source.extensions["lean-lang.org/effect"],"EIO");
			assert.equal(reject.failure.mode,"declared"); assert.equal(reject.failure.unexpected,"poison-runtime");
			assert.equal(reject.source.extensions["lean-bridge.dev/error-payload-site"].ownership,"lease");
			const [pkg]=receipt.packages; assert.equal(pkg.name,"Acme."+name); assert.equal(pkg.artifacts.length,1);
			const [archive]=pkg.artifacts; await copyFile(join(handoff,archive.path),join(feed,basename(archive.path)));
			packages.push({name: pkg.name,receiptSha256: result.receiptSha256,archive,reviewedSourceSha256: ev.reviewedSourceSha256,profile: receipt.profiles[0]});
		}
		const observations=await runDotnetHostConsumers(root,feed,false,true);
		for(const line of observations) t.diagnostic(route + " " + line);
		if(env.LEAN_BRIDGE_CLR_ERROR_RESULTS)
		{
			await mkdir(env.LEAN_BRIDGE_CLR_ERROR_RESULTS,{recursive: true});
			await writeFile(join(env.LEAN_BRIDGE_CLR_ERROR_RESULTS,route+".json"),canonicalJson({route,packages,sources,observations}));
		}
	}
	t.diagnostic("Handoffs: "+sets);
});
