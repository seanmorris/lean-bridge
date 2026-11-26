/** @file Compile a fresh XS facade over the actual C adapter, not an installed CPAN qualification. */
import assert from "node:assert/strict";
import {mkdir,mkdtemp,readFile,rm,symlink} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {generateOwnedPerlXs} from "../../src/backends/perl/owned-xs.mjs";
import {nativeCallbackHeader} from "../../src/backends/native/callback-broker.mjs";
import {linuxBrokerHeader} from "../../src/backends/native/runtime-broker.mjs";
import {sha256} from "../../src/capsule/node.mjs";
import {frameReplaySource} from "./callback-frame-source.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runNativeTool} from "./native-effect-consumers.mjs";
import {runPerlIncoming} from "./perl-incoming-client.mjs";

const env=process.env, snapshot='MODULE = LeanBridge::TariffQuotes PACKAGE = LeanBridge::Runtime\n\nSV*\n_snapshot()\n  CODE:\n    lean_bridge_native_snapshot s; lean_bridge_native_snapshot_read(&s);\n    HV *h = newHV(); hv_stores(h, "live_identities", newSVuv(s.live_identities));\n    RETVAL = newRV_noinc((SV*)h);\n  OUTPUT:\n    RETVAL\n';
for(const route of env.LEAN_BRIDGE_FRAME_NATIVE_STAGE?["ordinary"]:["ordinary","reviewed"]) test(route+" direct closure across real Perl XS ABIs",async t=>{
	const work=await mkdtemp(join(tmpdir(),"perl-direct-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const run=(cmd,args,cwd=work,environment=env)=>runNativeTool(cmd,args,cwd,environment);
	const stage=env.LEAN_BRIDGE_FRAME_NATIVE_STAGE,source=await frameReplaySource({env,route,work,run,direct: true});
	const bound=join(source.installed,"share/lean-bridge");
	const adapter=JSON.parse(await readFile(stage?resolve(stage,"owned-c-binding/native-c-adapter.json"):join(bound,"native-c-adapter.json")));
	const runtime=JSON.parse(await readFile(stage?resolve(stage,"runtime/runtime.json"):join(bound,"runtime.json")));
	const library=join(source.lib,adapter.library);
	if(stage) await symlink(resolve(stage,"owned-c-binding/lib",adapter.library),library);
	assert.equal(sha256(await readFile(library)),adapter.files["lib/"+adapter.library].sha256);
	const header=linuxBrokerHeader.replace("#ifdef __cplusplus\n}",nativeCallbackHeader+"\n#ifdef __cplusplus\n}");
	assert.equal(sha256(header),runtime.files["include/lean_bridge_native_runtime.h"].sha256);
	const xs=generateOwnedPerlXs(source.model.bindingIr,"LeanBridge::TariffQuotes");
	assert.ok(xs.c.callbackArgumentViews && !xs.wholeOwners);
	const name=xs.c.prefix+".h",entry="include/"+name;
	const installedHeader=await readFile(stage?resolve(stage,"owned-c-binding",entry):join(source.installed,entry),"utf8");
	assert.equal(sha256(installedHeader),adapter.files[entry].sha256);
	// Older archives lack two explanatory comment lines. All declarations, includes
	// and their order must still match; compile against the authentic header below.
	const declarations=h=>h.replace(/\/\*[\s\S]*?\*\//gu," ");
	assert.equal(declarations(xs.c.header),declarations(installedHeader));
	await saveLakeFile(work,"lean_bridge_native_runtime.h",header);
	await saveLakeFile(work,name,installedHeader);
	await saveLakeFile(work,"Probe.xs",'#include "'+xs.c.prefix+'.h"\n#include "lean_bridge_native_runtime.h"\n'+xs.declarations+"\n"+xs.xs+"\n"+snapshot);
	await saveLakeFile(work,"LeanBridge/TariffQuotes.pm",xs.valuesSource+"\npackage LeanBridge::TariffQuotes; use DynaLoader (); our @ISA=('DynaLoader'); our $VERSION='0.001'; __PACKAGE__->bootstrap($VERSION); 1;\n");
	const out=join(work,"auto/LeanBridge/TariffQuotes");await mkdir(out,{recursive: true});
	const versions=[];
	for(const perl of JSON.parse(env.LEAN_BRIDGE_PERLS))
	{
		const cfg=JSON.parse(await run(perl,["-MConfig","-MText::ParseWords","-MJSON::PP","-e",'print encode_json({v=>$Config{version},arch=>$Config{archname},inc=>"$Config{archlibexp}/CORE",flags=>[Text::ParseWords::shellwords("$Config{ccflags} $Config{cccdlflags}")]})']));
		await run(perl,["-MExtUtils::ParseXS","-e","ExtUtils::ParseXS::process_file(filename=>'Probe.xs',output=>'Probe.c',prototypes=>0)"]);
		await run(env.CC??"cc",["-std=gnu11","-O1","-g0","-shared","-Wall","-Wextra","-Werror","-Wno-unused-function",...cfg.flags,"-I"+cfg.inc,"-I"+join(env.LEAN_BRIDGE_LEAN_PREFIX,"include"),"-I"+join(source.installed,"include"),"-I"+work,"Probe.c","-L"+source.lib,"-Wl,--no-as-needed","-l:"+adapter.library,"-llean_bridge_native","-l:libgmp.so.10","-Wl,-rpath,"+source.lib,"-o",join(out,"TariffQuotes.so")]);
		const result=await runPerlIncoming(work,perl,{PERL5LIB: work,PATH: "/unavailable",LEAN_NUM_THREADS: "1"});
		versions.push(cfg.v+"-"+cfg.arch);t.diagnostic(JSON.stringify({route,origin: source.origin,perl: cfg.v,arch: cfg.arch,...result}));
	}
	assert.equal(new Set(versions).size,4);
});
