/** @file Reinstall the November 24 CPAN package bytes and observe the declared error's last reference. */
import assert from "node:assert/strict";
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {checkInstalledPerlHostPair} from "./perl-host-installed.mjs";

const shared="44164075aa223e5d7126803c501f53e9c0154028ee606998d70b3657de44b4a9";
// These are the original archive identities, not caller-supplied expectations.
const pins={
	ordinary:{runtime:shared,Workshop:"76c2dc1c9a960fc156aed33053f36253c3ba6e7074d543820c0ce2bef475f02a",Peer:"ced1b6741fe844ae835455617c1d993f27624c89c33daf69282586cd843863e7"},
	reviewed:{runtime:shared,Workshop:"c73b2b0e47f9690a9c2d2a090816d6ffae8637f573d47fd411bd087605bad109",Peer:"c73ff419cfa8868a541349f68402a7aef4a21b1cf7e3afc27bbb580fdebec6f5"}
};
test("nested CPAN errors carry the last application meter into a second package on four Perl ABIs", {timeout:7_200_000}, async t=>{
	const original=process.env.LEAN_BRIDGE_PERL_ERROR_OWNER_ORIGINAL;
	assert.ok(original,"set LEAN_BRIDGE_PERL_ERROR_OWNER_ORIGINAL to the original five digest-prefixed CPAN archives");
	const interpreters=JSON.parse(process.env.LEAN_BRIDGE_PERLS??"[]"); assert.equal(interpreters.length,4);
	const scratch=await mkdtemp(join(tmpdir(),"perl-error-owner-")); t.after(()=>rm(scratch,{recursive:true,force:true}));
	const output=resolve(process.env.LEAN_BRIDGE_PERL_ERROR_OWNER_OUTPUT??"build/perl-error-owner");
	await mkdir(output,{recursive:true});
	const files=await readdir(original), paths={};
	for(const id of new Set(Object.values(pins).flatMap(Object.values))) {
		const names=files.filter(n=>n.startsWith(id+"-") && n.endsWith(".tar.gz")); assert.equal(names.length,1);
		const path=join(original,names[0]); assert.equal(sha256(await readFile(path)),id); paths[id]=path;
	}
	const all=[];
	for(const interpreter of interpreters) {
		const raw=await run(interpreter,["-MConfig","-e",'print join(" ",$Config{version},$Config{useithreads} eq "define" ? "threaded" : "unthreaded",$Config{archname})'],scratch,{PATH:"/no-tools"});
		const [version,threads,arch]=raw.split(" "); all.push({interpreter,version,threads,arch});
	}
	assert.deepEqual(all.map(i=>i.version+"-"+i.threads).sort(),["5.36.3-threaded","5.36.3-unthreaded","5.38.2-threaded","5.38.2-unthreaded"]);
	for(const [route,archives] of Object.entries(pins)) {
		const set=Object.fromEntries(Object.entries(archives).map(([k,id])=>[k,paths[id]])),installed=[];
		for(const {interpreter,...abi} of all) {
			const result=await checkInstalledPerlHostPair({scratch,set,route,interpreter});
			installed.push({...abi,...result}); t.diagnostic(route+" "+abi.version+" "+abi.threads+" passed both orders");
		}
		await writeFile(join(output,route+".json"),canonicalJson({route,archives,installed}));
	}
});
