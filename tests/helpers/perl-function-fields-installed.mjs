/** @file Exercise leased Perl function fields from relocated, offline CPAN installs. */
import assert from "node:assert/strict";
import {copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename, join, resolve} from "node:path";
import test from "node:test";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";
import {canonicalJson, sha256} from "../../src/capsule/node.mjs";
import {installCpanArchive} from "../../src/release/cpan-install.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {copyPackageSetHandoff} from "./package-set.mjs";
import {checkStagedQuoteIdentities, prepareStagedQuoteProject} from "./staged-quote-project.mjs";

const routes = ["ordinary","reviewed"];
const abis = ["5.36.3-threaded","5.36.3-unthreaded","5.38.2-threaded","5.38.2-unthreaded"];
const fixture = resolve("tests/fixtures/structured-types/tariff-fields.pl");

const buildSets = async (root,work) => {
	for(const route of routes)
	{
		const project = join(work,route+"-project"), output = join(work,route+"-output");
		await prepareStagedQuoteProject(project,route,"cpan");
		try
		{
			await buildCanonicalProject({projectRoot:project,outputRoot:output,targets:["cpan"]});
		} catch(error)
		{
			throw new Error(route+" CPAN build failed: "+error.message+" "+JSON.stringify(error.details),{cause:error});
		}
		await copyPackageSetHandoff(output,join(root,route));
		await rm(project,{recursive:true}); await rm(output,{recursive:true});
	}
};

const install = async (root,packages,perl,env) => {
	const work = await mkdtemp(join(root,"cpan-")), prefix = join(work,"prefix"), deployment = join(work,"relocated");
	try
	{
		const mounted = {};
		for(const role of ["runtime","component"])
		{
			const local = join(work,basename(packages[role]));
			await copyFile(packages[role],local);
			const info = await installCpanArchive({archive:local,workingRoot:work,prefix:join(prefix,role),perl,
				mode:"prebuilt-only",environment:{...env,PERL5LIB:mounted.runtime ?? ""}});
			mounted[role] = info.perl5lib;
			await rm(local);
		}
		await rename(prefix,deployment);
		const client = join(work,"tariff.pl"); await copyFile(fixture,client);
		const lib = role => join(deployment,role,"lib/perl5");
		const child = {PERL5LIB:[lib("component"),lib("runtime")].join(":"),PATH:"/no-author-tools",
			LANG:"C.UTF-8",LEAN_NUM_THREADS:"1",TARIFF_INSTALL:deployment};
		const record = JSON.parse(await run(perl,[client],work,child));
		const {baseline,held,after,shutdown,stageCalls,staged,staleVisits,recovered} = record;
		assert.ok(held > baseline); assert.equal(after,baseline);
		assert.deepEqual([shutdown,stageCalls,staged,staleVisits,recovered],[0,1,44,0,42]);
		assert.match(record.installReceiptSha256,/^[0-9a-f]{64}$/u);
		return record;
	} finally
	{
		await rm(work,{recursive:true,force:true});
	}
};

test("relocated CPAN callable fields and direct higher-order replies on all four Perl ABIs", {timeout:7_200_000}, async t => {
	const env = process.env, perls = JSON.parse(env.LEAN_BRIDGE_PERLS);
	assert.equal(perls.length,4);
	const work = await mkdtemp(join(tmpdir(),"perl-tariff-"));
	t.after(() => rm(work,{recursive:true,force:true}));
	const keep = env.LEAN_BRIDGE_PERL_TARIFF_KEEP, replay = env.LEAN_BRIDGE_PERL_TARIFF_REPLAY;
	assert.ok(!(keep && replay));
	const root = replay ? resolve(replay) : await mkdtemp(join(keep ?? work,"handoffs-"));
	if(!replay) await buildSets(root,work);
	t.diagnostic("Handoffs: "+root);
	const output = resolve(env.LEAN_BRIDGE_PERL_TARIFF_OUTPUT ?? "build/perl-function-fields");
	await mkdir(output,{recursive:true});
	for(const route of routes)
	{
		const set = join(root,route), {receipt,result} = await readVerifiedPackageSetReceipt({receiptPath:join(set,"package-set-receipt.json")});
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
		const observations = [];
		for(const perl of perls) observations.push(await install(work,packages,perl,env));
		assert.deepEqual(observations.map(r=>r.version+"-"+r.threads).sort(),abis);
		await writeFile(join(output,route+".json"),canonicalJson({route,receiptSha256:result.receiptSha256,
			...identity,archives,clientSha256:sha256(await readFile(fixture)),observations}));
		t.diagnostic(route+": "+result.receiptSha256);
	}
});
