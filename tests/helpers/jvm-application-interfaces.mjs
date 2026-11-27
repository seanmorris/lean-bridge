/** @file Type-check the actual Java and Kotlin applications against their own generated ownership APIs. */
import assert from "node:assert/strict";
import {access,copyFile,mkdir,mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename,delimiter,join,resolve} from "node:path";
import test from "node:test";
import {generateOwnedJvmPackage} from "../../src/backends/jvm/owned-package.mjs";
import {leasedClosureFieldReviewedIr} from "./owned-aggregate-fixture.mjs";
import {runNativeTool} from "./native-effect-consumers.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";

test("Java and Kotlin use their public APIs for application functions and direct Ticket exchange",async t=>{
	const jdk=process.env.JAVA_HOME,kotlin=process.env.LEAN_BRIDGE_KOTLIN_HOME;
	assert.ok(jdk&&kotlin,"set JAVA_HOME to JDK 22 and LEAN_BRIDGE_KOTLIN_HOME to the Kotlin 2.2.0 directory containing lib/");
	for(const tool of [join(jdk,"bin/java"),join(jdk,"bin/javac"),join(kotlin,"lib/kotlin-compiler.jar")])await access(tool);
	const root=await mkdtemp(join(tmpdir(),"jvm-application-surface-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const generated=generateOwnedJvmPackage(leasedClosureFieldReviewedIr({staged: true,hostFunctions: true,ticketExchange: true}),null,{hostCallbacks: true});
	const java=[],kt=[];
	for(const [path,bytes] of Object.entries(generated.files))
	{
		if(!path.endsWith(".java")&&!path.endsWith(".kt"))continue;
		await saveLakeFile(root,path,bytes);(path.endsWith(".java")?java:kt).push(path);
	}
	for(const path of ["jvm-tasks/Observe.java","jvm-tariff/Ownership.java","jvm-tariff/JavaApplication.java","jvm-tariff/KotlinApplication.kt"])
	{
		const name=basename(path);await copyFile(resolve("tests/fixtures",path),join(root,name));(name.endsWith(".java")?java:kt).push(name);
	}
	const classes=join(root,"classes");await mkdir(classes);
	const lib=join(kotlin,"lib"),cp=[classes,join(lib,"kotlin-stdlib.jar"),join(lib,"annotations-13.0.jar")].join(delimiter);
	const run=(tool,args)=>runNativeTool(join(jdk,"bin",tool),args,root,process.env);
	// Both facades reference the other language. Resolve Java sources while
	// emitting Kotlin classes, then compile the Java bytecode against them.
	await run("java",["-XX:ActiveProcessorCount=1","-Xmx384m","-cp",join(lib,"*"),"org.jetbrains.kotlin.cli.jvm.K2JVMCompiler","-kotlin-home",kotlin,"-jdk-home",jdk,"-no-stdlib","-no-reflect","-Werror","-jvm-target","22","-classpath",cp,"-d",classes,...kt,...java]);
	await run("javac",["-J-XX:ActiveProcessorCount=1","-J-Xmx192m","--release","22","-proc:none","-Xlint:unchecked","-Werror","-cp",cp,"-d",classes,...java]);
	for(const main of ["JavaApplication","KotlinApplicationKt"])await access(join(classes,main+".class"));
});
