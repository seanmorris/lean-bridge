/** @file Compile a fresh XS facade over the actual C adapter, not an installed CPAN qualification. */
import assert from "node:assert/strict";
import {mkdir,mkdtemp,readFile,rm,symlink} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {generateOwnedPerlXs} from "../../src/backends/perl/owned-xs.mjs";
import {nativeCallbackHeader} from "../../src/backends/native/callback-broker.mjs";
import {linuxBrokerHeader} from "../../src/backends/native/runtime-broker.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {frameReplaySource} from "./callback-frame-source.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runNativeTool} from "./native-effect-consumers.mjs";
import {runPerlIncoming} from "./perl-incoming-client.mjs";

const env=process.env, snapshot='MODULE = LeanBridge::TariffQuotes PACKAGE = LeanBridge::Runtime\n\nSV*\n_snapshot()\n  CODE:\n    lean_bridge_native_snapshot s; lean_bridge_native_snapshot_read(&s);\n    HV *h = newHV(); hv_stores(h, "live_identities", newSVuv(s.live_identities));\n    RETVAL = newRV_noinc((SV*)h);\n  OUTPUT:\n    RETVAL\n';
const application=env.LEAN_BRIDGE_FRAME_APPLICATION==="1",only=env.LEAN_BRIDGE_FRAME_APPLICATION_ROUTE,abi=env.LEAN_BRIDGE_FRAME_APPLICATION_ABI;
if(only||abi)assert.ok(application&&["ordinary","reviewed"].includes(only)&&(!abi||/^5\.(36\.3|38\.2)-(threaded|unthreaded)$/u.test(abi)));
for(const route of only?[only]:env.LEAN_BRIDGE_FRAME_NATIVE_STAGE?["ordinary"]:["ordinary","reviewed"]) test(route+" direct closure across real Perl XS ABIs",async t=>{
	const work=await mkdtemp(join(tmpdir(),"perl-direct-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const run=(cmd,args,cwd=work,environment=env)=>runNativeTool(cmd,args,cwd,environment);
	const stage=env.LEAN_BRIDGE_FRAME_NATIVE_STAGE,source=await frameReplaySource({env,route,work,run,direct: true,application});
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
	const versions=[],reports=[];
	for(const perl of JSON.parse(env.LEAN_BRIDGE_PERLS))
	{
		const cfg=JSON.parse(await run(perl,["-MConfig","-MText::ParseWords","-MJSON::PP","-e",'print encode_json({v=>$Config{version},arch=>$Config{archname},threads=>(($Config{useithreads}//"") eq "define"?"threaded":"unthreaded"),inc=>"$Config{archlibexp}/CORE",flags=>[Text::ParseWords::shellwords("$Config{ccflags} $Config{cccdlflags}")]})']));
		const version=cfg.v+"-"+cfg.threads;
		if(abi&&abi!==version)continue;
		await run(perl,["-MExtUtils::ParseXS","-e","ExtUtils::ParseXS::process_file(filename=>'Probe.xs',output=>'Probe.c',prototypes=>0)"]);
		await run(env.CC??"cc",["-std=gnu11","-O1","-g0","-shared","-Wall","-Wextra","-Werror","-Wno-unused-function",...cfg.flags,"-I"+cfg.inc,"-I"+join(env.LEAN_BRIDGE_LEAN_PREFIX,"include"),"-I"+join(source.installed,"include"),"-I"+work,"Probe.c","-L"+source.lib,"-Wl,--no-as-needed","-l:"+adapter.library,"-llean_bridge_native","-l:libgmp.so.10","-Wl,-rpath,"+source.lib,"-o",join(out,"TariffQuotes.so")]);
		const result=await runPerlIncoming(work,perl,{PERL5LIB: work,PATH: "/unavailable",LEAN_NUM_THREADS: "1"},application);
		if(application)reports.push({abi: version,arch: cfg.arch,...result,xsSha256: sha256(await readFile(join(work,"Probe.xs"))),compiledSha256: sha256(await readFile(join(out,"TariffQuotes.so")))});
		versions.push(cfg.v+"-"+cfg.arch);t.diagnostic(JSON.stringify({route,origin: source.origin,perl: cfg.v,arch: cfg.arch,...result}));
	}
	assert.equal(new Set(versions).size,abi?1:4);
	if(application)assert.deepEqual(reports.map(r=>r.abi).sort(),abi?[abi]:["5.36.3-threaded","5.36.3-unthreaded","5.38.2-threaded","5.38.2-unthreaded"]);
	if(application&&env.LEAN_BRIDGE_FRAME_APPLICATION_OUTPUT)
	{
		const {archiveSha256,receiptSha256}=source;
		await saveLakeFile(env.LEAN_BRIDGE_FRAME_APPLICATION_OUTPUT,route+(abi?"."+abi:"")+".json",canonicalJson({route,archiveSha256,receiptSha256,reports,componentSha256: source.component.nativeLibrary.sha256}));
	}
});
