/** @file Relocate both Maven authoring routes and run independent Java and Kotlin callbacks. */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createReadStream} from "node:fs";
import {access,copyFile,mkdir,mkdtemp,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename,delimiter,join,resolve} from "node:path";
import test from "node:test";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {buildNativeBudget,nativeBudgetReview} from "./native-budget-handoff.mjs";
import {installMavenTasks} from "./jvm-maven-installed.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {copyPackageSetHandoff} from "./package-set.mjs";

const digest=async p=>{
	const h=createHash("sha256");for await(const bytes of createReadStream(p)) h.update(bytes);return h.digest("hex");
};
const clients={Java: "JavaBudget",Kotlin: "KotlinBudgetKt"};
const observation="16 worker races; original, factory, terminal and typed failures distinct; capture released; zero leases";
test("relocated Maven workers enforce parameter admission in Java futures and Kotlin suspend calls",{timeout: 7200000},async t=>{
	const env=process.env,jdk=env.JAVA_HOME,kotlin=env.LEAN_BRIDGE_KOTLIN_HOME;
	assert.ok(jdk && kotlin && env.LEAN_BRIDGE_JVM_TASK_M2_SEED,"set JDK 22, Kotlin 2.2.0 and the offline Maven task prerequisite seed");
	const work=await mkdtemp(join(tmpdir(),"jvm-budget-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const keep=env.LEAN_BRIDGE_JVM_BUDGET_KEEP,replay=env.LEAN_BRIDGE_JVM_BUDGET_REPLAY;assert.ok(!(keep && replay));
	const sets=replay?resolve(replay):await mkdtemp(join(keep??work,"handoffs-"));
	const out=resolve(env.LEAN_BRIDGE_JVM_BUDGET_OUTPUT??"build/jvm-budget");await mkdir(out,{recursive: true});
	const upstream=resolve("tests/fixtures/jvm-tasks"),fixture=resolve("tests/fixtures/native-callback-budget");
	await copyFile(resolve("tests/fixtures/jvm-sync-io/settings.xml"),join(work,"settings.xml"));
	const jre=join(work,"jre"),java=join(jre,"bin/java"),clean={PATH: "/unavailable",LANG: "C.UTF-8",LEAN_NUM_THREADS: "4"};
	await run(join(jdk,"bin/jlink"),["--module-path",join(jdk,"jmods"),"--add-modules","java.base","--no-header-files","--no-man-pages","--output",jre],work,env);
	const modules=await run(java,["--list-modules"],work,clean);assert.match(modules,/^java\.base@22(?:[.][\w.+-]+)?$/u);
	await assert.rejects(access(join(jre,"bin/javac")),{code: "ENOENT"});
	let ordinary,first,shared;
	for(const route of ["ordinary","reviewed"])
	{
		const set=join(sets,route),hand=join(work,route+"-input"),project=join(work,route+"-project"),app=join(work,route+"-deployment");
		if(!replay) await buildNativeBudget({work,set,target: "maven",route,ordinary});
		await copyPackageSetHandoff(set,hand);
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(hand,"package-set-receipt.json")});
		assert.deepEqual(result.profiles,["native-jvm-task-v1"]);assert.equal(receipt.packages.length,1);
		const [pkg]=receipt.packages;assert.equal(pkg.name,"org.leanbridge:callback-budget");assert.equal(pkg.version,"1.0.0");
		assert.equal(pkg.target,"maven");assert.equal(pkg.artifacts.length,2);assert.equal(pkg.runtimeDelivery,"embedded");
		const paths=[".jar",".pom"].map(s=>join(hand,pkg.artifacts.find(a=>a.path.endsWith(s)).path));
		const detail=JSON.parse(await run(env.LEAN_BRIDGE_PYTHON??"python3",[join(upstream,"verify.py"),...paths],work,env));
		const {classpath}=await installMavenTasks(project,work,[{proof: {name: pkg.name,artifacts: pkg.artifacts,detail},paths,version: pkg.version}],env);
		const jars=classpath.split(delimiter),jar=jars.find(p=>basename(p)===basename(paths[0]));assert.ok(jar);
		const json=async key=>JSON.parse(await run("unzip",["-p",jar,"META-INF/lean-bridge/"+key+".json"],work,env));
		const api=await json("binding-ir"),proof=await json("elaboration");
		assert.equal(detail.bindingIrSha256,hashBindingIr(api));assert.equal(receipt.profiles[0].bindingIrSha256,detail.bindingIrSha256);
		assert.equal(detail.runtimeIdentity,pkg.runtimeIdentity);assert.equal(proof.sourceTreeSha256,receipt.source.treeSha256);
		for(const d of api.declarations) for(const p of d.parameters.slice(1))
		{
			const cb=api.types.find(x=>x.id===p.type.id);assert.equal(cb.source.extensions["lean-bridge.dev/callback-scheduler"],"jvm-virtual-thread");
			assert.equal(cb.callable.invocation,d.source.declaration==="Budget.probe" && p.name==="g"?"many":"once");
		}
		const runtimeLibraries={};
		for(const file of ["libleanshared.so","liblean_bridge_native.so",detail.owner.library]) runtimeLibraries[file]=detail.libraries[file];
		assert.ok(Object.values(runtimeLibraries).every(v=>/^[a-f0-9]{64}$/u.test(v)));
		const archive=pkg.artifacts.find(a=>a.path.endsWith(".jar"));
		if(route==="ordinary")
		{
			ordinary=api;shared=runtimeLibraries;first=archive.sha256;assert.equal(proof.reviewedSourceSha256,null);
		}
		else
		{
			assert.equal(proof.reviewedSourceSha256,sha256(canonicalJson(api)));assert.equal(api.documentation.summary,nativeBudgetReview);
			assert.deepEqual(runtimeLibraries,shared);assert.notEqual(first,archive.sha256);
		}
		const classes=join(project,"classes");await mkdir(classes);
		const sources={};for(const f of ["Observe.java","JavaBudget.java","KotlinBudget.kt"])
		{
			const copy=join(project,f);await copyFile(join(f==="Observe.java"?upstream:fixture,f),copy);sources[f]=await digest(copy);
		}
		await run(join(jdk,"bin/javac"),["--release","22","-proc:none","-Werror","-cp",classpath,"-d",classes,"Observe.java","JavaBudget.java"],project,env);
		const kotlinc=[
			"-XX:ActiveProcessorCount=1", "-Xmx384m", "-cp", join(kotlin,"lib/*")
			, "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler"
			, "-kotlin-home", kotlin, "-jdk-home", jdk
			, "-no-stdlib", "-no-reflect", "-Werror", "-jvm-target", "22"
			, "-classpath", classes+delimiter+classpath, "-d", classes, "KotlinBudget.kt"
		];
		await run(join(jdk,"bin/java"),kotlinc,project,env);
		await mkdir(app);await rename(classes,join(app,"classes"));
		const deployed={};for(const p of jars)
		{
			const n=basename(p);assert.ok(!Object.hasOwn(deployed,n));await copyFile(p,join(app,n));deployed[n]=await digest(join(app,n));
		}
		assert.equal(deployed[basename(jar)],archive.sha256);await rm(project,{recursive: true});await rm(hand,{recursive: true});
		const results={},executables={};
		for(const [language,main] of Object.entries(clients))
		{
			executables[language]=await digest(join(app,"classes",main+".class"));const scratch=await mkdtemp(join(app,"scratch-"));
			results[language]=await run(java,["--enable-native-access=ALL-UNNAMED","-Xcheck:jni","-XX:ActiveProcessorCount=1","-Xmx192m","-Djava.io.tmpdir="+scratch,"-cp",["classes",...Object.keys(deployed)].join(delimiter),main],app,{...clean,TMPDIR: scratch});
			assert.equal(results[language],language+": "+observation);
		}
		const row={
			route
			, artifacts: pkg.artifacts
			, modules, runtimeLibraries, sources, executables, deployed, results
			, receiptSha256: result.receiptSha256
			, runtimeIdentity: pkg.runtimeIdentity
			, bindingIrSha256: detail.bindingIrSha256
			, sourceTreeSha256: proof.sourceTreeSha256
			, reviewedSourceSha256: proof.reviewedSourceSha256};
		await writeFile(join(out,route+".json"),canonicalJson(row));await rm(app,{recursive: true});
	}
	t.diagnostic("Handoffs: "+sets);
});
