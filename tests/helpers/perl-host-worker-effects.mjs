/** @file Exercise granted and denied OS effects on installed Perl worker packages. */
import assert from "node:assert/strict";
import {copyFile,mkdtemp,rename,rm} from "node:fs/promises";
import {join} from "node:path";
import test from "node:test";
import {installCpanArchive} from "../../src/release/cpan-install.mjs";
import {checkHostWorkerEffects} from "./host-worker-effect-handoffs.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {preparePerlWorkerProject} from "./perl-worker-project.mjs";

const fixture="tests/fixtures/perl-host-workers/effects.pl";
const runClient=async(root,dir,receipt,perl)=>{
	const sub=await mkdtemp(join(root,"client-")),prefix=join(sub,"original"),moved=join(sub,"deployed");
	try
	{
		for(const role of ["runtime","component"])
		{
			const [a]=receipt.packages.find(p=>p.role===role).artifacts;
			await installCpanArchive({archive: join(dir,a.path),workingRoot: sub,prefix,perl,mode: "prebuilt-only",environment: process.env});
		}
		await rename(prefix,moved);await copyFile(fixture,join(sub,"app.pl"));
		const env={PATH: "/no-tools",LD_BIND_NOW: "1",LEAN_NUM_THREADS: "1",LEAN_BRIDGE_EFFECT_BOOT: "from-app",PERL5LIB: process.env.PERL5LIB};
		assert.match(await run(perl,["-I"+join(moved,"lib/perl5"),join(sub,"app.pl")],sub,env,90000),/exactly one effective close passed/u);
	}
	finally
	{await rm(sub,{recursive: true,force: true});}
};
test("installed CPAN host workers honor effect grants through initialization, pull and close",{timeout: 3600000},async t=>{
	const perls=JSON.parse(process.env.LEAN_BRIDGE_PERLS??'["perl"]');
	const consume=async(root,handoff,receipt)=>{
		for(const p of perls)await runClient(root,handoff,receipt,await run(p,["-e","print $^X"],root,process.env));
		return perls.length;
	};
	await checkHostWorkerEffects(t,{target: "cpan",profile: "native-perl-task-v1",prepare: preparePerlWorkerProject,consume});
});
