/** @file Build an independent Composer peer and replay a verified first component against it. */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { prepareNativeHostFixture } from "./native-host-import-check.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { installPhpIOComponents } from "./php-io-install.mjs";

const preparePeer=async project=>{
	const lake=join(project,"lakefile.toml"),config=join(project,"lean-bridge.exports.json");
	const manifest=(await readFile(lake,"utf8")).replace('name = "workshop"','name = "workshop-peer"');
	await writeFile(lake,manifest+'\n[[lean_lib]]\nname = "Peer"\n');
	const cfg=JSON.parse(await readFile(config,"utf8")); cfg.targets["php-native"].name="lean-bridge/workshop-peer";
	const imports=join(project,"lean-bridge.hosts.json"), ir=JSON.parse(await readFile(imports,"utf8"));
	const [box]=ir.types, key=structuredClone(box);
	key.name="Key"; key.id="host:meter.Key"; key.resource.kindId="resource:meter.Key"; key.host.identity="strong-canonical";
	const identity=ir.declarations.find(d=>d.name==="identity"), keep=structuredClone(identity), child=structuredClone(identity);
	keep.owner=key.id; keep.receiver.type.id=key.id; keep.result.type.id=key.id; keep.id=key.id+".identity";
	keep.source.declaration=keep.overloadKey="Key.identity";
	child.name="child"; child.id=box.id+".child"; child.source.declaration=child.overloadKey="Box.child";
	child.result.type.id=key.id; child.result.ownership="borrow"; child.result.lifetime={scope: "receiver",anchor: "receiver"};
	const from=structuredClone(child);
	from.name="childOf"; from.id=box.id+".childOf"; from.source.declaration=from.overloadKey="Box.childOf";
	from.parameters=[{...structuredClone(identity.receiver),name: "parent",optional: false,default: null}];
	from.result.lifetime={scope: "parameter",anchor: "parent"};
	ir.types.push(key); ir.declarations.push(keep,child,from);
	await writeFile(imports,canonicalJson(ir));
	await copyFile("tests/fixtures/php-host-members/Peer.lean",join(project,"Peer.lean"));
	cfg.modules.push("Peer"); cfg.exports.push("Peer.transient","Peer.mappedTransient","Peer.ioFail","Peer.watch","Peer.watchFrom","Peer.keepKey");
	await writeFile(config,canonicalJson(cfg));
};

const exercisePeer=async (stage,first,handoff,env)=>{
	const local=join(stage,"client"),deploy=join(stage,"installed elsewhere"); await mkdir(local);
	await copyFile("tests/fixtures/php-host-members/peer.php",join(local,"app.php"));
	await copyFile("tests/fixtures/php-host-members/lifecycle.php",join(local,"lifecycle.php"));
	const {vendor,components}=await installPhpIOComponents(stage,local,deploy,[first,handoff]);
	const report=[];
	for(const php of (env.LEAN_BRIDGE_PHP_HOST_INTERPRETERS ?? "/usr/bin/php").split(","))
	{
		const isolated={PATH: "/no-publisher-tools",LANG: "C.UTF-8",LEAN_NUM_THREADS: "1"};
		const flags=await run(resolve(php),["-n","-r","echo (int)extension_loaded('ffi');"],deploy,isolated)==="1" ? ["-n"] : ["-n","-d","extension=ffi"];
		for(const order of ["peer","workshop"])
		{
			const result=await run(resolve(php),[...flags,"-d","ffi.enable=1","app.php",join(vendor,"autoload.php"),order],deploy,isolated);
			assert.match(result,/independent close; zero tokens/u);
			const lifecycle=JSON.parse(await run(resolve(php),[...flags,"-d","ffi.enable=1","lifecycle.php",join(vendor,"autoload.php"),order],deploy,isolated));
			assert.equal(lifecycle.finalTokens,0); assert.equal(lifecycle.checks,25); assert.equal(lifecycle.retirementChecks,6);
			report.push({php,order,result,lifecycle});
		}
	}
	await writeFile(join(stage,"consumer.json"),canonicalJson({report,archives: components.map(r=>r.pkg.artifacts[0]),receipts: components.map(r=>r.receiptSha256)}));
	await rm(deploy,{recursive: true});
};

test("independent Composer packages share identity, anchors and safe finalization in either load order",{timeout: 1_800_000},async t=>{
	const env=process.env,keep=env.LEAN_BRIDGE_PHP_HOST_OUTPUT,existing=env.LEAN_BRIDGE_PHP_HOST_HANDOFF;
	const replay=env.LEAN_BRIDGE_PHP_HOST_PEER_REPLAY;
	if(replay && !existing) throw new Error("Peer replay requires the first package handoff as LEAN_BRIDGE_PHP_HOST_HANDOFF");
	const root=await mkdtemp(join(keep ?? tmpdir(),"php-host-peer-"));
	if(!keep) t.after(()=>rm(root,{recursive: true,force: true}));
	const first=existing ? resolve(existing) : join(root,"first-handoff");
	const build=(projectRoot,outputRoot)=>buildCanonicalProject({projectRoot,outputRoot,targets: ["php-native"],environment: env});
	let review;
	for(const route of ["ordinary","reviewed"])
	{
		const stage=join(root,route),project=join(stage,"producer"),handoff=join(replay ? resolve(replay,route) : stage,"handoff");
		await mkdir(stage);
		if(!replay)
		{
			await prepareNativeHostFixture(project,"php"); await copyFile("LICENSE",join(project,"LICENSE"));
			if(!existing && !review)
			{
				await build(project,first);
				await rm(join(first,"packages"),{recursive: true});
			}
			await preparePeer(project);
			if(review) await writeFile(join(project,"peer.binding-ir.json"),review);
			await build(project,handoff);
			await rm(project,{recursive: true}); await rm(join(handoff,"packages"),{recursive: true});
		}
		const ir=await readFile(join(handoff,"binding-ir.json"),"utf8");
		const evidence=JSON.parse(await readFile(join(handoff,"host-export-evidence.json"),"utf8"));
		assert.equal(evidence.reviewedSourceSha256,review ? sha256(review) : null);
		if(review) assert.equal(ir,review); else review=ir;
		await exercisePeer(stage,first,handoff,env); t.diagnostic("Verified "+route+" peer: "+stage);
	}
});
