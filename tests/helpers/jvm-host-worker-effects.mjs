/** @file Install a Maven worker package offline and inspect its actual effects from Java and Kotlin. */
import assert from "node:assert/strict";
import {access,cp,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {basename,delimiter,dirname,join,relative,resolve} from "node:path";
import test from "node:test";
import {sha256} from "../../src/capsule/node.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {prepareJvmWorkerProject} from "./jvm-worker-project.mjs";
import {checkHostWorkerEffects} from "./host-worker-effect-handoffs.mjs";

test("installed Java and Kotlin workers honor effect grants through initialization, pull and close",{timeout: 3600000},async t=>{
	const env=process.env,java=env.LEAN_BRIDGE_JAVA??"java",sdk=env.LEAN_BRIDGE_KOTLIN_HOME,src=resolve("tests/fixtures/jvm-host-workers");
	const consume=async(root,dir,receipt)=>{
		const stage=await mkdtemp(join(root,"maven-install-")),repo=join(stage,"repo"),moved=join(stage,"deployed repo"),classes=join(stage,"classes");
		try
		{
			const [pkg]=receipt.packages;assert.equal(pkg.name,"org.leanbridge:workshop");assert.equal(pkg.artifacts.length,2);
			const file=ext=>join(dir,pkg.artifacts.find(a=>a.path.endsWith(ext)).path);
			await cp(env.LEAN_BRIDGE_JVM_IO_M2_SEED,repo,{recursive: true});
			await assert.rejects(access(join(repo,"org/leanbridge/workshop")),{code: "ENOENT"});
			await writeFile(join(stage,"pom.xml"),'<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>app</groupId><artifactId>client</artifactId><version>1</version><dependencies><dependency><groupId>org.leanbridge</groupId><artifactId>workshop</artifactId><version>1.0.0</version></dependency></dependencies></project>');
			const mvn=(...args)=>run(env.LEAN_BRIDGE_MAVEN??"mvn",["--offline","--batch-mode","--quiet","--no-transfer-progress","-s",resolve("tests/fixtures/jvm-sync-io/settings.xml"),"-Dmaven.repo.local="+repo,...args],stage,env);
			await mvn("org.apache.maven.plugins:maven-install-plugin:3.1.4:install-file","-Dfile="+file(".jar"),"-DpomFile="+file(".pom"));
			await mvn("org.apache.maven.plugins:maven-dependency-plugin:3.8.1:build-classpath","-Dmdep.outputFile=resolved.txt");
			const paths=(await readFile(join(stage,"resolved.txt"),"utf8")).trim().split(delimiter).map(p=>relative(repo,p));
			assert.ok(paths.every(p=>!p.startsWith("..") && p.endsWith(".jar")));await rename(repo,moved);
			const jars=paths.map(p=>join(moved,p)),lib=jars.find(p=>p.endsWith("/workshop-1.0.0.jar"));assert.ok(lib);
			for(const a of pkg.artifacts)assert.equal(sha256(await readFile(join(dirname(lib),basename(a.path)))),a.sha256);
			await mkdir(classes);const cpArg=[classes,...jars].join(delimiter);
			await run(env.LEAN_BRIDGE_JAVAC??"javac",["--release","22","-proc:none","-cp",cpArg,"-d",classes,join(src,"EffectClient.java")],stage,env);
			await run(java,["-XX:ActiveProcessorCount=1","-Xmx384m","-cp",join(sdk,"lib/*"),"org.jetbrains.kotlin.cli.jvm.K2JVMCompiler","-kotlin-home",sdk,"-jdk-home",env.JAVA_HOME,"-no-stdlib","-no-reflect","-Werror","-jvm-target","22","-classpath",cpArg,"-d",classes,join(src,"EffectFlow.kt")],stage,env);
			for(const [main,expect] of [["EffectClient","Java future"],["EffectFlowKt","Kotlin suspend"]])
			{
				const app=join(stage,main);await mkdir(app);
				const isolated={PATH: "/no-tools",LANG: "C.UTF-8",LEAN_NUM_THREADS: "1",LEAN_BRIDGE_EFFECT_BOOT: "from-app"};
				const args=["-XX:ActiveProcessorCount=1","-Xmx128m","--enable-native-access=ALL-UNNAMED","-Djava.io.tmpdir="+app,"-cp",cpArg,main];
				assert.ok((await run(java,args,app,isolated,90000)).startsWith(expect));
			}
			return 2;
		}
		finally
		{await rm(stage,{recursive: true,force: true});}
	};
	await checkHostWorkerEffects(t,{target: "maven",profile: "native-jvm-task-v1",prepare: prepareJvmWorkerProject,consume});
});
