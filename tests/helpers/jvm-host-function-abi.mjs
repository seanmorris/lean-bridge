/** @file Check the JNI function provider against real elaborated Lean C prototypes. */
import assert from "node:assert/strict";
import {copyFile,mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {generateJvmHostExports} from "../../src/backends/jvm/host-exports.mjs";
import {generateJvmHostApi} from "../../src/backends/jvm/host-api.mjs";
import {generateJvmHostMembers} from "../../src/backends/jvm/host-members.mjs";
import {generateLeanHostObjectAdapters} from "../../src/backends/lean/host-object.mjs";
import {linuxBrokerHeader} from "../../src/backends/native/runtime-broker.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

test("returned JNI applications use the compiler's actual closure, host object and scalar ABI",async t=>{
	const root=await mkdtemp(join(tmpdir(),"jvm-returned-abi-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const lean=resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX??".toolchains/elan/toolchains/leanprover--lean4---v4.32.2"),jdk=process.env.JAVA_HOME;
	assert.ok(jdk,"Set JAVA_HOME to the JDK with JNI headers");
	const ir=JSON.parse(await readFile("tests/fixtures/ruby-host-meter/lean-bridge.hosts.json"));ir.types[0].host.targets=["jvm"];
	const primitive=name=>({kind: "primitive",name}),box={kind: "named",id: ir.types[0].id},u32=primitive("uint32"),str=primitive("string");
	const factory=(name,params,argument,reply)=>({name,declaration: "Closures."+name,effect: "IO",parameters: params.map(type=>({name: "captured",type})),result: {kind: "io-closure",argument,reply}});
	const entries=[factory("remember",[box],box,box),factory("reader",[box],u32,u32),factory("identityReader",[box],u32,box),factory("fileReader",[],str,str)];
	const unit=primitive("unit");entries.push(factory("supplier",[box],unit,box),factory("consumer",[box],u32,unit),factory("action",[box],unit,unit));
	const output=await generateJvmHostExports({ir,entries,modules: ["Closures"],identity: "b".repeat(64)});
	const generated=generateLeanHostObjectAdapters(ir),host="LeanBridge/Host/Jvm";
	await mkdir(join(root,"LeanBridge/Host"),{recursive: true});await writeFile(join(root,host+".lean"),generated[host+".lean"]);
	const source=await readFile("tests/fixtures/c-host-closures/Closures.lean","utf8"),extra=await readFile("tests/fixtures/jvm-host-closures/functions.lean.inc","utf8");
	await writeFile(join(root,"Closures.lean"),source.replaceAll("LeanBridge.Host.C","LeanBridge.Host.Jvm")+extra);
	await writeFile(join(root,"BridgeJvmExports.lean"),output.entryLean);await writeFile(join(root,"entry-abi.h"),output.header);
	await writeFile(join(root,"provider.c"),output.source);await writeFile(join(root,"lean_bridge_native_runtime.h"),linuxBrokerHeader);
	const env={...process.env,LEAN_NUM_THREADS: "1",LEAN_PATH: root,LEAN_SRC_PATH: root,LEAN_SYSROOT: lean};
	for(const m of [host,"Closures","BridgeJvmExports"])
		await run(join(lean,"bin/lean"),["-j1","-R",root,"-o",m+".olean","-c",m+".c",m+".lean"],root,env);
	await writeFile(join(root,"checked.c"),'#include "BridgeJvmExports.c"\n#include "entry-abi.h"\n');
	await run(env.CC??"cc",["-std=gnu11","-fsyntax-only","-Werror=incompatible-pointer-types","-Werror=implicit-function-declaration","-I"+join(lean,"include"),"-I"+join(jdk,"include"),"-I"+join(jdk,"include/linux"),"-I"+resolve("src/backends/jvm"),"-DLB_JVM_OWNER_PREFIX=check_owner_","-DLB_JVM_DOMAIN_PREFIX=check_domain_","provider.c","checked.c"],root,env);
});

test("managed function publication rolls back if JNI cannot transfer the result",async t=>{
	const root=await mkdtemp(join(tmpdir(),"jvm-factory-rollback-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const ir=JSON.parse(await readFile("tests/fixtures/ruby-host-meter/lean-bridge.hosts.json"));ir.types[0].host.targets=["jvm"];
	const box={kind: "named",id: ir.types[0].id},model=await generateJvmHostMembers(ir),hash="c".repeat(64);
	const entry={name: "remember",declaration: "Test.remember",effect: "IO",parameters: [{name: "captured",type: box}],result: {kind: "io-closure",argument: box,reply: box}};
	const {files}=generateJvmHostApi({api: {component: {name: "audit"}},entries: [entry],model,ir,evidence: null,veneer: {name: "liblb_jni_"+hash+".so",sha256: hash}});
	const sources=[];
	for(const [path,src] of Object.entries(files)) if(path.endsWith(".java") && !/\/(?:NativeAssets|NativePort)\.java$/u.test(path))
	{
		const name=path.split("/").at(-1);sources.push(name);await writeFile(join(root,name),src);
	}
	await copyFile("tests/fixtures/jvm-host-closures/Rollback.java",join(root,"Rollback.java"));
	const bin=n=>join(process.env.JAVA_HOME,"bin",n);
	await run(bin("javac"),["--release","22","-Xlint:unchecked","-Werror","-d",root,...sources,"Rollback.java"],root,process.env);
	assert.equal(await run(bin("java"),["-XX:ActiveProcessorCount=1","-Xmx64m","-cp",root,"org.leanbridge.audit.Rollback"],root,process.env),"rollback passed");
});
