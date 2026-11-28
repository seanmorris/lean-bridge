/** @file Exercise returned functions from actual offline Maven installations. */
import assert from "node:assert/strict";
import {access,appendFile,cp,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {basename,delimiter,dirname,join,relative,resolve} from "node:path";
import test from "node:test";
import {sha256} from "../../src/capsule/node.mjs";
import {checkHostFunctionReleases} from "./host-function-releases.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

test("installed Java and Kotlin callers keep and revoke returned Lean functions",{timeout: 3600000},async t=>{
	const env=process.env,java=env.LEAN_BRIDGE_JAVA??"java",sdk=env.LEAN_BRIDGE_KOTLIN_HOME,fixture=resolve("tests/fixtures/jvm-host-closures");
	const addFunctions=async src=>{
		await appendFile(join(src,"Closures.lean"),await readFile(join(fixture,"functions.lean.inc")));
		return ["Closures.supplier","Closures.consumer","Closures.action"];
	};
	const addWorkers=async(src,cfg)=>{
		await appendFile(join(src,"Closures.lean"),'\nnamespace Closures\nopen LeanBridge.Host.Jvm\ndef relay (x : Box) (f : Box → IO Box) : BaseIO (Task (Except IO.Error Box)) := IO.asTask (f x)\nend Closures\n');
		cfg.exports.push("Closures.relay");cfg.taskExports.push("Closures.relay");cfg.taskIOErrors=["Closures.relay"];
	};
	const consume=async({root,out,worker,receipt,route})=>{
		const stage=await mkdtemp(join(root,"install-")),repo=join(stage,"repo"),dest=join(stage,"moved"),classes=join(stage,"classes");
		try
		{
			const [pkg]=receipt.packages;assert.equal(pkg.name,"org.leanbridge:workshop");
			const file=ext=>join(out,pkg.artifacts.find(a=>a.path.endsWith(ext)).path);
			await cp(env.LEAN_BRIDGE_JVM_IO_M2_SEED,repo,{recursive: true});
			await assert.rejects(access(join(repo,"org/leanbridge/workshop")),{code: "ENOENT"});
			await writeFile(join(stage,"pom.xml"),'<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>app</groupId><artifactId>client</artifactId><version>1</version><dependencies><dependency><groupId>org.leanbridge</groupId><artifactId>workshop</artifactId><version>1.0.0</version></dependency></dependencies></project>');
			const mvn=(...args)=>run(env.LEAN_BRIDGE_MAVEN??"mvn",["--offline","--batch-mode","--quiet","--no-transfer-progress","-s",resolve("tests/fixtures/jvm-sync-io/settings.xml"),"-Dmaven.repo.local="+repo,...args],stage,env);
			await mvn("org.apache.maven.plugins:maven-install-plugin:3.1.4:install-file","-Dfile="+file(".jar"),"-DpomFile="+file(".pom"));
			await mvn("org.apache.maven.plugins:maven-dependency-plugin:3.8.1:build-classpath","-Dmdep.outputFile=paths");
			const paths=(await readFile(join(stage,"paths"),"utf8")).trim().split(delimiter).map(p=>relative(repo,p));
			assert.ok(paths.every(p=>!p.startsWith("..") && p.endsWith(".jar")));await rename(repo,dest);
			const jars=paths.map(p=>join(dest,p)),lib=jars.find(p=>p.endsWith("/workshop-1.0.0.jar"));assert.ok(lib);
			for(const a of pkg.artifacts)assert.equal(sha256(await readFile(join(dirname(lib),basename(a.path)))),a.sha256);
			await rm(out,{recursive: true});await mkdir(classes);const path=[classes,...jars].join(delimiter);
			const javaFiles=["Installed.java",...worker?["Worker.java"]:[]].map(f=>join(fixture,f));
			await run(env.LEAN_BRIDGE_JAVAC??"javac",["--release","22","-proc:none","-Xlint:unchecked","-Werror","-cp",path,"-d",classes,...javaFiles],stage,env);
			await run(java,["-XX:ActiveProcessorCount=1","-Xmx384m","-cp",join(sdk,"lib/*"),"org.jetbrains.kotlin.cli.jvm.K2JVMCompiler","-kotlin-home",sdk,"-jdk-home",env.JAVA_HOME,"-no-stdlib","-no-reflect","-Werror","-jvm-target","22","-classpath",path,"-d",classes,join(fixture,"Installed.kt"),...worker?[join(fixture,"Worker.kt")]:[]],stage,env);
			for(const [main,mode] of [["Installed","normal"],["Installed","retire"],["InstalledKt","normal"],...worker?[["Worker","normal"],["WorkerKt","normal"]]:[]])
			{
				const app=await mkdtemp(join(stage,"fresh-"));
				try
				{
					const line=await run(java,["-XX:ActiveProcessorCount=1","-Xmx128m","-Xcheck:jni","--enable-native-access=ALL-UNNAMED","-Djava.io.tmpdir="+app,"-cp",path,main,mode],app,{PATH: "/no-tools",LANG: "C.UTF-8",LEAN_NUM_THREADS: "1"},120000);
					assert.equal(line,"ok "+main+" "+mode);t.diagnostic(route+": "+line);
				} finally
				{await rm(app,{recursive: true});}
			}
		} finally
		{await rm(stage,{recursive: true,force: true});}
	};
	await checkHostFunctionReleases(t,{backend: "jvm",module: "Jvm"
		, target: "maven",error: "error:JvmHostException"
		, profiles: ["native-jvm-io-v1","native-jvm-task-v1"]
		, archives: 2,addFunctions,addWorkers,consume});
});
