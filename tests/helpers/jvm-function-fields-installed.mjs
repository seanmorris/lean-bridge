/** @file Exercise callable fields in independent runtime-only Java and Kotlin applications. */
import assert from "node:assert/strict";
import {access, copyFile, cp, mkdir, mkdtemp, readFile, rename, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename, delimiter, dirname, isAbsolute, join, relative, resolve} from "node:path";
import test from "node:test";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";
import {canonicalJson, sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {copyPackageSetHandoff} from "./package-set.mjs";
import {prepareStagedQuoteProject, checkStagedQuoteIdentities, checkApplicationFunctionPositions, checkTicketExchangePositions} from "./staged-quote-project.mjs";

const fixture = resolve("tests/fixtures/jvm-tariff"), digest = async p => sha256(await readFile(p));
const clients = {java: "JavaTariff", kotlin: "KotlinTariffKt"};
const parse = (stdout,hostInput=false,incoming=false,application=false) => {
	const keys = application ? ["baseline","expired","held","forward","nested","ticket42to43","ticket71to72","afterThreadExit"]
		: incoming ? ["baseline","success","error","held","lease","errorLease","nested","fresh","afterThreadExit"]
			: hostInput ? ["baseline","capture","reentry","expired","error","held","lease","validation","afterThreadExit"]
				: ["baseline","held","retain","echo","repack","expired","closed","afterCallbackFailure","afterThreadExit"];
	const lines = stdout.split("\n");
	let values;
	if(application)
	{
		// These are observed public returns, not ownership counters.
		const [line]=lines.splice(-2,1);
		const match=/^values (\d+) (\d+) (\d+) (\d+) (\d+)$/u.exec(line);assert.ok(match,line);
		const [forwarded,afterFailure,calls,firstTicket,secondTicket]=match.slice(1).map(Number);
		values={forwarded,afterFailure,calls,firstTicket,secondTicket};
		assert.deepEqual(values,{forwarded: 42,afterFailure: 43,calls: 3,firstTicket: 43,secondTicket: 72});
	}
	const entries = lines.map(line => {
		const fields = /^(\w+) (\d+)$/u.exec(line); assert.ok(fields, line);
		return [fields[1], Number(fields[2])];
	});
	assert.deepEqual(entries.map(([k]) => k), keys);
	const counts = Object.fromEntries(entries);
	assert.ok(counts.held > counts.baseline); assert.equal(counts.afterThreadExit, 0);
	for(const k of keys.slice(1,-1).filter(k=>k!=="held")) assert.equal(counts[k],counts.baseline,k);
	return application?{...counts,values}:counts;
};
const pom = '<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>app</groupId><artifactId>tariff-client</artifactId><version>1</version><dependencies><dependency><groupId>org.leanbridge</groupId><artifactId>tariff-quotes</artifactId><version>1.0.0</version></dependency></dependencies></project>';

test("Java and Kotlin clients retain, repack and return functions from installed Maven packages", {timeout: 7_200_000}, async t => {
	const env = process.env, kotlin = env.LEAN_BRIDGE_KOTLIN_HOME, jdk = env.JAVA_HOME, seed = env.LEAN_BRIDGE_JVM_IO_M2_SEED;
	assert.ok(jdk && kotlin && seed, "set JAVA_HOME, LEAN_BRIDGE_KOTLIN_HOME and the offline Maven plugin/stdlib seed LEAN_BRIDGE_JVM_IO_M2_SEED");
	for(const file of [join(jdk,"bin/jlink"),join(kotlin,"lib/kotlin-compiler.jar"),join(seed,"org/jetbrains/kotlin/kotlin-stdlib/2.2.0")]) await access(file);
	const work = await mkdtemp(join(tmpdir(),"jvm-tariff-")); t.after(() => rm(work, {recursive: true,force: true}));
	const application=env.LEAN_BRIDGE_JVM_APPLICATION_FUNCTIONS==="1",prefix=application?"LEAN_BRIDGE_JVM_APPLICATION_":"LEAN_BRIDGE_JVM_TARIFF_";
	const keep=env[prefix+"KEEP"],replay=env[prefix+"REPLAY"];
	const incoming=env.LEAN_BRIDGE_JVM_TARIFF_REQUIRE_INCOMING==="1";
	assert.ok(!(application&&incoming),"select one workload");
	const variant=application?{hostFunctions: true,ticketExchange: true}:{incoming};
	assert.ok(!(keep && replay));
	const set = replay ? resolve(replay) : keep ? await mkdtemp(join(resolve(keep),"tariff-")) : join(work,"handoffs");
	const routes = ["ordinary","reviewed"],pair=[];
	const runtime = join(work,"jre"), java = join(runtime,"bin/java");
	await run(join(jdk,"bin/jlink"),["--module-path",join(jdk,"jmods"),"--add-modules","java.base","--no-header-files","--no-man-pages","--output",runtime],work,env);
	const clean = {PATH: "/no-author-tools", LANG: "C.UTF-8", LEAN_NUM_THREADS: "1"};
	const modules = await run(java,["--list-modules"],work,clean);
	assert.match(modules,/^java\.base@22(?:[.][\w.+-]+)?$/u);
	await assert.rejects(access(join(runtime,"bin/javac")),{code: "ENOENT"});
	const output = resolve(env[prefix+"OUTPUT"] ?? (application?"build/jvm-application-functions":"build/jvm-function-fields"));
	await mkdir(output,{recursive: true});
	for(const route of routes)
	{
		if(!replay)
		{
			const src=join(work,route+"-src"),out=join(work,route+"-out");
			await prepareStagedQuoteProject(src,route,"maven",variant);
			try
			{
				await buildCanonicalProject({projectRoot: src,outputRoot: out
					, targets: ["maven"],environment: env});
			}
			catch(e)
			{
				throw new Error(e.message+"\n"+JSON.stringify(e.details),{cause: e});
			}
			await copyPackageSetHandoff(out,join(set,route));
			await rm(src,{recursive: true});await rm(out,{recursive: true});
		}
		const build = await mkdtemp(join(work,route+"-install-")), repo = join(build,"m2"), handoff = join(build,"handoff");
		await copyPackageSetHandoff(join(set,route),handoff);
		const {receipt,result} = await readVerifiedPackageSetReceipt({receiptPath: join(handoff,"package-set-receipt.json")});
		if(application&&replay&&receipt.packages.length>1)
			assert.deepEqual(receipt.packages.map(p=>p.target).sort(),receipt.packages.length===2?["maven","php-native"]:["maven","nuget","php-native"]);
		else assert.equal(receipt.packages.length,1);
		const pkg = receipt.packages.find(p=>p.target==="maven");assert.ok(pkg);
		assert.equal(pkg.name,"org.leanbridge:tariff-quotes"); assert.equal(pkg.version,"1.0.0");
		assert.equal(pkg.target,"maven");
		const artifact = ext => join(handoff,pkg.artifacts.find(a=>a.path.endsWith(ext)).path);
		await cp(seed,repo,{recursive: true}); await assert.rejects(access(join(repo,"org/leanbridge/tariff-quotes")),{code: "ENOENT"});
		await writeFile(join(build,"pom.xml"),pom);
		const mvn = (...args) => run(env.LEAN_BRIDGE_MAVEN ?? "mvn",["--offline","--batch-mode","--quiet","--no-transfer-progress","-s",resolve("tests/fixtures/jvm-sync-io/settings.xml"),"-Dmaven.repo.local="+repo,...args],build,env);
		await mvn("org.apache.maven.plugins:maven-install-plugin:3.1.4:install-file","-Dfile="+artifact(".jar"),"-DpomFile="+artifact(".pom"));
		await mvn("org.apache.maven.plugins:maven-dependency-plugin:3.8.1:build-classpath","-Dmdep.outputFile=paths");
		const jars = (await readFile(join(build,"paths"),"utf8")).trim().split(delimiter);
		for(const p of jars)
		{
			const rel = relative(repo,p);
			assert.ok(!rel.startsWith("..") && !isAbsolute(rel) && p.endsWith(".jar"));
		}
		const component = jars.find(p=>basename(p)==="tariff-quotes-1.0.0.jar"); assert.ok(component);
		for(const a of pkg.artifacts) assert.equal(await digest(join(dirname(component),basename(a.path))),a.sha256);
		const metadata = async file => JSON.parse(await run("unzip",["-p",component,"META-INF/lean-bridge/component/"+file],build,env));
		const ir=await metadata("binding-ir.json");
		const model=await metadata("model.json");
		const identity = checkStagedQuoteIdentities(model,ir,receipt.profiles.find(p=>p.id===pkg.profile),route,variant);
		if(application)
		{
			checkApplicationFunctionPositions(ir);checkTicketExchangePositions(ir);
			assert.equal(model.sourceIdentity.modules.find(m=>m.module==="Owned").source.sha256,"a758f8e7a4210d99fe965aa06c4b42006df3c087c70f2bde8d0e1403c30a98fb");
		}
		const manifest=JSON.parse(await run("unzip",["-p",component,"META-INF/lean-bridge/jvm/binding-manifest.json"],build,env));
		if(incoming)
		{
			assert.ok(manifest.supportedFeatures.includes("canonical-resource-equality"));
			const d=ir.declarations.find(f=>f.source.declaration==="Owned.visitQuote");
			const input=ir.types.find(x=>x.id===d.parameters[1].type.id).callable.parameters[0];
			assert.equal(input.ownership,"borrow");assert.equal(input.lifetime.scope,"call");
			assert.equal(ir.types.find(x=>x.id===input.type.id).kind,"callback");
		}
		const inputs=manifest.ownedValues.hostInputRecords;
		if(replay && inputs===undefined)
		{
			const legacy=new URL("../../docs/evidence/jvm-function-fields-20261126/"+route+".json",import.meta.url);
			assert.equal(result.receiptSha256,JSON.parse(await readFile(legacy)).receiptSha256);
		}
		else assert.deepEqual(inputs,[{type: "lean:Owned.Tariff",input: "TariffInput",lifetime: "call",fields: ["quote"]}]);
		const classes = join(build,"classes"); await mkdir(classes);
		const path = [classes,...jars].join(delimiter);
		const srcs = [resolve("tests/fixtures/jvm-tasks/Observe.java"),...["Ownership.java",...application?["JavaApplication.java","KotlinApplication.kt"]:["JavaTariff.java","KotlinTariff.kt"]].map(f=>join(fixture,f))];
		if(inputs&&!application) srcs.push(join(fixture,"JavaInput.java"),join(fixture,"KotlinInput.kt"));
		if(incoming) srcs.push(join(fixture,"JavaIncoming.java"),join(fixture,"KotlinIncoming.kt"));
		const sources = {};
		for(const s of srcs)
		{
			const name=basename(s);
			sources[name]=await digest(s); await copyFile(s,join(build,name));
		}
		const sourcesOf=ext=>srcs.filter(p=>p.endsWith(ext)).map(p=>basename(p));
		await run(join(jdk,"bin/javac"),["--release","22","-proc:none","-Xlint:unchecked","-Werror","-cp",path,"-d",classes,...sourcesOf(".java")],build,env);
		await run(join(jdk,"bin/java"),["-XX:ActiveProcessorCount=1","-Xmx384m","-cp",join(kotlin,"lib/*"),"org.jetbrains.kotlin.cli.jvm.K2JVMCompiler","-kotlin-home",kotlin,"-jdk-home",jdk,"-no-stdlib","-no-reflect","-Werror","-jvm-target","22","-classpath",path,"-d",classes,...sourcesOf(".kt")],build,env);
		const deployment = join(work,route+"-deployment"); await mkdir(deployment);
		await rename(classes,join(deployment,"classes"));
		const deployed = {};
		for(const p of jars)
		{
			const n=basename(p); assert.ok(!Object.hasOwn(deployed,n));
			await copyFile(p,join(deployment,n)); deployed[n]=await digest(join(deployment,n));
		}
		await rm(build,{recursive: true});
		const results={}, compiled={};
		const programs=application?{javaApplication: "JavaApplication",kotlinApplication: "KotlinApplicationKt"}:{...clients,...inputs ? {javaInput: "JavaInput",kotlinInput: "KotlinInputKt"} : {}
			, ...incoming ? {javaIncoming: "JavaIncoming",kotlinIncoming: "KotlinIncomingKt"} : {}};
		for(const [lang,main] of Object.entries(programs))
		{
			const scratch=await mkdtemp(join(deployment,"runtime-"));
			compiled[lang]=await digest(join(deployment,"classes",main+".class"));
			results[lang]=parse(await run(java,["--enable-native-access=ALL-UNNAMED","-Xcheck:jni","-XX:ActiveProcessorCount=1","-Xmx192m","-Djava.io.tmpdir="+scratch,"-cp",["classes",...Object.keys(deployed)].join(delimiter),main],deployment,{...clean,TMPDIR: scratch}),lang.endsWith("Input"),lang.endsWith("Incoming"),application);
			// The process has exited and its result and bytecode hash are recorded.
			// Do not carry another extracted copy of the native runtime into the next client.
			await rm(scratch,{recursive: true});
		}
		const row={route,receiptSha256: result.receiptSha256,archives: pkg.artifacts,...identity,modules,sources,deployed,compiled,results};
		if(application)
		{
			row.runtimeIdentity=pkg.runtimeIdentity;assert.match(row.runtimeIdentity,/^[0-9a-f]{64}$/u);
			row.leanSourceSha256=model.sourceIdentity.modules.find(m=>m.module==="Owned").source.sha256;
			assert.deepEqual(results.javaApplication.values,results.kotlinApplication.values);pair.push(row);
		}
		await writeFile(join(output,route+".json"),canonicalJson(row));
		await rm(deployment,{recursive: true});
		t.diagnostic(route+": "+result.receiptSha256);
	}
	if(application)
	{
		const [ordinary,reviewed]=pair;
		assert.notEqual(ordinary.receiptSha256,reviewed.receiptSha256);
		assert.notEqual(ordinary.deployed["tariff-quotes-1.0.0.jar"],reviewed.deployed["tariff-quotes-1.0.0.jar"]);
		for(const k of ["sources","leanSourceSha256","runtimeIdentity","results"])
			assert.deepEqual(ordinary[k],reviewed[k],k);
	}
	t.diagnostic("Handoffs: "+set);
});
