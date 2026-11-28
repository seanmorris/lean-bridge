/** @file Call the actual JVM worker kernel through JNI from a virtual thread. */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import { inspectLeanProject } from "../../src/analyze/lean-project.mjs";
import { elaboratedComponent } from "../../src/analyze/semantic-model.mjs";
import { generateJvmHostExports } from "../../src/backends/jvm/host-exports.mjs";
import { jvmHostTaskRuntime } from "../../src/backends/jvm/host-task-runtime.mjs";
import { jvmHostWorkerApi } from "../../src/backends/jvm/host-worker-api.mjs";
import { resolveJvmTool } from "../../src/build/compile-jvm-sources.mjs";
import { compileHostSources } from "../../src/build/host-elaboration.mjs";
import { openHostProjectSource } from "../../src/build/host-project-source.mjs";
import { jvmHostTaskKernel, stageJvmHostTasks } from "../../src/build/jvm-host-task-kernel.mjs";
import { compileJvmHostDomain, compileJvmIOOwner } from "../../src/build/jvm-io-owner.mjs";
import { readVerifiedNativeRuntime } from "../../src/build/native-artifacts.mjs";
import { buildNativeSharedRuntime } from "../../src/build/native-component.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { prepareJvmWorkerProject } from "./jvm-worker-project.mjs";

test("virtual-thread JNI operations transfer JVM objects across the compiled Lean worker boundary", { timeout: 600000 }, async t => {
	const root=await mkdtemp(join(tmpdir(),"jvm-worker-jni-"));
	t.after(()=>rm(root,{recursive: true,force: true}));
	const project=join(root,"project"), app=join(root,"app"), runtimeRoot=join(root,"sdk");
	const cfg=await prepareJvmWorkerProject(project); await mkdir(app);
	const leanPrefix=resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX??".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const cc=process.env.CC??"cc", fixture=resolve("tests/fixtures/jvm-host-workers");
	const run=async (command,args,cwd=app,env=process.env)=>{
		try
		{ return await processBuildRunner.capture({command,args,cwd,env}); }
		catch(e)
		{ throw new Error([e.message,e.details?.stderr,e.details?.stdout].filter(Boolean).join("\n"),{cause: e}); }
	};
	const save=(f,b)=>writeFile(join(app,f),b,{flag: "wx"});
	await buildNativeSharedRuntime({outputRoot: runtimeRoot,leanPrefix,cc});
	const {identity: runtimeIdentity}=await readVerifiedNativeRuntime(runtimeRoot);
	const javac=await resolveJvmTool(process.env.LEAN_BRIDGE_JAVAC??"javac",process.env,app), javaHome=dirname(dirname(javac));
	const tools={app,runtimeRoot,runtimeIdentity,cc,leanPrefix,javaHome,run};
	const owner=await compileJvmIOOwner(tools), domain=await compileJvmHostDomain({...tools,owner});
	const inventory=await inspectLeanProject(project), component=elaboratedComponent(inventory.project);
	const source=await openHostProjectSource({project,inventory,component,targets: ["maven"],leanPrefix});
	try
	{
		const {ir}=source.projectContract, checked=await compileHostSources({...source,app,ir,run,target: "maven",environment: process.env});
		const kernel=await jvmHostTaskKernel({checked,ir,modules: cfg.modules,name: cfg.targets.maven.name,runtimeIdentity,owner});
		const identity=sha256(canonicalJson(kernel.fingerprint));
		const gen=await generateJvmHostExports({identity,ir,entries: checked.entries.filter(e=>!e.delivery),modules: cfg.modules,workerWire: kernel.wire});
		const units=await stageJvmHostTasks({...tools,identity,kernel,save,env: checked.env});
		const evidence={ledgerId: kernel.ledger.id,libraries: {[kernel.ledger.name]: sha256(await readFile(join(app,kernel.ledger.name)))}};
		const render=api=>jvmHostWorkerApi({api,ir,ns: "probe",wire: kernel.wire,evidence,names: new Set(),errorClass: ()=>{}});
		const publicMethods=render(checked.api);
		assert.ok(publicMethods.direct.some(s=>s.includes(" scalar(")));
		assert.ok(publicMethods.ktBound.some(s=>s.includes("Flow<T0>")));
		const wrong=structuredClone(checked.api), refuse=wrong.declarations.find(d=>d.source.declaration==="Jobs.refuse");
		refuse.source.extensions["lean-bridge.dev/error-payload-site"].ownership="copy";
		assert.throws(()=>render(wrong),/worker ownership/u);
		const wrongCallback=structuredClone(checked.api), callback=wrongCallback.types.find(t=>t.kind==="callback");
		callback.source.extensions["lean-bridge.dev/callback-scheduler"]="owner-event-loop";
		assert.throws(()=>render(wrongCallback),/retained callback/u);
		await save("BridgeJvmExports.lean",gen.entryLean); await save("entry-abi.h",gen.header); await save("provider.c",gen.source);
		await copyFile(resolve("src/backends/jvm/host-wire.h"),join(app,"host-wire.h"));
		await run(join(leanPrefix,"bin/lean"),["-j1","-c","entry.c","BridgeJvmExports.lean"],app,checked.env);
		for(const [i,f] of [...checked.objects,"entry.c"].entries())
		{
			const unit="checked-"+i+".c"; await save(unit,'#include "'+f+'"\n#include "entry-abi.h"\n'); units.push(unit);
		}
		await save("probe-abi.h",`#define TEST_BIND ${gen.prefix}_call
#define TEST_WORK ${gen.prefix}_work
#define TEST_TASK ${kernel.port.task}
#define TEST_INVOKE ${kernel.port.invoke}
extern jobject TEST_BIND(JNIEnv *,jobject,jint,jobjectArray);
extern jobject TEST_WORK(JNIEnv *,jobject,jobjectArray,jint,jint,jobject,jobject,jobject,jobject,jobject);
extern int TEST_TASK(int,int,const uint64_t *,uint64_t *,uint64_t *,uint8_t *,int *);
extern int TEST_INVOKE(int,const uint64_t *,uint64_t *,uint8_t *);
`);
		await run(cc,["-std=gnu11","-O1","-g0","-shared","-fPIC"
			, "-fvisibility=hidden","-Werror=incompatible-pointer-types"
			, "-Werror=implicit-function-declaration","-pthread","-I."
			, "-I"+join(runtimeRoot,"include"),...domain.includes
			, owner.flag,domain.flag,kernel.ledger.flag,...units
			, "provider.c","host-frame.c",join(fixture,"probe-jni.c")
			, "-L.","-l:"+domain.name,"-l:"+owner.name,"-l:"+kernel.ledger.name
			, "-L"+join(runtimeRoot,"lib"),"-lleanshared","-llean_bridge_native"
			, "-Wl,-z,defs,-z,nodelete","-Wl,-rpath,$ORIGIN","-o","libprobe.so"]);
		const pkg="package probe;\n";
		const delivery=await jvmHostTaskRuntime({wire: kernel.wire,ns: "probe",options: kernel.port}), shared=[];
		for(const [path,src] of Object.entries(delivery)) if(path.endsWith(".java"))
		{ const name=basename(path); shared.push(name); await save(name,src); }
		await save("Unit.java",pkg+"enum Unit { INSTANCE }");
		await save("NativeAssets.java",pkg+"final class NativeAssets { static java.lang.foreign.SymbolLookup lookup(){return java.lang.foreign.SymbolLookup.loaderLookup();} static void ensureProcess(){} }");
		await save("NativePort.java",pkg+"import java.nio.ByteBuffer;\nfinal class NativePort { static native Object[] invoke(HostMembers p,int op,Object[] args) throws Exception; static native Object work(HostMembers p,Object[] classes,int method,int op,ByteBuffer args,ByteBuffer h,ByteBuffer out,ByteBuffer tags,ByteBuffer ctl); }");
		await save("HostContract.java",pkg+gen.model.contract); await save("HostMembers.java",pkg+gen.model.implementation);
		const syncRead=checked.entries.filter(e=>!e.delivery).findIndex(e=>e.declaration==="Workshop.read"); assert.ok(syncRead>=0);
		await save("Methods.java",pkg+"final class Methods { static final int SYNCREAD="+syncRead+";"+kernel.wire.methods.map((m,i)=>"static final int "+m.name.replaceAll("_","").toUpperCase()+"="+i+";").join("\n")+"}");
		await copyFile(join(fixture,"WorkerProbe.java"),join(app,"WorkerProbe.java"));
		await copyFile(join(fixture,"BoundDeliveryProbe.java"),join(app,"BoundDeliveryProbe.java"));
		await copyFile(join(fixture,"ScopeProbe.java"),join(app,"ScopeProbe.java"));
		const vm=["-XX:ActiveProcessorCount=1","-XX:+UseSerialGC","-Xmx96m"];
		await run(javac,[...vm.map(s=>"-J"+s),"--release","22","-d",".","HostContract.java","HostMembers.java","Methods.java","NativePort.java","NativeAssets.java","Unit.java",...shared,"WorkerProbe.java","BoundDeliveryProbe.java","ScopeProbe.java"]);
		const env={...process.env,LD_LIBRARY_PATH: [app,join(runtimeRoot,"lib")].join(":")};
		const result=await run(join(javaHome,"bin/java"),[...vm,"--enable-native-access=ALL-UNNAMED","-Xcheck:jni","-cp",app,"probe.WorkerProbe",join(app,"libprobe.so")],app,env);
		assert.equal(result.stdout.trim(),"JVM owner round-tripped class workers, callback arguments/replies, typed errors and cursors; zero native identities");
		assert.doesNotMatch(result.stderr,/WARNING in native method/u); t.diagnostic(result.stdout.trim());
	} finally
	{ await source.dispose(); }
});
