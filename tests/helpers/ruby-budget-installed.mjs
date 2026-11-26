/** @file Install original standalone Ruby task gems and test callback admission through MRI. */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createReadStream} from "node:fs";
import {copyFile,mkdir,mkdtemp,readFile,rename,rm,stat,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {isAbsolute,join,relative,resolve} from "node:path";
import test from "node:test";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {buildNativeBudget,nativeBudgetReview} from "./native-budget-handoff.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

const digest=async file=>{
	const hash=createHash("sha256");for await(const bytes of createReadStream(file)) hash.update(bytes);return hash.digest("hex");
};
test("relocated Ruby gems keep single-use rejection distinct from Ruby and Lean errors",{timeout: 7200000},async t=>{
	const env=process.env,ruby=env.LEAN_BRIDGE_RUBY??"ruby";
	const work=await mkdtemp(join(tmpdir(),"ruby-budget-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const keep=env.LEAN_BRIDGE_RUBY_BUDGET_KEEP,replay=env.LEAN_BRIDGE_RUBY_BUDGET_REPLAY;assert.ok(!(keep && replay));
	const sets=replay?resolve(replay):await mkdtemp(join(keep??work,"handoffs-"));
	const output=resolve(env.LEAN_BRIDGE_RUBY_BUDGET_OUTPUT??"build/ruby-budget");
	await mkdir(output,{recursive: true});
	const executable=(await run(ruby,["-rrbconfig","-e","puts File.realpath(RbConfig.ruby)"],work,env));
	const source=resolve("tests/fixtures/native-callback-budget/client.rb");let ordinary,first,shared;
	for(const route of ["ordinary","reviewed"])
	{
		const set=join(sets,"rubygems",route),install=join(work,route+"-install"),app=join(work,route+"-app");
		if(!replay) await buildNativeBudget({work,set,target: "rubygems",route,ordinary});
		const {result,receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(set,"package-set-receipt.json")});
		assert.deepEqual(result.profiles,["native-ruby-task-v1"]);assert.equal(receipt.packages.length,1);
		const [pkg]=receipt.packages;assert.equal(pkg.name,"rubygems-budget");assert.equal(pkg.runtimeDelivery,"embedded");
		assert.equal(pkg.artifacts.length,1);const [archive]=pkg.artifacts;
		await mkdir(install);await mkdir(app);const home=join(install,"gems"),moved=join(app,"relocated"),gem=join(install,"input.gem");
		await copyFile(join(set,archive.path),gem);
		const isolated={PATH: "/unavailable",LANG: "C.UTF-8",GEMRC: "/dev/null",TMPDIR: app,GEM_HOME: home,GEM_PATH: home,LEAN_NUM_THREADS: "4"};
		await run(executable,["--disable-gems","-rrubygems/gem_runner","-e","Gem::GemRunner.new.run(ARGV)","--","install","--local","--no-document",gem],app,isolated);
		await rename(home,moved);await rm(install,{recursive: true});isolated.GEM_HOME=isolated.GEM_PATH=moved;
		const version=await run(executable,["-e","print RUBY_VERSION"],app,isolated);assert.match(version,/^3\.3\./u);
		const root=await run(executable,["-e",'print Gem::Specification.find_by_name("rubygems-budget","=1.0.0").full_gem_path'],app,isolated);
		assert.ok(isAbsolute(root) && root.startsWith(moved+"/"));
		const json=async path=>JSON.parse(await readFile(join(root,"lean-bridge",path+".json")));
		const api=await json("binding-ir"),proof=await json("elaboration"),inner=await json("package-receipt");
		assert.equal(hashBindingIr(api),receipt.profiles[0].bindingIrSha256);assert.equal(inner.bindingIrSha256,hashBindingIr(api));
		assert.equal(proof.sourceTreeSha256,receipt.source.treeSha256);assert.equal(pkg.runtimeIdentity,inner.runtimeIdentity);
		const runtimeLibraries={};
		for(const [file,f] of Object.entries(inner.files))
		{
			const path=resolve(root,file);assert.ok(!relative(root,path).startsWith("..") && !isAbsolute(file));
			assert.equal((await stat(path)).size,f.bytes);assert.equal(await digest(path),f.sha256);
			if(file.endsWith("/libleanshared.so") || file.endsWith("/liblean_bridge_native.so")) runtimeLibraries[file]=f.sha256;
		}
		assert.equal(Object.keys(runtimeLibraries).length,2);
		for(const d of api.declarations) for(const p of d.parameters.slice(1))
		{
			const callback=api.types.find(t=>t.id===p.type.id);
			assert.equal(callback.callable.invocation,d.source.declaration==="Budget.probe" && p.name==="g"?"many":"once");
		}
		if(route==="ordinary")
		{
			ordinary=api;first=archive.sha256;shared=runtimeLibraries;assert.equal(proof.reviewedSourceSha256,null);
		}
		else
		{
			assert.equal(proof.reviewedSourceSha256,sha256(canonicalJson(api)));assert.equal(api.documentation.summary,nativeBudgetReview);
			assert.notEqual(archive.sha256,first);assert.deepEqual(runtimeLibraries,shared);
		}
		const file=join(app,"client.rb");await copyFile(source,file);const clientSha256=await digest(file);
		const observation=await run(executable,["-w","client.rb"],app,isolated);
		assert.equal(observation,"Ruby: 16 one-call worker races; factory, terminal, typed and original errors distinct; capture released; zero leases");
		const row={route,archive,version,observation,runtimeLibraries,clientSha256
			, receiptSha256: result.receiptSha256,bindingIrSha256: hashBindingIr(api)
			, runtimeIdentity: pkg.runtimeIdentity
			, sourceTreeSha256: proof.sourceTreeSha256
			, reviewedSourceSha256: proof.reviewedSourceSha256};
		await writeFile(join(output,route+".json"),canonicalJson(row));await rm(app,{recursive: true});
	}
	t.diagnostic("Handoffs: "+sets);
});
