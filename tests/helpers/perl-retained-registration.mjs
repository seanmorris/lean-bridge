/**
 * Check callback registration lifetimes against previously installed native Perl runtimes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

const root=process.env.LEAN_BRIDGE_PERL_REGISTRATION_CLIENTS;
test("revocable Perl registrations preserve in-flight calls and process/interpreter affinity",{skip: !root},async t=>{
	const work=await mkdtemp(join(tmpdir(),"perl-registration-"));
	t.after(()=>rm(work,{recursive: true,force: true}));
	const source=await readFile("src/backends/perl/retained-registration.pm","utf8");
	const file=join(work,"RetainedCallback.pm");
	await writeFile(file,source.replaceAll("__LBNS__","LeanBridge::Retained"),{flag: "wx"});
	const perls=JSON.parse(process.env.LEAN_BRIDGE_PERLS);
	const fixture=resolve("tests/fixtures/perl-retained-tasks/registration.t");
	assert.equal(perls.length,4);
	for(const [i,perl] of perls.entries())
	{
		const lib=join(resolve(root),"abi-"+i,"relocated/runtime/lib/perl5");
		const tap=await run(perl,[fixture,file],work,{PATH: "/unavailable",PERL5LIB: lib,LANG: "C.UTF-8",LEAN_NUM_THREADS: "1"});
		assert.doesNotMatch(tap,/^not ok\b/mu);
		assert.match(tap,/^1\.\.18$/mu);
		t.diagnostic(perl+": 18 TAP positions (thread affinity conditional)");
	}
});
