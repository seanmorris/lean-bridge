/** @file Exercise function-bearing records through a relocated Wasmtime Component Model package. */
import assert from "node:assert/strict";
import {copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename, join, resolve} from "node:path";
import test from "node:test";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";
import {nativeArtifactPaths} from "../../src/build/native-artifacts.mjs";
import {canonicalJson, sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {copyPackageSetHandoff} from "./package-set.mjs";
import {verifyDirectQuoteCounts} from "./direct-quote-counts.mjs";
import {assertDirectWitWorld} from "./wit-direct-world.mjs";
import {checkStagedQuoteIdentities, prepareStagedQuoteProject} from "./staged-quote-project.mjs";

const json = async path => JSON.parse(await readFile(path));
const routes = ["ordinary", "reviewed"];
const source = resolve("tests/fixtures/structured-types/tariff-wasmtime.c");

const buildHandoff = async (parent, work, route, incoming) => {
	const project = join(work, route+"-project"), output = join(work, route+"-release");
	await prepareStagedQuoteProject(project, route, "wit-wasi",{mixed: !incoming,incoming});
	try
	{
		await buildCanonicalProject({projectRoot: project, outputRoot: output, targets: ["wit-wasi"]});
	} catch(error)
	{
		throw new Error(route+" WIT release failed: "+error.message+" "+JSON.stringify(error.details), {cause: error});
	}
	await copyPackageSetHandoff(output, join(parent,route));
	await rm(project, {recursive: true}); await rm(output, {recursive: true});
};

const exercise = async (root, handoff, route, replay, incoming) => {
	const {receipt,result} = await readVerifiedPackageSetReceipt({receiptPath: join(handoff,"package-set-receipt.json")});
	assert.equal(receipt.packages.length,1);
	const [pkg] = receipt.packages; assert.equal(pkg.target,"wit-wasi"); assert.equal(pkg.name,"tariff-quotes");
	assert.equal(pkg.artifacts.length,1);
	const [artifact] = pkg.artifacts, archive = join(root,basename(artifact.path));
	await copyFile(join(handoff,artifact.path),archive);
	const top = basename(archive,".tar.gz"), install = join(root,"relocated");
	assert.equal(top,"tariff-quotes-1.0.0-wit-wasi");
	const entries = (await run("tar",["-tzf",archive],root,process.env)).split("\n").filter(Boolean);
	assert.ok(entries.length && entries.every(p=>p.startsWith(top+"/") && !p.split("/").includes("..")));
	await run("tar",["-xzf",archive],root,process.env);
	await rename(join(root,top),install); await rm(archive);
	const manifest = await json(join(install,"lean-bridge-package.json"));
	assert.equal(manifest.kind,"lean-bridge-owned-wit-package");
	assert.equal(manifest.pkgConfig,"tariff-quotes-wit");
	assert.deepEqual(await nativeArtifactPaths(install),["lean-bridge-package.json",...Object.keys(manifest.files)].sort());
	for(const [name,{bytes,sha256: expected}] of Object.entries(manifest.files))
	{
		const value = await readFile(join(install,name)); assert.equal(value.length,bytes); assert.equal(sha256(value),expected,name);
	}
	const meta = name=>json(join(install,"share/lean-bridge/component",name+".json"));
	const header = await readFile(join(install,"include/tariff_quotes_wasmtime.h"),"utf8");
	const inputs = header.includes("tariff_quotes_wasmtime_compare_cards_with_host_fields(");
	if(incoming) assert.ok(header.includes("tariff_quotes_wasmtime_visit_quote("),"package lacks the direct-function export");
	else if(replay && !inputs)
	{
		const old=new URL("../../docs/evidence/wit-function-fields-20261126/"+route+".json",import.meta.url);
		assert.equal(result.receiptSha256,(await json(old)).receiptSha256);
	} else assert.ok(inputs,"fresh Wasmtime package must export the mixed input API");
	const ir=await meta("binding-ir");
	const identity = checkStagedQuoteIdentities(await meta("model"),ir,receipt.profiles.find(p=>p.id===pkg.profile),route,{mixed: inputs,incoming});
	assert.equal(manifest.bindingIrSha256,identity.bindingIrSha256);
	const world = join(install,"wit/tariff-quotes.wit"), wasm = join(install,"component/tariff-quotes.wasm");
	assert.equal(sha256(await readFile(wasm)),manifest.componentSha256);
	await run(process.env.LEAN_BRIDGE_WASM_TOOLS ?? "wasm-tools",["component","targets",world,wasm],root,process.env);
	const flags = await run("pkg-config",["--cflags","--libs",manifest.pkgConfig],root,
		{PATH: process.env.PATH,PKG_CONFIG_LIBDIR: join(install,"lib/pkgconfig")});
	const tokens = flags.match(/(?:\\.|[^\s\\])+/gu).map(s=>s.replace(/\\(.)/gu,"$1"));
	if(incoming)
	{
		assertDirectWitWorld(await readFile(world,"utf8"));
		const fn=ir.declarations.find(d=>d.source.declaration==="Owned.visitQuote");
		const arg=ir.types.find(t=>t.id===fn.parameters[1].type.id).callable.parameters[0];
		assert.equal(arg.ownership,"borrow");assert.equal(arg.lifetime.scope,"call");
		assert.equal(ir.types.find(t=>t.id===arg.type.id).kind,"callback");
		const sources={},files=["tariff-incoming-wasmtime.c","tariff-incoming-wasmtime-observer.c"];
		for(const file of files)
		{
			await copyFile(resolve("tests/fixtures/structured-types",file),join(root,file));
			sources[file]=sha256(await readFile(join(root,file)));
		}
		await run(process.env.CC??"cc",["-std=c11","-Wall","-Wextra","-Werror","-UNDEBUG",...files,...tokens,"-ldl","-o","incoming"],root,process.env);
		const exe=join(root,"incoming");
		const text=await run(exe,[join(install,"lib/liblean_bridge_native.so")],root,
			{PATH: "/no-producer-tools",LEAN_NUM_THREADS: "1",RAYON_NUM_THREADS: "1",LANG: "C.UTF-8"});
		const rows=text.split("\n").map(l=>{const m=/^(\w+):(\d+)$/u.exec(l);assert.ok(m);return [m[1],Number(m[2])];});
		const counts=Object.fromEntries(rows);
		assert.equal(rows.length,Object.keys(counts).length);verifyDirectQuoteCounts(counts,{closed: "afterShutdown"});
		return {route
			, ...identity
			, receiptSha256: result.receiptSha256
			, archive: artifact
			, runtimeIdentity: manifest.runtimeIdentity
			, wasmtime: manifest.wasmtime
			, worldSha256: sha256(await readFile(world))
			, componentSha256: manifest.componentSha256
			, sources,clientSha256: sha256(await readFile(exe)),counts};
	}
	const client = join(root,"client.c"); await copyFile(source,client);
	await run(process.env.CC ?? "cc",["-std=c11","-Wall","-Wextra","-Werror","client.c",...tokens,"-ldl","-o","client"],root,process.env);
	const resultText = await run(join(root,"client"),[join(install,"lib/liblean_bridge_native.so")],root,
		{PATH: "/no-producer-tools",LEAN_NUM_THREADS: "1",RAYON_NUM_THREADS: "1",LANG: "C.UTF-8"});
	const observed = JSON.parse(resultText);
	assert.ok(observed.held>observed.baseline); assert.equal(observed.baseline,observed.after);
	assert.deepEqual([observed.shutdown,observed.entries,observed.staleVisits,observed.recovered],[0,2,0,42]);
	let hostInputs;
	if(inputs)
	{
		const extra=join(root,"inputs.c"), exe=join(root,"inputs");
		await copyFile(resolve("tests/fixtures/structured-types/tariff-wasmtime-inputs.c"),extra);
		await run(process.env.CC??"cc",["-std=c11","-Wall","-Wextra","-Werror",extra,...tokens,"-ldl","-o",exe],root,process.env);
		const counts=JSON.parse(await run(exe,[join(install,"lib/liblean_bridge_native.so")],root,
			{PATH: "/no-producer-tools",LEAN_NUM_THREADS: "1",RAYON_NUM_THREADS: "1",LANG: "C.UTF-8"}));
		assert.ok(counts.held>counts.baseline); assert.equal(counts.after,counts.baseline);
		assert.deepEqual([counts.shutdown,counts.mixed,counts.inputs,counts.hostCalls],[0,78,[9,5,6,2],4]);
		hostInputs={sourceSha256: sha256(await readFile(extra)),clientSha256: sha256(await readFile(exe)),observed: counts};
	}
	return {route,receiptSha256: result.receiptSha256
		, archiveSha256: artifact.sha256
		, worldSha256: sha256(await readFile(world))
		, componentSha256: manifest.componentSha256,wasmtime: manifest.wasmtime
		, ...identity,clientSha256: sha256(await readFile(client)),observed
		, ...hostInputs ? {hostInputs} : {}};
};

test("installed WIT function fields and direct staged replies execute through the Wasmtime session", {timeout: 7_200_000}, async t => {
	const work = await mkdtemp(join(tmpdir(),"wasmtime-tariff-")); t.after(()=>rm(work,{recursive: true,force: true}));
	const keep = process.env.LEAN_BRIDGE_WIT_TARIFF_KEEP, replay = process.env.LEAN_BRIDGE_WIT_TARIFF_REPLAY;
	const incoming=process.env.LEAN_BRIDGE_WIT_TARIFF_REQUIRE_INCOMING==="1";
	assert.ok(!(keep && replay));
	const sets = replay ? resolve(replay) : await mkdtemp(join(keep ?? work,"handoffs-"));
	t.diagnostic("Handoffs: "+sets);
	const output = resolve(process.env.LEAN_BRIDGE_WIT_TARIFF_OUTPUT ?? "build/wit-function-fields");
	await mkdir(output,{recursive: true});
	for(const route of routes)
	{
		if(!replay) await buildHandoff(sets,work,route,incoming);
		const root = join(work,route); await mkdir(root);
		const report = await exercise(root,join(sets,route),route,Boolean(replay),incoming);
		await writeFile(join(output,route+".json"),canonicalJson(report));
		t.diagnostic(route+": "+report.receiptSha256);
		await rm(root,{recursive: true});
	}
});
