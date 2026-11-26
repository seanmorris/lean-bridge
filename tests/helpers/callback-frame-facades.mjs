/** @file Replay public facade semantics against the same independently compiled Lean Tariff component. */
import assert from "node:assert/strict";
import {copyFile, mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import test from "node:test";
import {generateOwnedCPackage} from "../../src/backends/c/owned-package.mjs";
import {generateOwnedCppPackage} from "../../src/backends/cpp/owned-package.mjs";
import {nativeCallbackHeader} from "../../src/backends/native/callback-broker.mjs";
import {linuxBrokerHeader} from "../../src/backends/native/runtime-broker.mjs";
import {generateOwnedPythonConversions} from "../../src/backends/python/owned-conversions.mjs";
import {ownedPythonRuntime} from "../../src/backends/python/owned-runtime.mjs";
import {generateOwnedRubyConversions} from "../../src/backends/ruby/owned-conversions.mjs";
import {ownedRubyRuntime} from "../../src/backends/ruby/owned-runtime.mjs";
import {generateOwnedRustCallables} from "../../src/backends/rust/owned-callables.mjs";
import {frameReplaySource} from "./callback-frame-source.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runNativeTool} from "./native-effect-consumers.mjs";

const env = process.env, fixtures = resolve("tests/fixtures/structured-types");
const direct=env.LEAN_BRIDGE_FRAME_DIRECT==="1";
const client = language => join(fixtures, (direct?"tariff-incoming.":"tariff-frame-identity.") + language);

// This is an adapter replay. It tests current facades against an original
// component, not independently published downstream package formats.
for(const route of env.LEAN_BRIDGE_FRAME_NATIVE_STAGE?["ordinary"]:["ordinary", "reviewed"]) test(route + " callback views compare by identity without extending their lifetimes", {timeout: 1_200_000}, async t => {
	assert.ok(env.LEAN_BRIDGE_LEAN_PREFIX,"Set the pinned Lean prefix (headers only)");
	const work = await mkdtemp(join(tmpdir(), "frame-facades-")); t.after(()=>rm(work,{recursive: true,force: true}));
	const run = (cmd,args,environment = env) => runNativeTool(cmd,args,work,environment);
	const {model,component,metadata,installed,lib,origin}=await frameReplaySource({env,route,work,run,direct});
	const {bindingIr: ir} = model;
	const c = generateOwnedCPackage({metadata, sourceIdentity: model.sourceIdentity, component: model.component, hostCallbacks: true});
	assert.ok(c.values.callbackArgumentViews && !c.values.anchoredResults);
	const cpp = generateOwnedCppPackage(ir), py = generateOwnedPythonConversions(ir);
	const ruby = generateOwnedRubyConversions(ir), rust = generateOwnedRustCallables(ir);
	const sources = {...c.files, ...cpp.files
		, "src/tariff_quotes.c": c.source + ruby.cSource
		, "internal/lean_bridge_native_runtime.h": linuxBrokerHeader.replace("#ifdef __cplusplus\n}",nativeCallbackHeader+"\n#ifdef __cplusplus\n}")
		, [py.packageDir+"/__init__.py"]: py.valuesSource
		, [py.packageDir+"/_owned.py"]: ownedPythonRuntime(c.values.prefix)
		, [py.packageDir+"/_native.py"]: py.source
		, "lib.rs": rust.apiSource+"\nmod owned_values;\n"
		, "owned_values.rs": rust.source
		, "runtime.rb": "module LeanBridge\nmodule "+ruby.componentName+"\n"+ownedRubyRuntime(c.values.prefix)+"\nend\nend\n"
		, "values.rb": ruby.valuesSource, "native.rb": ruby.source};
	for(const [path,source] of Object.entries(sources)) await saveLakeFile(work,path,source);
	const library = join(work,"libtariff_quotes.so"), nativeFlags = ["-L"+work,"-L"+lib,"-Wl,-rpath-link,"+lib,"-ltariff_quotes"];
	const isolated = {PATH: "/no-build-tools",LD_LIBRARY_PATH: work+":"+lib};
	const cflags = ["-std=c11", "-O1", "-g0", "-Wall", "-Wextra", "-Werror"
		, "-fPIC", "-shared", "-Iinclude", "-Iinternal"
		, "-I"+join(installed,"include")
		, "-I"+join(env.LEAN_BRIDGE_LEAN_PREFIX,"include")
		, "src/tariff_quotes.c"
		, "-L"+lib
		, "-Wl,--no-as-needed", "-l:"+component.library
		, "-llean_bridge_native"
		, "-lleanshared"
		, "-l:libgmp.so.10"
		, "-Wl,-z,defs,-z,nodelete"
		, "-Wl,-soname,libtariff_quotes.so"
		, "-o"
		, library];
	await run(env.CC??"cc",cflags);
	await t.test("C callback frames leave only the session alive",async()=>{
		const flags=["-std=c11", "-Wall", "-Wextra", "-Werror", "-Iinclude"
			, ...direct?["-DTARIFF_PROBE_CLIENT=tariff_incoming_consumer",client("c")]:["-DTARIFF_LIFETIME_PROBE",join(fixtures,"tariff-exchange.c")]
			, join(fixtures,"tariff-exchange-probe.c"), ...nativeFlags
			, "-ldl", "-o", "c-client"];
		await run(env.CC??"cc",flags);
		const observed=await run(join(work,"c-client"),[],isolated);
		assert.equal(observed.split("\n").at(-1),"identities:1,1,1,1,1,1,0");
	});
	await t.test("C++20",async()=>{
		const values = join(fixtures,direct?"tariff-cpp-probe.cpp":"tariff-values-identity.cpp");
		await run(env.CXX??"c++",["-std=c++20","-Wall","-Wextra","-Werror","-DTARIFF_SEPARATE_VALUES_CLIENT","-Iinclude",client("cpp"),values,...nativeFlags,"-ldl","-o","cpp-client"]);
		await run(join(work,"cpp-client"),[],isolated);
	});
	await t.test("Python",async()=>{
		const boot = "import sys,ctypes,runpy; sys.path.insert(0,sys.argv[1]); from "+py.packageDir+" import _owned,_native; "
			+"lib=ctypes.CDLL(sys.argv[2]); rt=_owned._OwnedRuntime(lib); _native._bind(rt); "
			+(direct?"runpy.run_path(sys.argv[4])['observe'](sys.argv[3],rt,lib)":"runpy.run_path(sys.argv[3],run_name='__main__')");
		const result=await run(env.LEAN_BRIDGE_FRAME_PYTHON??"/usr/bin/python3",["-I","-B","-c",boot,work,library,client("py"),join(fixtures,"tariff-incoming-observer.py")],isolated);
		if(direct) assert.deepEqual(JSON.parse(result),[1,1,1,1,1,1,0]);
	});
	await t.test("Rust",async()=>{
		const rustc = env.LEAN_BRIDGE_RUSTC??"rustc", opts=["--edition=2021","-C","codegen-units=1"];
		await run(rustc,[...opts,"--crate-name","tariff_quotes","--crate-type","rlib","lib.rs","-o","libtariff_quotes.rlib"]);
		const flags = ["--extern", "tariff_quotes=libtariff_quotes.rlib"
			, "-L", "native="+work, "-L", "native="+lib
			, "-C", "link-arg=-Wl,-rpath-link,"+lib
			, "-l", "dylib=tariff_quotes"];
		await run(rustc,[...opts,client("rs"),...flags,"-o","rust-client"]);
		await run(join(work,"rust-client"),[],isolated);
		if(direct)
		{
			await copyFile(client("rs"),join(work,"consumer.rs"));
			await copyFile(join(fixtures,"tariff-incoming-observer.rs"),join(work,"observer.rs"));
			await run(rustc,[...opts,"observer.rs",...flags,"-o","rust-observer"]);
			const output=await run(join(work,"rust-observer"),[],isolated);
			assert.match(output,/^held:[1-9]\d*\nidentities:0,0,0,0,0,0,0$/u);
		}
	});
	await t.test("Ruby",async()=>{
		const boot = "api=LeanBridge::"+ruby.componentName+"; native=api.const_get(:Native,false); owned=api.const_get(:Owned,false); "
			+"lib=Fiddle.dlopen(ARGV.fetch(0));rt=owned::Runtime.new(lib);native.bind(rt);"
			+(direct?"load ARGV.fetch(2);DirectQuoteObserver.observe(ARGV.fetch(1),rt,lib)":"load ARGV.fetch(1)");
		const result=await run(env.LEAN_BRIDGE_RUBY??"/usr/bin/ruby",["--disable-gems","-I",work,"-rruntime","-rvalues","-rnative","-e",boot,library,client("rb"),join(fixtures,"tariff-incoming-observer.rb")],isolated);
		if(direct) assert.deepEqual(JSON.parse(result),[1,1,1,1,1,1,0]);
	});
	t.diagnostic("Compiled Lean component from "+origin);
});
