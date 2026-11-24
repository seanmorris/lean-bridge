/** @file Load the real shared Runtime.xs with two independently compiled Perl components. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { buildNativeSharedRuntime } from "../../src/build/native-component.mjs";
import { readVerifiedNativeRuntime } from "../../src/build/native-artifacts.mjs";
import { perlHostMembers } from "../../src/backends/perl/host-members.mjs";
import { sha256 } from "../../src/capsule/node.mjs";

const exec = promisify(execFile);
test("independent Perl components share canonical Lean refs and retire them on final unbind", {timeout: 180_000}, async t => {
	const root = await mkdtemp(join(tmpdir(), "perl-shared-host-"));
	t.after(() => rm(root, {recursive: true, force: true}));
	const perl = process.env.LEAN_BRIDGE_PERL ?? "perl", cc = process.env.CC ?? "cc";
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const backend = resolve("src/backends/perl"), fixture = resolve("tests/fixtures/perl-host-meter");
	const installed = join(root, "installed"); await mkdir(installed);
	const env = {...process.env, LD_BIND_NOW: "1", LEAN_NUM_THREADS: "1", LEAN_SYSROOT: lean};
	const run = async (tool, args, cwd=root, extra={}) => {
		try
{ return (await exec(tool, args, {cwd,env: {...env,...extra}})).stdout.trim(); }
		catch(e)
{ throw new Error([e.message,e.stdout,e.stderr].filter(Boolean).join("\n"), {cause: e}); }
	};
	const core = await run(perl, ["-MConfig", "-e", "print $Config{archlibexp}, '/CORE'"]);
	const flags = (await run(perl, ["-MConfig", "-e", "print $Config{ccflags}"])).split(/\s+/u).filter(Boolean);
	const sdk = process.env.LEAN_BRIDGE_TEST_NATIVE_RUNTIME ?? join(root,"runtime");
	if(!process.env.LEAN_BRIDGE_TEST_NATIVE_RUNTIME) await buildNativeSharedRuntime({outputRoot: sdk,leanPrefix: lean,cc});
	const runtime = await readVerifiedNativeRuntime(sdk);
	t.diagnostic("Verified native runtime: "+runtime.identity);
	const common = [...flags, "-shared", "-fPIC", "-O1", "-g0", "-pthread"
		, "-Werror=implicit-function-declaration"
		, "-I"+core, "-I"+join(sdk,"include"), "-I"+backend];
	const libs = ["-L"+join(sdk,"lib"), "-Wl,-rpath,"+join(sdk,"lib"), "-lleanshared"];
	await run(cc,[...common,join(fixture,"domain-witness.c"),...libs,"-Wl,-soname,libwitness.so","-o",join(installed,"libwitness.so")]);
	await run(perl,["-MExtUtils::ParseXS","-e","ExtUtils::ParseXS::process_file(filename=>$ARGV[0],output=>$ARGV[1],prototypes=>0)",join(backend,"Runtime.xs"),join(root,"Runtime.c")]);
	const local = ["-L"+installed,"-Wl,-rpath,$ORIGIN"];
	await run(cc,[...common,"Runtime.c",...local,...libs,"-llean_bridge_native","-ldl","-Wl,-soname,Runtime.so","-o",join(installed,"Runtime.so")]);
	const input = JSON.parse(await readFile("tests/fixtures/ruby-host-meter/lean-bridge.hosts.json","utf8"));
	const box = input.types[0]; box.host.targets = ["perl"];
	const token = structuredClone(box); token.name = "Token"; token.id += ".Token"; token.resource.kindId += ".Token"; token.host.identity = "strong-canonical";
	input.types.push(token);
	const { kinds } = perlHostMembers(input,"LeanBridge::Meter");
	assert.equal(kinds[0].strong,false); assert.equal(kinds[1].strong,true); assert.notEqual(kinds[0].key,kinds[1].key);
	for(const name of ["alpha","beta"])
	{
		const app = join(root,name); await mkdir(app);
		await copyFile(join(fixture,"DomainCheck.lean"),join(app,"DomainCheck.lean"));
		await run(join(lean,"bin/lean"),["-j1","-R",app,"-c","module.c","DomainCheck.lean"],app,{LEAN_PATH: app,LEAN_SRC_PATH: app});
		await writeFile(join(app,"component-kinds.h"),"#define COMPONENT_NAME "+JSON.stringify(name)+"\nstatic const lbp_host_spec specs[]={"
			+kinds.map(k=>"{"+JSON.stringify(k.key)+","+Number(k.strong)+"}").join(",")+"};\n");
		await writeFile(join(app,"exports.map"),"{global: domain_probe; local: *;};\n");
		await run(cc,[...common,"-I"+app,"module.c",join(fixture,"domain-component.c")
			, ...local,"-l:Runtime.so","-lwitness",...libs
			, "-Wl,--version-script=exports.map","-o",join(installed,name+".so")],app);
		await rm(app,{recursive: true});
	}
	assert.notEqual(sha256(await readFile(join(installed,"alpha.so"))),sha256(await readFile(join(installed,"beta.so"))));
	for(const names of [["alpha","beta"],["beta","alpha"]])
	{
		const result = await exec(perl,[join(fixture,"shared-domain.pl"),...names],{cwd: installed,env});
		assert.equal(result.stderr,""); assert.match(result.stdout,/shared Lean identity, distinct referents and kinds/u);
		t.diagnostic(result.stdout.trim());
	}
});
