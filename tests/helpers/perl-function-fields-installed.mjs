/** @file Exercise leased Perl function fields from relocated, offline CPAN installs. */
import assert from "node:assert/strict";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename, join, resolve} from "node:path";
import test from "node:test";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";
import {canonicalJson, sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {copyPackageSetHandoff} from "./package-set.mjs";
import {checkStagedQuoteIdentities, prepareStagedQuoteProject} from "./staged-quote-project.mjs";
import {fixture, hostFixture, installPerlTariff} from "./perl-function-fields-consumer.mjs";
import "./perl-function-fields-compiler.mjs";

const routes = ["ordinary","reviewed"];
const abis = ["5.36.3-threaded","5.36.3-unthreaded","5.38.2-threaded","5.38.2-unthreaded"];

const buildSets = async (root,work) => {
	for(const route of routes)
	{
		const project = join(work,route+"-project"), output = join(work,route+"-output");
		await prepareStagedQuoteProject(project,route,"cpan");
		try
		{
			await buildCanonicalProject({projectRoot: project,outputRoot: output,targets: ["cpan"]});
		} catch(error)
		{
			throw new Error(route+" CPAN build failed: "+error.message+" "+JSON.stringify(error.details),{cause: error});
		}
		await copyPackageSetHandoff(output,join(root,route));
		await rm(project,{recursive: true}); await rm(output,{recursive: true});
	}
};

test("relocated CPAN callable fields and direct higher-order replies on all four Perl ABIs", {timeout: 7_200_000}, async t => {
	const env = process.env, perls = JSON.parse(env.LEAN_BRIDGE_PERLS);
	assert.equal(perls.length,4);
	const work = await mkdtemp(join(tmpdir(),"perl-tariff-"));
	t.after(() => rm(work,{recursive: true,force: true}));
	const keep = env.LEAN_BRIDGE_PERL_TARIFF_KEEP, replay = env.LEAN_BRIDGE_PERL_TARIFF_REPLAY;
	assert.ok(!(keep && replay));
	const xsOnly=env.LEAN_BRIDGE_PERL_TARIFF_XS_ONLY==="1";
	assert.ok(!xsOnly || replay,"an XS-only replay requires exact retained releases");
	const root = replay ? resolve(replay) : await mkdtemp(join(keep ?? work,"handoffs-"));
	if(!replay) await buildSets(root,work);
	t.diagnostic("Handoffs: "+root);
	const output = resolve(env.LEAN_BRIDGE_PERL_TARIFF_OUTPUT ?? "build/perl-function-fields");
	await mkdir(output,{recursive: true});
	for(const route of routes)
	{
		const set = join(root,route), {receipt,result} = await readVerifiedPackageSetReceipt({receiptPath: join(set,"package-set-receipt.json")});
		assert.equal(receipt.packages.length,2);
		const packages = {}, archives = {};
		for(const pkg of receipt.packages)
		{
			assert.equal(pkg.target,"cpan"); assert.equal(pkg.artifacts.length,1);
			const [archive] = pkg.artifacts; packages[pkg.role] = join(set,archive.path); archives[pkg.name] = archive.sha256;
		}
		assert.deepEqual(Object.keys(archives).sort(),["LeanBridge-Runtime","LeanBridge-TariffQuotes"]);
		const archive = packages.component, top = basename(archive,".tar.gz");
		const meta = async name => JSON.parse(await run("tar",["-xOzf",archive,top+"/"+name+".json"],work,env));
		const identity = checkStagedQuoteIdentities(await meta("model"),await meta("binding-ir"),receipt.profiles[0],route);
		const advertised=(await meta("binding-manifest")).owned.hostInputRecords;
		if(replay && advertised===undefined)
		{
			const old=new URL("../../docs/evidence/perl-function-fields-20261126/"+route+".json",import.meta.url);
			assert.equal(result.receiptSha256,JSON.parse(await readFile(old)).receiptSha256);
			assert.ok(!xsOnly,"the historical package predates borrowed record fields");
		} else assert.deepEqual(advertised,[{
			type: "lean:Owned.Tariff", input: "LeanBridge::TariffQuotes::TariffInput"
			, fields: ["quote"], lifetime: "call"
		}]);
		const packageRoot=join(work,"manifest-"+route); await mkdir(packageRoot);
		await writeFile(join(packageRoot,"lean-bridge-package.json"),canonicalJson(await meta("lean-bridge-package")));
		const loader="lib/LeanBridge/TariffQuotes.pm", original=join(packageRoot,"lib/LeanBridge");
		await mkdir(original,{recursive: true});
		// The runner trims stdout; read original bytes before checking the loader seal.
		await run("tar",["-xzf",archive,"--strip-components=1","-C",packageRoot,top+"/"+loader],work,env);
		const modes=xsOnly?["build-xs"]:advertised?["prebuilt-only","build-xs"]:["prebuilt-only"];
		const observations = [];
		for(const perl of perls) observations.push(...await installPerlTariff(work,packages,perl,env,Boolean(advertised),modes,packageRoot));
		for(const mode of modes)
			assert.deepEqual(observations.filter(r=>(r.installXs?.mode??"prebuilt-only")===mode).map(r=>r.version+"-"+r.threads).sort(),abis);
		const report={route,receiptSha256: result.receiptSha256
			, ...identity,archives,clientSha256: sha256(await readFile(fixture))
			, observations
			, ...advertised ? {hostClientSha256: sha256(await readFile(hostFixture))} : {}};
		await writeFile(join(output,route+(xsOnly?".generated-xs":"")+".json"),canonicalJson(report));
		t.diagnostic(route+": "+result.receiptSha256);
	}
});
