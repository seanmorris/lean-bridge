/** @file Run the staged-function record contract from a relocated RubyGems install. */
import assert from "node:assert/strict";
import {copyFile,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename,dirname,join,resolve} from "node:path";
import test from "node:test";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {copyPackageSetHandoff} from "./package-set.mjs";
import {prepareStagedQuoteProject,checkStagedQuoteIdentities} from "./staged-quote-project.mjs";

test("Ruby calls leased function fields and staged replies after a relocated gem install",{timeout:7_200_000},async t=>{
	const env=process.env, ruby=resolve(env.LEAN_BRIDGE_RUBY??".toolchains/ruby33/bin/ruby");
	const work=await mkdtemp(join(tmpdir(),"ruby-tariff-")); t.after(()=>rm(work,{recursive:true,force:true}));
	const keep=env.LEAN_BRIDGE_RUBY_TARIFF_KEEP,replay=env.LEAN_BRIDGE_RUBY_TARIFF_REPLAY;
	assert.ok(!(keep && replay));
	const sets=replay?resolve(replay):keep?await mkdtemp(join(resolve(keep),"tariff-")):join(work,"sets");
	const routes=["ordinary","reviewed"], output=resolve(env.LEAN_BRIDGE_RUBY_TARIFF_OUTPUT??"build/ruby-function-fields");
	await mkdir(output,{recursive:true});
	for(const route of routes) {
		if(!replay) {
			const project=join(work,route+"-project"), out=join(work,route+"-build");
			await prepareStagedQuoteProject(project,route,"rubygems");
			try { await buildCanonicalProject({projectRoot:project,outputRoot:out,targets:["rubygems"],environment:env}); }
			catch(e){throw new Error(e.message+"\n"+JSON.stringify(e.details),{cause:e});}
			await copyPackageSetHandoff(out,join(sets,route));
			await rm(project,{recursive:true}); await rm(out,{recursive:true});
		}
		const feed=join(work,route+"-feed"), prefix=join(work,route+"-prefix"), app=join(work,route+"-app");
		await copyPackageSetHandoff(join(sets,route),feed);
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath:join(feed,"package-set-receipt.json")});
		assert.equal(receipt.packages.length,1); const [pkg]=receipt.packages;
		assert.equal(pkg.target,"rubygems"); assert.equal(pkg.name,"tariff-quotes"); assert.equal(pkg.version,"1.0.0");
		const gems=pkg.artifacts.filter(a=>a.path.endsWith(".gem")); assert.equal(gems.length,1);
		const [gem]=gems;
		await mkdir(app);
		await run(ruby,[join(dirname(ruby),"gem"),"install","--norc","--local","--no-document","--install-dir",prefix,join(feed,gem.path)],app,
			{...env,GEM_HOME:prefix,GEM_PATH:prefix});
		await rm(feed,{recursive:true});
		const deployed=join(app,"gems"); await rename(prefix,deployed);
		const clean={GEM_HOME:deployed,GEM_PATH:deployed,PATH:"/no-author-tools",LANG:"C.UTF-8",LEAN_NUM_THREADS:"1"};
		const installed=await run(ruby,["-e",'gem "tariff-quotes","=1.0.0";print Gem.loaded_specs.fetch("tariff-quotes").full_gem_path'],app,clean);
		assert.ok(installed.startsWith(deployed+"/gems/"));
		assert.equal(sha256(await readFile(join(deployed,"cache",basename(gem.path)))),gem.sha256);
		const meta=async n=>JSON.parse(await readFile(join(installed,"lean-bridge/component",n+".json")));
		const identity=checkStagedQuoteIdentities(await meta("model"),await meta("binding-ir"),receipt.profiles.find(p=>p.id===pkg.profile),route);
		const client=join(app,"tariff.rb"); await copyFile(resolve("tests/fixtures/structured-types/tariff-fields.rb"),client);
		const observed=JSON.parse(await run(ruby,[client],app,clean));
		const {baseline,held,after,...values}=observed; assert.ok(held>baseline);assert.equal(after,baseline);
		assert.deepEqual(values,{kept:42,staged:44,stageCalls:1,staleVisits:0,recovered:42});
		await writeFile(join(output,route+".json"),canonicalJson({route,receiptSha256:result.receiptSha256,archives:pkg.artifacts,
			...identity,clientSha256:sha256(await readFile(client)),ruby:await run(ruby,["-v"],app,clean),observed}));
		t.diagnostic(route+": "+result.receiptSha256);
	}
	t.diagnostic("Handoffs: "+sets);
});
