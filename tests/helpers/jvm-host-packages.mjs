/** @file Exercise the installed CLI and two independently published Maven packages, without a network. */
import assert from "node:assert/strict";
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { buildCliNpmPackage } from "../../src/release/cli-npm-package.mjs";
import { captureNativeHostHandoff } from "./native-host-handoff.mjs";
import { runJvmHostConsumers } from "./jvm-host-installed.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

const inspect = async (releases, route, mod, target, originals) => {
	const name = mod === "Workshop" ? "workshop" : "workshop-peer";
	const handoff = join(releases,route,mod,"handoff");
	const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(handoff,"package-set-receipt.json") });
	assert.equal(receipt.packages.length,1);
	const [pkg]=receipt.packages;
	assert.equal(pkg.name,"org.leanbridge:"+name); assert.equal(pkg.profile,"native-jvm-io-v1");
	const {artifacts}=pkg, files=artifacts.map(a=>join(target,basename(a.path)));
	assert.deepEqual(files.map(f=>f.slice(f.lastIndexOf("."))).sort(),[".jar",".pom"]);
	for(const [i,a] of artifacts.entries()) await copyFile(join(handoff,a.path),files[i]);
	const jar=files.find(f=>f.endsWith(".jar"));
	const metadata=async p=>JSON.parse(await run("unzip",["-p",jar,"META-INF/lean-bridge/"+p],target,process.env));
	const api=await metadata("binding-ir.json"), compiler=await metadata("elaboration.json"), manifest=await metadata("package-receipt.json");
	assert.equal(receipt.profiles.length,1);
	assert.equal(receipt.profiles[0].bindingIrSha256,hashBindingIr(api));
	assert.equal(compiler.sourceTreeSha256,receipt.source.treeSha256);
	if(route==="ordinary")originals.set(mod,api);
	assert.deepEqual(api,originals.get(mod));
	const review=route==="ordinary"?null:sha256(canonicalJson(api));
	assert.equal(compiler.reviewedSourceSha256,review);
	assert.equal(manifest.bindingIrSha256,receipt.profiles[0].bindingIrSha256);
	assert.equal(manifest.name,pkg.name); assert.match(manifest.componentIdentity,/^[a-f0-9]{64}$/u);
	assert.equal(manifest.profile,pkg.profile); assert.equal(manifest.runtimeIdentity,pkg.runtimeIdentity);
	for(const method of ["rejectBox","mixedFault"])
	{
		const d=api.declarations.find(f=>f.source.declaration===mod+"."+method);
		assert.equal(d.source.extensions["lean-lang.org/effect"],"EIO");
		assert.equal(d.source.extensions["lean-bridge.dev/error-payload-site"].ownership,"lease");
		assert.equal(d.failure.mode,"declared"); assert.equal(d.failure.unexpected,"poison-runtime");
	}
	const report = { name: pkg.name, artifacts, receiptSha256: result.receiptSha256
		, interface: receipt.profiles[0].bindingIrSha256
		, componentIdentity: manifest.componentIdentity
		, runtimeIdentity: pkg.runtimeIdentity, reviewedSourceSha256: review };
	return { name, artifacts, files, report };
};

test("installed Java and Kotlin bind application-owned objects through two independent Maven releases", { timeout: 3600000 }, async t => {
	const seed = process.env.LEAN_BRIDGE_JVM_IO_M2_SEED;
	assert.ok(seed, "Set LEAN_BRIDGE_JVM_IO_M2_SEED to an offline Maven seed (see docs/evidence/jvm-host-imports-20261124.md)");
	const plugins = "org/apache/maven/plugins/";
	for(const file of [plugins + "maven-install-plugin/3.1.4/maven-install-plugin-3.1.4.jar", plugins + "maven-dependency-plugin/3.8.1/maven-dependency-plugin-3.8.1.jar", "org/jetbrains/kotlin/kotlin-stdlib/2.2.0/kotlin-stdlib-2.2.0.jar"])
		await access(join(seed, file));
	const root = await mkdtemp(join(tmpdir(), "jvm-host-release-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const archives = await mkdtemp(join(process.env.LEAN_BRIDGE_JVM_HOST_HANDOFF_TMP ?? tmpdir(), "jvm-host-archives-"));
	t.after(() => rm(archives, { recursive: true, force: true }));
	const env=process.env, keep=env.LEAN_BRIDGE_JVM_HOST_ERROR_KEEP, replay=env.LEAN_BRIDGE_JVM_HOST_ERROR_REPLAY;
	assert.ok(!(keep && replay));
	const sets=replay?resolve(replay):await mkdtemp(join(keep??root,"handoffs-")), originals=new Map();
	if(!replay)
	{
		const candidate = await buildCliNpmPackage({ outputRoot: join(root, "candidate") });
		const tools = join(root, "tools"); await mkdir(tools);
		await run("npm", ["install", "--prefix", tools, "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", join(root, "npm-cache"), candidate.archive], root, env);
		await rm(candidate.output, { recursive: true });
		const cli = join(tools, "node_modules/.bin/lean-bridge");
		for(const reviewed of [false,true]) for(const peer of [false,true])
		{
			const retain=join(sets,reviewed?"reviewed":"ordinary",peer?"Peer":"Workshop");
			const p=await captureNativeHostHandoff({root,archives,cli,peer,reviewed,retain});
			for(const file of p.files) await rm(file);
		}
	}
	const sources={};
	for(const file of ["Consumer.java","ErrorOwner.java","LeasePayloads.java","KotlinConsumer.kt","KotlinErrorOwner.kt","KotlinLeasePayloads.kt"])
		sources[file]=sha256(await readFile(join("tests/fixtures/jvm-host-meter",file)));
	for(const reviewed of [false, true])
	{
		const route=reviewed?"reviewed":"ordinary", deploy=join(archives,route);
		await mkdir(deploy);
		const packs=[];
		for(const mod of ["Workshop","Peer"]) packs.push(await inspect(sets,route,mod,deploy,originals));
		const observations=await runJvmHostConsumers(root,packs);
		for(const line of observations) t.diagnostic(route+" "+line);
		if(env.LEAN_BRIDGE_JVM_HOST_ERROR_OUTPUT)
		{
			await mkdir(env.LEAN_BRIDGE_JVM_HOST_ERROR_OUTPUT,{recursive: true});
			const report={route,packages: packs.map(p=>p.report),sources,observations};
			await writeFile(join(env.LEAN_BRIDGE_JVM_HOST_ERROR_OUTPUT,route+".json"),canonicalJson(report));
		}
	}
	if(keep || replay)t.diagnostic("Handoffs: "+sets);
});
