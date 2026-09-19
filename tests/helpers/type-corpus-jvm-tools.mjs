/**
 * Explicit JVM tools, a hashed Maven plugin closure and source-bound diagnostics.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, readdir, realpath } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { createDeterministicTarGz } from "../../src/release/deterministic-archive.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Run a selected JVM tool with bounded output and execution time.
 *
 * @param command - Absolute tool path.
 * @param args - Explicit arguments.
 * @param cwd - Private working directory.
 * @param env - Controlled environment.
 */
export const jvmRun = (command, args, cwd, env) => processBuildRunner.capture({ command, args, cwd, env, timeoutMs: 180_000 });
/**
 * Hash the exact bytes of a selected package or tool file.
 *
 * @param path - Selected file path.
 */
export const jvmDigest = async path => sha256(await readFile(path));
export const javaCompilerOptions = Object.freeze(["--release", "22", "-g:none", "-proc:none", "-encoding", "UTF-8", "-Xlint:all", "-Werror", "-implicit:none"]);
export const kotlinCompilerOptions = Object.freeze(["-jvm-target", "22", "-no-stdlib", "-no-reflect", "-Werror", "-Xrender-internal-diagnostic-names"]);
export const mavenGoals = Object.freeze({ install: "org.apache.maven.plugins:maven-install-plugin:3.1.4:install-file", resolve: "org.apache.maven.plugins:maven-dependency-plugin:3.8.1:build-classpath" });
export const mavenSettings = '<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"><mirrors><mirror><id>corpus-central</id><mirrorOf>*</mirrorOf><url>https://repo.maven.apache.org/maven2</url></mirror></mirrors></settings>\n';
/**
 * Build a consumer POM with only the exact prepared package as a dependency.
 *
 * @param pkg - Prepared Maven package coordinates.
 */
export const jvmConsumerPom = pkg => {
	const [group, name] = pkg.name.split(":");
	return `<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>corpus.consumer</groupId><artifactId>consumer</artifactId><version>1.0.0</version><dependencies><dependency><groupId>${group}</groupId><artifactId>${name}</artifactId><version>${pkg.version}</version></dependency></dependencies></project>\n`;
};

/**
 * Resolve explicitly selected tools without using an ambient Java installation.
 *
 * @param environment - Explicit selected JVM tools.
 */
export const jvmTools = async environment => {
	const java = await realpath(environment.LEAN_BRIDGE_JAVA), javac = await realpath(environment.LEAN_BRIDGE_JAVAC);
	const jdk = dirname(dirname(java)), maven = dirname(dirname(await realpath(environment.LEAN_BRIDGE_MAVEN)));
	assert.equal(dirname(dirname(javac)), jdk);
	const boot = (await readdir(join(maven, "boot"))).filter(file => /^plexus-classworlds-.*\.jar$/.test(file));
	assert.equal(boot.length, 1);
	return { java, javac, jdk, maven, boot: join(maven, "boot", boot[0]), jlink: join(jdk, "bin/jlink"), jar: join(jdk, "bin/jar") };
};

/**
 * Invoke Maven without an ambient shell, user settings, daemon or global cache.
 *
 * @param tools - Selected JVM tool paths.
 * @param root - Private Maven project and settings directory.
 * @param args - Pinned Maven goals and local artifact arguments.
 * @param clean - Controlled environment.
 * @param offline - True for every downstream install and resolution.
 */
export const jvmMaven = (tools, root, args, clean, offline = true) => jvmRun(tools.java, [
	`-Duser.home=${join(root, "home")}`, `-Dmaven.home=${tools.maven}`
	, `-Dmaven.conf=${join(tools.maven, "conf")}`
	, `-Dclassworlds.conf=${join(tools.maven, "bin/m2.conf")}`
	, `-Dmaven.multiModuleProjectDirectory=${root}`
	, "-classpath", tools.boot, "org.codehaus.plexus.classworlds.launcher.Launcher"
	, "--batch-mode", "--no-transfer-progress"
	, "--settings", join(root, "settings.xml")
	, "--global-settings", join(root, "settings.xml")
	, `-Dmaven.repo.local=${join(root, "repository")}`
	, "-Dstyle.color=never", ...offline ? ["--offline"] : [], ...args
], root, { ...clean, JAVA_HOME: tools.jdk });

/**
 * Download build-tool plugins on the author side; consumers receive a hashed closure.
 *
 * @param options - Task-owned author and handoff roots.
 * @param options.directory - Author scratch directory.
 * @param options.handoff - Relocated package handoff.
 * @param options.pkg - Prepared Maven JAR and POM.
 * @param options.environment - Selected JVM tools.
 * @param options.clean - Restricted environment.
 */
export const prepareJvmCorpusDependencies = async ({ directory, handoff, pkg, environment, clean }) => {
	const tools = await jvmTools(environment), root = join(directory, "maven-bootstrap");
	await mkdir(root); await mkdir(join(root, "home"));
	await saveLakeFile(root, "settings.xml", mavenSettings);
	await saveLakeFile(root, "pom.xml", jvmConsumerPom(pkg));
	const jar = pkg.artifacts.find(file => file.path.endsWith(".jar")), pom = pkg.artifacts.find(file => file.path.endsWith(".pom"));
	await jvmMaven(tools, root, [mavenGoals.install, `-Dfile=${join(handoff, jar.path)}`, `-DpomFile=${join(handoff, pom.path)}`], clean, false);
	await jvmMaven(tools, root, [mavenGoals.resolve, "-Dmdep.outputFile=classpath.txt"], clean, false);
	const vendor = join(directory, "maven-plugin-closure"), files = {};
	const own = `${pkg.name.split(":")[0].replaceAll(".", "/")}/`;
	for(const path of await nativeArtifactPaths(join(root, "repository")))
	{
		if(path.startsWith(own) || path.endsWith(".lastUpdated") || basename(path) === "_remote.repositories" || basename(path) === "resolver-status.properties") continue;
		assert.ok(!path.includes("SNAPSHOT"));
		const bytes = await readFile(join(root, "repository", path));
		await saveLakeFile(vendor, path, bytes);
		files[path] = { sha256: sha256(bytes), bytes: bytes.length };
	}
	for(const path of ["org/apache/maven/plugins/maven-install-plugin/3.1.4/maven-install-plugin-3.1.4.jar", "org/apache/maven/plugins/maven-dependency-plugin/3.8.1/maven-dependency-plugin-3.8.1.jar"]) assert.ok(files[path]);
	const bytes = await createDeterministicTarGz({ directory: vendor, archiveRoot: "repository", sourceDateEpoch: 1 });
	await saveLakeFile(handoff, "maven-plugin-closure.tar.gz", bytes);
	return { archive: "maven-plugin-closure.tar.gz", sha256: sha256(bytes), files };
};

/**
 * Require compiler type diagnostics at the exact invalid consumer source.
 *
 * @param result - Full bounded compiler output and exit status.
 * @param entry - Invalid catalog input with a profile-specific expected diagnostic.
 * @param profile - Java or Kotlin.
 * @param root - Isolated compiler project.
 * @param file - Relative invalid source path.
 */
export const jvmDiagnostics = (result, entry, profile, root, file) => {
	assert.equal(result.code, 1, `${entry.id}: ${result.stdout} ${result.stderr}`);
	const lines = `${result.stdout}\n${result.stderr}`.split("\n"), diagnostics = [];
	for(const line of lines)
	{
		const match = profile === "java" ? /^(.+\.java):(\d+):(\d+): (compiler\.err\.[^:]+): (.+)$/.exec(line)
			: /^(.+\.kt):(\d+):(\d+): error: \[([A-Z_]+)\] (.+)$/.exec(line);
		if(!match)
		{
			assert.ok(!line.includes("compiler.err.") && !/\berror:/.test(line), line);
			continue;
		}
		const [, path, row, column, code, message] = match;
		assert.equal(code, Array.isArray(entry.expectation.diagnostic) ? entry.expectation.diagnostic[diagnostics.length] : entry.expectation.diagnostic, `${entry.id}: ${line}`);
		const actual = path.startsWith("file:") ? fileURLToPath(path) : resolve(root, profile === "java" && path === basename(file) ? file : path);
		assert.equal(actual, join(root, file));
		assert.ok(Number(row) > 0 && Number(column) > 0);
		diagnostics.push({ code, file, line: Number(row), column: Number(column), message });
	}
	assert.ok(diagnostics.length > 0, `${entry.id}: missing source-located diagnostics: ${result.stdout} ${result.stderr}`);
	if(Array.isArray(entry.expectation.diagnostic)) assert.deepEqual(diagnostics.map(diagnostic => diagnostic.code), entry.expectation.diagnostic);
	return diagnostics;
};
