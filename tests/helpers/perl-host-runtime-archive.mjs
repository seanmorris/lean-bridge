/** @file Verify the shared Perl host registry in the actual distributable runtime archive. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { buildNativeSharedRuntime } from "../../src/build/native-component.mjs";
import { compileCpanXsVariant } from "../../src/build/perl-xs.mjs";
import { archiveCpanPackage, stageCpanPackage } from "../../src/release/cpan-package.mjs";
import { sha256 } from "../../src/capsule/node.mjs";

const exec = promisify(execFile);
test("the CPAN runtime archive contains the identity-bound Perl registry sources and loadable XS variants", {timeout: 1_200_000}, async t => {
	const root = await mkdtemp(join(tmpdir(),"perl-domain-archive-"));
	t.after(() => rm(root,{recursive: true,force: true}));
	const stage = await mkdtemp(join(process.env.LEAN_BRIDGE_TEST_CPAN_STAGE_PARENT ?? root,"perl-domain-stage-"));
	t.after(() => rm(stage,{recursive: true,force: true}));
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const sdk = process.env.LEAN_BRIDGE_TEST_NATIVE_RUNTIME ?? join(root,"sdk");
	if(!process.env.LEAN_BRIDGE_TEST_NATIVE_RUNTIME) await buildNativeSharedRuntime({outputRoot: sdk,leanPrefix: lean});
	const perls = process.env.LEAN_BRIDGE_PERLS ? JSON.parse(process.env.LEAN_BRIDGE_PERLS) : [process.env.LEAN_BRIDGE_PERL ?? "perl"];
	assert.ok(Array.isArray(perls) && perls.length > 0);
	const packageRoot = join(stage,"runtime");
	await stageCpanPackage({outputRoot: packageRoot,runtimeRoot: sdk,leanPrefix: lean,glibcMinimumVersion: process.env.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR ?? "2.38"});
	const variants = [];
	for(const perl of perls) variants.push(await compileCpanXsVariant({packageRoot,perl}));
	const {path,receipt} = await archiveCpanPackage({packageRoot,outputRoot: root});
	await rm(packageRoot,{recursive: true});
	assert.equal(receipt.sha256,sha256(await readFile(path)));
	const prefix = basename(path,".tar.gz"), dest = join(root,"unpacked"); await mkdir(dest);
	const bindingPath = "lib/LeanBridge/Runtime/binding.json", assets = ["Runtime.xs","host-domain.inc","lib/LeanBridge/Runtime/include/host-domain.h"];
	const paths = ["lean-bridge-package.json",bindingPath,...assets,...variants.map(v=>v.path)];
	await exec("tar",["-xzf",path,"-C",dest,...paths.map(p=>prefix+"/"+p)]);
	const read = p => readFile(join(dest,prefix,p)), manifest = JSON.parse(await read("lean-bridge-package.json"));
	const binding = JSON.parse(await read(bindingPath)); assert.equal(receipt.runtimeIdentity,sha256(await read(bindingPath)));
	for(const p of assets) assert.equal(sha256(await read(p)),binding.sources[basename(p)]);
	const probe = "use DynaLoader; my $dll=DynaLoader::dl_load_file($ARGV[0],1) or die DynaLoader::dl_error(); "
		+"for my $name (@ARGV[1..$#ARGV]) { DynaLoader::dl_find_symbol($dll,$name) or die DynaLoader::dl_error() }";
	for(const [i,v] of variants.entries())
	{
		assert.equal(sha256(await read(v.path)),manifest.files[v.path]);
		const env = {...process.env, LD_BIND_NOW: "1", LD_PRELOAD: [join(sdk,"lib/libleanshared.so"),join(sdk,"lib/liblean_bridge_native.so")].join(":")};
		const names = ["bind","unbind","enter","wrap","admit","object","live"].map(n=>"lbp_host_"+n);
		await exec(perls[i],["-e",probe,join(dest,prefix,v.path),...names],{env});
		t.diagnostic("Loaded "+v.abiKey+" XS "+manifest.files[v.path]);
	}
	t.diagnostic("Runtime archive "+receipt.sha256+" ("+variants.length+" XS variants), binding "+receipt.runtimeIdentity);
});
