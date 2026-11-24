/** @file Install the verified independent packages offline, relocate Maven's repository, and launch both consumers. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, delimiter, dirname, join, relative, resolve } from "node:path";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

const fixture = resolve("tests/fixtures/jvm-host-meter");
const hash = async path => { const h = createHash("sha256"); for await(const b of createReadStream(path)) h.update(b); return h.digest("hex"); };
/**
 * Install only the Maven artifacts. Resolve all dependencies without the producer or network.
 *
 * @param root - Private scratch directory.
 * @param packs - Two verified coordinates with their archive digests.
 */
export const runJvmHostConsumers = async (root, packs) => {
	const env = process.env, proj = await mkdtemp(join(root, "installed-"));
	const mvn = env.LEAN_BRIDGE_MAVEN ?? "mvn", java = env.LEAN_BRIDGE_JAVA ?? "java", javac = env.LEAN_BRIDGE_JAVAC ?? "javac";
	const sdk = env.LEAN_BRIDGE_KOTLIN_HOME, repo = join(proj, "repo"), dest = join(proj, "relocated repo");
	const answers = [];
	try
	{
		await cp(resolve(env.LEAN_BRIDGE_JVM_IO_M2_SEED), repo, { recursive: true });
		const names = packs.map(p => p.name); assert.deepEqual(names, ["workshop", "workshop-peer"]);
		const inspection = await run(env.LEAN_BRIDGE_PYTHON ?? "python3", ["-I", "-B", join(fixture, "check_pair.py"), ...packs.map(p => p.files.find(f => f.endsWith(".jar")))], proj, env);
		assert.equal(inspection, "one verified runtime, owner and host domain; independent JNI entries");
		const deps = names.map(n => "<dependency><groupId>org.leanbridge</groupId><artifactId>" + n + "</artifactId><version>1.0.0</version></dependency>").join("");
		await writeFile(join(proj, "pom.xml"), '<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>app</groupId><artifactId>client</artifactId><version>1</version><dependencies>' + deps + "</dependencies></project>");
		const flags = ["--offline", "--batch-mode", "--quiet", "--no-transfer-progress", "-s", resolve("tests/fixtures/jvm-sync-io/settings.xml"), "-Dmaven.repo.local=" + repo];
		for(const p of packs)
		{
			await assert.rejects(access(join(repo, "org/leanbridge", p.name)), { code: "ENOENT" });
			await run(mvn, [...flags, "org.apache.maven.plugins:maven-install-plugin:3.1.4:install-file", "-Dfile=" + p.files.find(f => f.endsWith(".jar")), "-DpomFile=" + p.files.find(f => f.endsWith(".pom"))], proj, env);
		}
		await run(mvn, [...flags, "org.apache.maven.plugins:maven-dependency-plugin:3.8.1:build-classpath", "-Dmdep.outputFile=resolved.txt"], proj, env);
		const resolved = (await readFile(join(proj, "resolved.txt"), "utf8")).trim().split(delimiter).map(s => relative(repo, s));
		assert.ok(resolved.every(s => !s.startsWith("..") && s.endsWith(".jar")));
		assert.ok(resolved.includes("org/jetbrains/kotlin/kotlin-stdlib/2.2.0/kotlin-stdlib-2.2.0.jar"));
		await rename(repo, dest); const jars = resolved.map(s => join(dest, s)), paths = jars.join(delimiter);
		for(const p of packs)
		{
			const installed = jars.find(s => s.endsWith("/" + p.name + "-1.0.0.jar")); assert.ok(installed);
			for(const a of p.artifacts) assert.equal(await hash(join(dirname(installed), basename(a.path))), a.sha256);
		}
		const classes = join(proj, "classes"); await mkdir(classes);
		await run(javac, ["--release", "22", "-proc:none", "-cp", paths, "-d", classes, join(fixture, "Consumer.java")], proj, env);
		const cpArg = classes + delimiter + paths;
		await run(java, ["-XX:ActiveProcessorCount=1", "-Xmx384m", "-cp", join(sdk, "lib/*"), "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-kotlin-home", sdk, "-jdk-home", env.JAVA_HOME, "-no-stdlib", "-no-reflect", "-Werror", "-jvm-target", "22", "-classpath", cpArg, "-d", classes, join(fixture, "KotlinConsumer.kt")], proj, env);
		for(const main of ["Consumer", "KotlinConsumerKt"]) for(const order of ["ordinary-first", "peer-first"])
		{
			const isolated = await mkdtemp(join(proj, "fresh-jvm-"));
			try
			{
				const args = main === "Consumer" ? [order, jars.find(s => s.endsWith("/workshop-1.0.0.jar"))] : [order];
				const line = await run(java, ["-XX:ActiveProcessorCount=1", "-Xmx128m", "-Xcheck:jni", "--enable-native-access=ALL-UNNAMED", "-Djava.io.tmpdir=" + isolated, "-cp", cpArg, main, ...args], isolated, { LANG: "C.UTF-8", PATH: "/no-author-tools", LEAN_NUM_THREADS: "1" }, 180000);
				assert.match(line, main === "Consumer" ? /^Java: .*retirement$/u : /^Kotlin: .*scoped use$/u);
				answers.push(order + ": " + line);
			} finally
			{ await rm(isolated, { recursive: true, force: true }); }
		}
		for(const p of packs) for(const file of p.files) await rm(file);
		return answers;
	} finally
	{ await rm(proj, { recursive: true, force: true }); }
};
