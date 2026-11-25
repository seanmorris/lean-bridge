/** @file Compile Java and Kotlin applications against an offline-installed immediate cursor JAR. */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, delimiter, join, relative, resolve } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

/**
 * Verify a relocated Maven install from both languages without the producer or a runtime scheduler.
 *
 * @param dir - Disposable route-specific workspace.
 * @param clients - Installed client source directory.
 * @param output - Freshly verified component handoff.
 * @param receipt - Package-set evidence for its original JAR and POM.
 */
export const exerciseJvmCursors = async (dir, clients, output, receipt) => {
	const env = process.env, build = await mkdtemp(join(dir, "compile-")), app = await mkdtemp(join(dir, "app-"));
	const repo = join(build, "repo"), deploy = join(app, "repo"), classes = join(build, "classes");
	const pkg = receipt.packages[0], pinned = ext => pkg.artifacts.find(a => a.path.endsWith(ext));
	assert.equal(pkg.name, "org.example:dials");
	const jar = pinned(".jar"), pom = pinned(".pom"), coordinate = join("org/example/dials", pkg.version);
	const java = env.LEAN_BRIDGE_JAVA ?? "java", javac = env.LEAN_BRIDGE_JAVAC ?? "javac", maven = env.LEAN_BRIDGE_MAVEN ?? "mvn";
	const sdk = env.LEAN_BRIDGE_KOTLIN_HOME, settings = resolve("tests/fixtures/jvm-sync-io/settings.xml");
	try
	{
		await cp(env.LEAN_BRIDGE_JVM_IO_M2_SEED, repo, {recursive: true, mode: constants.COPYFILE_FICLONE});
		await assert.rejects(access(join(repo, coordinate)), {code: "ENOENT"});
		await writeFile(join(build, "pom.xml"), '<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>app</groupId><artifactId>client</artifactId><version>1</version><dependencies><dependency><groupId>org.example</groupId><artifactId>dials</artifactId><version>' + pkg.version + "</version></dependency></dependencies></project>");
		const flags = ["--offline", "--batch-mode", "--quiet", "--no-transfer-progress", "-s", settings, "-Dmaven.repo.local=" + repo];
		await run(maven, [...flags, "org.apache.maven.plugins:maven-install-plugin:3.1.4:install-file",
			"-Dfile=" + join(output, jar.path), "-DpomFile=" + join(output, pom.path)], build, env);
		await run(maven, [...flags, "org.apache.maven.plugins:maven-dependency-plugin:3.8.1:build-classpath", "-Dmdep.outputFile=deps"], build, env);
		const paths = (await readFile(join(build, "deps"), "utf8")).trim().split(delimiter);
		assert.ok(paths.every(p => p.startsWith(repo + "/") && p.endsWith(".jar")));
		assert.ok(paths.some(p => p.endsWith("/kotlin-stdlib-2.2.0.jar")));
		assert.ok(paths.every(p => !p.includes("coroutines")));
		const artifact = join(repo, coordinate, basename(jar.path)); assert.ok(paths.includes(artifact));
		assert.equal(sha256(await readFile(artifact)), jar.sha256);
		assert.equal(sha256(await readFile(join(repo, coordinate, basename(pom.path)))), pom.sha256);
		const entries = await run("unzip", ["-Z1", artifact], build, env);
		assert.match(entries, /org\/leanbridge\/dials\/LeanCursor\.class/u);
		assert.match(entries, /org\/leanbridge\/dials\/kotlin\/LeanSequence\.class/u);
		assert.doesNotMatch(entries, /TaskReactor|TaskPort|Delivery\.class/u);
		await mkdir(classes);
		const cpArgs = paths.join(delimiter);
		await run(javac, ["--release", "22", "-proc:none", "-cp", cpArgs, "-d", classes, resolve("tests/fixtures/jvm-tasks/Observe.java"), join(clients, "InstalledCursor.java")], build, env);
		await run(java, ["-XX:ActiveProcessorCount=1", "-Xmx384m", "-cp", join(sdk, "lib/*"),
			"org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-kotlin-home", sdk, "-jdk-home", env.JAVA_HOME, "-no-stdlib", "-no-reflect",
			"-Werror", "-jvm-target", "22", "-classpath", cpArgs, "-d", classes, join(clients, "InstalledCursor.kt")], build, env);
		const deployedClasses = join(app, "classes");
		await rename(classes, deployedClasses); await rename(repo, deploy); await rm(build, {recursive: true});
		const isolated = {PATH: "/no-build-tools", LANG: "C.UTF-8", TMPDIR: app, LEAN_NUM_THREADS: "1"};
		const classpath = [deployedClasses, ...paths.map(p => join(deploy, relative(repo, p)))].join(delimiter);
		for(const main of ["InstalledCursor", "InstalledCursorKt"]) for(const mode of ["iterate", "shutdown"])
		{
			const temp = await mkdtemp(join(app, "runtime-"));
			await writeFile(join(app, "state"), "open");
			try
			{
				await run(java, ["-XX:ActiveProcessorCount=1", "-XX:+UseSerialGC", "-Xmx160m", "-Djava.io.tmpdir=" + temp,
					"--enable-native-access=ALL-UNNAMED", "-cp", classpath, main, mode], app, isolated, 90_000);
				assert.equal(await readFile(join(app, "state"), "utf8"), "closed", main + " " + mode);
			} finally { await rm(temp, {recursive: true, force: true}); }
		}
	} finally {
		await rm(build, {recursive: true, force: true}); await rm(app, {recursive: true, force: true});
	}
};
