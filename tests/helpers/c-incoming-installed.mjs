/** @file Install and relocate a package whose callback borrows a captured Lean function. */
import assert from "node:assert/strict";
import {access,copyFile,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {nativeFixtureEnvironment,installCopiedConsumer,copiedCleanEnvironment,runCopied} from "./copied-fixture-install.mjs";
import {copyPackageSetHandoff} from "./package-set.mjs";
import {fixtureCmake} from "./fixture-cmake.mjs";
import {prepareStagedQuoteProject,checkStagedQuoteIdentities} from "./staged-quote-project.mjs";

const cases=["borrow expires after success","borrow expires after failure"
	, "lease survives successful callback","lease survives failed callback"
	, "inner failure leaves outer borrow valid"
	, "foreign session rejects live borrow"];
const parseResult=stdout=>{
	const lines=stdout.trimEnd().split("\n");assert.equal(lines.pop(),"identities:1,1,1,1,1,1,0");
	assert.deepEqual(lines,cases);return {checks: 6,scenarios: lines,identities: [1,1,1,1,1,1,0]};
};
test("installed C callback borrows a captured Lean function until return",{timeout: 7200000},async t=>{
	const env=nativeFixtureEnvironment(["c"]),work=await mkdtemp(join(tmpdir(),"c-incoming-"));
	t.after(()=>rm(work,{recursive: true,force: true}));
	const cmakeTool=await fixtureCmake(work,env);
	const keep=env.LEAN_BRIDGE_C_INCOMING_KEEP,replay=env.LEAN_BRIDGE_C_INCOMING_REPLAY;assert.ok(!(keep && replay));
	const resume=env.LEAN_BRIDGE_C_INCOMING_RESUME;assert.ok(!resume || (!keep && !replay));
	const sets=resume?resolve(resume):replay?resolve(replay):await mkdtemp(join(keep??work,"handoffs-"));
	const out=resolve(env.LEAN_BRIDGE_C_INCOMING_OUTPUT??"build/c-incoming-function");await mkdir(out,{recursive: true});
	const fixtures=resolve("tests/fixtures/structured-types"),files=["tariff-incoming.c","tariff-exchange-probe.c"];
	let first;
	for(const route of ["ordinary","reviewed"])
	{
		const handoff=join(sets,route),stage=join(work,route);await mkdir(stage);
		const exists=resume && await access(handoff).then(()=>true,e=>{if(e.code!=="ENOENT") throw e;return false;});
		if(!replay && !exists)
		{
			const project=join(stage,"source"),output=join(stage,"release");
			await prepareStagedQuoteProject(project,route,"c",{incoming: true});
			const built=await buildCanonicalProject({projectRoot: project,outputRoot: output,targets: ["c"],environment: env});
			assert.equal(built.backend,"native-c-owned-v2");await copyPackageSetHandoff(output,handoff);
			await rm(project,{recursive: true});await rm(output,{recursive: true});
		}
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(handoff,"package-set-receipt.json")});
		const [pkg]=receipt.packages;assert.equal(receipt.packages.length,1);assert.equal(pkg.target,"c");
		const [client,probe]=await Promise.all(files.map(f=>readFile(join(fixtures,f),"utf8")));
		const combined="#define TARIFF_PROBE_CLIENT tariff_incoming_consumer\n"+client+"\n"+probe;
		const consumer=join(stage,"consumer");
		const pc=await installCopiedConsumer({profile: "c",consumer,handoff
			, packages: receipt.packages,environment: env
			, fixture: {source: ()=>combined,parseResult,expectedChecks: 6}});
		const local=join(consumer,"c"),dest=join(stage,"relocated");await rename(join(local,pkg.name+"-"+pkg.version+"-c"),dest);
		const json=async f=>JSON.parse(await readFile(join(dest,f))),manifest=await json("lean-bridge-package.json");
		const model=await json("share/lean-bridge/component/model.json"),ir=await json("share/lean-bridge/component/binding-ir.json");
		const pins=checkStagedQuoteIdentities(model,ir,receipt.profiles[0],route,{incoming: true});
		const lookup=t=>ir.types.find(x=>x.id===t.id),d=ir.declarations.find(x=>x.source.declaration==="Owned.visitQuote");
		const borrow=lookup(d.parameters[1].type).callable.parameters[0];assert.equal(borrow.ownership,"borrow");assert.equal(borrow.lifetime.scope,"call");
		const nested=lookup(borrow.type);assert.equal(nested.kind,"callback");
		assert.equal(nested.callable.parameters[0].type.name,"uint32");assert.equal(nested.callable.result.type.name,"uint32");
		for(const f of files) await copyFile(join(fixtures,f),join(local,f));
		await writeFile(join(local,"CMakeLists.txt"),`cmake_minimum_required(VERSION 3.20)
project(Incoming C)
find_package(${manifest.cmakePackage} 1.0.0 EXACT CONFIG REQUIRED)
add_executable(incoming tariff-incoming.c tariff-exchange-probe.c)
target_compile_definitions(incoming PRIVATE TARIFF_PROBE_CLIENT=tariff_incoming_consumer)
target_compile_options(incoming PRIVATE -Wall -Wextra -Werror -UNDEBUG)
target_link_libraries(incoming PRIVATE ${manifest.cmakeTarget} \${CMAKE_DL_LIBS})
`);
		const clean={...copiedCleanEnvironment,PATH: join(local,"tools")};
		await runCopied(cmakeTool,["-S",".","-B","build","-G","Unix Makefiles","-DCMAKE_C_COMPILER=/usr/bin/cc","-DCMAKE_MAKE_PROGRAM=/usr/bin/make","-DCMAKE_PREFIX_PATH="+dest],local,clean);
		await runCopied(cmakeTool,["--build","build","--parallel","1"],local,clean);
		const executable=join(local,"build/incoming"),cmake=parseResult((await runCopied(executable,[],local,{PATH: "/no-author-tools"})).stdout);
		assert.deepEqual(cmake,pc.result);
		const [archive]=pkg.artifacts;
		const row={route,...pins,archive,cmake,pkgConfig: pc.result
			, runtimeIdentity: pkg.runtimeIdentity
			, receiptSha256: result.receiptSha256
			, sources: Object.fromEntries(files.map((f,i)=>[f,sha256([client,probe][i])]))
			, executableSha256: sha256(await readFile(executable))};
		if(first)
		{
			assert.notEqual(first.archive.sha256,archive.sha256);
			assert.equal(first.runtimeIdentity,row.runtimeIdentity);
		}
		first=row;await writeFile(join(out,route+".json"),canonicalJson(row));await rm(stage,{recursive: true});
	}
	t.diagnostic("Handoffs: "+sets);
});
