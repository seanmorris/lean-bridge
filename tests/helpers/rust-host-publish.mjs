/** @file Publish real Rust host component crates with the offline-installed candidate CLI. */
import assert from "node:assert/strict";
import { access, appendFile, copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCliNpmPackage } from "../../src/release/cli-npm-package.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { addStaticWorkerJobs } from "./static-worker-project.mjs";

const seed=async (project,name)=>{
	await cp("tests/fixtures/cpp-host-workshop",project,{recursive: true});await copyFile("LICENSE",join(project,"LICENSE"));
	const path=join(project,"lean-bridge.hosts.json"),ir=JSON.parse(await readFile(path,"utf8"));
	const [box]=ir.types;box.host.targets=["rust"];box.documentation.summary="An application-owned Rust meter.";
	const dial=structuredClone(box);
	dial.name=dial.source.declaration="Dial";dial.id="host:meter.Dial";dial.resource.kindId="resource:meter.Dial";dial.host.identity="strong-canonical";ir.types.push(dial);
	const member=(kind,name,prototype)=>{
		const d=structuredClone(ir.declarations.find(o=>o.name===prototype));
		d.id=kind.id+"."+name;d.owner=kind.id;d.name=name;d.overloadKey=d.source.declaration=kind.name+"."+name;d.receiver.type.id=kind.id;return d;
	};
	const named=id=>({kind: "named",id});
	const child=member(box,"child","identity");child.result={type: named(dial.id),ownership: "borrow",lifetime: {scope: "receiver",anchor: "receiver"}};
	const from=member(box,"childFrom","identity");from.result={...child.result,lifetime: {scope: "parameter",anchor: "parent"}};
	from.parameters=[{...structuredClone(from.receiver),name: "parent",optional: false,default: null}];
	ir.declarations.push(child,from,member(dial,"read","read"));
	for(const [name,ownership] of [["keepDial","lease"],["takeDial","transfer"]])
	{
		const d=member(box,name,"read");d.receiver.mutability=d.mutability="write";d.effects=["writes-resource","host-call","fails"];
		d.parameters=[{...structuredClone(d.receiver),type: named(dial.id),ownership,lifetime: {scope: "explicit",anchor: null},name: "dial",optional: false,default: null}];ir.declarations.push(d);
	}
	await writeFile(path,canonicalJson(ir));
	const src=join(project,"Workshop.lean"),cfg=join(project,"lean-bridge.exports.json");
	await writeFile(src,(await readFile(src,"utf8")).replaceAll("LeanBridge.Host.Cpp","LeanBridge.Host.Rust")+(await readFile("tests/fixtures/rust-host-members/anchors.lean.in","utf8")));
	const config=JSON.parse(await readFile(cfg,"utf8"));config.targets={cargo: {name,version: "1.0.0"}};
	config.exports.push(...["child","childFrom","keepDial","takeDial","readDial"].map(n=>"Workshop."+n));
	if(name!=="workshop")
	{const f=join(project,"lakefile.toml");await writeFile(f,(await readFile(f,"utf8")).replace('"workshop"',JSON.stringify(name)));}
	await writeFile(cfg,canonicalJson(config));
};

/**
 * Build ordinary, reviewed and independently named packages and reject a stale review.
 *
 * @param root - Disposable build scratch.
 * @param out - Private output directory for verified releases.
 * @param env - Compiler and offline Cargo cache.
 * @param workers - Include actual worker declarations and early-rejection review.
 * @param check - Exercise completed release pairs before building the next route.
 */
export const publishRustHosts=async (root,out,env,workers=false,check=async()=>{})=>{
	const cliPkg=await buildCliNpmPackage({outputRoot: join(root,"cli-candidate")});
	const tools=join(root,"tools");await mkdir(tools);
	await run("npm",["install","--offline","--prefix",tools,"--ignore-scripts","--no-audit","--no-fund","--cache",join(root,"npm-cache"),cliPkg.archive],root,env);
	const cli=join(tools,"node_modules/.bin/lean-bridge");let review=null,common=null;
	for(const route of ["ordinary","peer","reviewed","rejected"])
	{
		const project=await mkdtemp(join(root,"producer-")),release=join(out,route),name=route==="peer"?"peer":"workshop";
		await seed(project,name);
		if(workers)
		{
			const {cfg,save}=await addStaticWorkerJobs(project,"rust");
			await appendFile(join(project,"Jobs.lean"),await readFile("tests/fixtures/static-host-workers/cargo-effects.lean.in"));
			const tasks=["handoff","laterFailure","prepareIO","checkedRelay","signedEcho","largeResult","echoBytes","withBuffer","dormant"].map(n=>"Jobs."+n);
			cfg.taskExports.push(...tasks);cfg.taskIOErrors.push("Jobs.handoff","Jobs.laterFailure","Jobs.checkedRelay");
			cfg.exports.push(...tasks,"Jobs.finite","Jobs.broken");
			for(const [open,next,close] of [["finite","nextFinite","closeFinite"],["broken","nextBroken","closeBroken"]])
				cfg.asyncIterators.push({open: "Jobs."+open,next: "Jobs."+next,close: "Jobs."+close});
			await save();
		}
		if(route==="reviewed" || route==="rejected")
		{
			const path=join(project,"lean-bridge.exports.json"),cfg=JSON.parse(await readFile(path,"utf8"));delete cfg.exports;await writeFile(path,canonicalJson(cfg));
			const doc=JSON.parse(review);
			if(route==="rejected")
			{
				const d=doc.declarations.find(d=>d.name===(workers?"relay":"child"));
				const key=workers?"lean-bridge.dev/task-failure":"lean-bridge.dev/host-members";
				assert.ok(Object.hasOwn(d.source.extensions,key));delete d.source.extensions[key];
			}
			await writeFile(join(project,"workshop.binding-ir.json"),canonicalJson(doc));
		}
		const build=()=>run(process.execPath,[cli,"build","--project",project,"--target","cargo","--output",release,"--json","--progress","none"],root,env,900000);
		if(route==="rejected")
		{
			await assert.rejects(build(),/Reviewed API differs from compiled host exports/u);
			await assert.rejects(access(join(release,"package-set-receipt.json")),{code: "ENOENT"});
		} else
		{
			await build();
			const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(release,"package-set-receipt.json")});assert.deepEqual(result.profiles,["native-rust-host-v1"]);assert.equal(result.archives,2);
			const runtime=receipt.packages.find(p=>p.role==="runtime");if(common) assert.deepEqual(runtime,common);else common=runtime;
			const api=await readFile(join(release,"binding-ir.json"),"utf8"),ev=JSON.parse(await readFile(join(release,"host-export-evidence.json"),"utf8"));
			if(route==="ordinary") review=api;
			assert.equal(ev.reviewedSourceSha256,route==="reviewed"?sha256(review):null);if(route==="reviewed") assert.equal(api,review);
		}
		await rm(project,{recursive: true});
		if(route==="peer" || route==="reviewed") await check(route==="peer"?"ordinary":"reviewed");
	}
	await rm(tools,{recursive: true});
};
