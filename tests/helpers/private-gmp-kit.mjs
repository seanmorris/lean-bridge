/** @file Validate reuse of an actual isolated, source-built GMP distribution from a recorded release. */
import assert from "node:assert/strict";
import {cp,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {privateGmpKit,taskGmpKit} from "../../src/build/task-gmp.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {runNativeTool} from "./native-effect-consumers.mjs";

test("public and isolated GMP are not interchangeable, even with a mislabeled ELF",async t=>{
	const env=process.env,dir=await mkdtemp(join(tmpdir(),"private-linkage-"));
	t.after(()=>rm(dir,{recursive: true,force: true}));
	const root=env.LEAN_BRIDGE_PRIVATE_GMP_ROOT,pin=env.LEAN_BRIDGE_PRIVATE_GMP_SHA256,publicRoot=env.LEAN_BRIDGE_TASK_GMP_ROOT;
	assert.ok(root&&pin&&publicRoot&&env.LEAN_BRIDGE_TASK_GMP_SHA256,"supply separately pinned private and public GMP producer kits");
	const stage=(dst,variables)=>privateGmpKit({root: join(dir,dst),environment: variables});
	const accepted=await stage("good",env);assert.equal(accepted.identity,pin);
	for(const [name,bytes] of accepted.files)
	{
		assert.deepEqual(bytes,await readFile(join(root,name)));
		assert.deepEqual(bytes,await readFile(join(dir,"good",name)));
	}
	await writeFile(join(dir,"consumer.c"),`#include <gmp.h>
#include <stdio.h>
int main(void) {
    mpz_t n; mpz_init_set_ui(n,1); mpz_mul_2exp(n,n,128); mpz_add_ui(n,n,7);
    mpz_out_str(stdout,10,n); mpz_clear(n); return 0;
}
`);
	await runNativeTool(env.CC??"cc",["-Wall","-Werror","-Igood/include","consumer.c","-Lgood/lib","-l:libgmp-lean-bridge.so.10","-Wl,-rpath,$ORIGIN/good/lib","-o","consumer"],dir,env);
	const dynamic=await runNativeTool("readelf",["--dynamic","consumer"],dir,{...env,LC_ALL: "C"});
	assert.match(dynamic,/\(NEEDED\).*\[libgmp-lean-bridge\.so\.10\]/u);
	assert.doesNotMatch(dynamic,/\(NEEDED\).*\[libgmp\.so/u);
	assert.equal(await runNativeTool(join(dir,"consumer"),[],dir,{PATH: "/no-build-tools"}),String((1n<<128n)+7n));
	await assert.rejects(stage("partial",{LEAN_BRIDGE_PRIVATE_GMP_ROOT: root}),/independently pinned/u);
	await assert.rejects(stage("wrong-pin",{...env,LEAN_BRIDGE_PRIVATE_GMP_SHA256: "0".repeat(64)}),/receipt digest mismatch/u);
	await assert.rejects(stage("not-private",{...env,LEAN_BRIDGE_PRIVATE_GMP_ROOT: publicRoot,LEAN_BRIDGE_PRIVATE_GMP_SHA256: env.LEAN_BRIDGE_TASK_GMP_SHA256}),/Unsupported private GMP/u);
	await assert.rejects(taskGmpKit({root: join(dir,"not-public"),environment: {...env,LEAN_BRIDGE_TASK_GMP_ROOT: root,LEAN_BRIDGE_TASK_GMP_SHA256: pin}}),/Unsupported public GMP/u);

	const clone=join(dir,"mislabeled"),library="lib/libgmp-lean-bridge.so.10",manifest="share/lean-bridge/gmp.json";
	await cp(root,clone,{recursive: true});
	const doc=JSON.parse(await readFile(join(clone,manifest)));
	const wrongElf=async (bytes,dst)=>{
		await writeFile(join(clone,library),bytes);doc.files[library]={bytes: bytes.length,sha256: sha256(bytes)};
		const m=canonicalJson(doc);await writeFile(join(clone,manifest),m);
		await assert.rejects(stage(dst,{...env,LEAN_BRIDGE_PRIVATE_GMP_ROOT: clone,LEAN_BRIDGE_PRIVATE_GMP_SHA256: sha256(m)}),/isolated ELF SONAME and symbolic binding/u);
		await assert.rejects(readFile(join(dir,dst,library)),{code: "ENOENT"});
	};
	await wrongElf(await readFile(join(publicRoot,"lib/libgmp.so.10")),"renamed-public");
	await writeFile(join(dir,"fixture.c"),"int identity_fixture(void) { return 1; }\n");
	await runNativeTool(env.CC??"cc",["-shared","-fPIC","-Wl,-soname,libgmp-lean-bridge.so.10","fixture.c","-o","no-symbolic.so"],dir,env);
	await wrongElf(await readFile(join(dir,"no-symbolic.so")),"missing-symbolic");
});
