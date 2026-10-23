/**
 * Offline Maven installation and runtime-only replay for callback Subtypes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, readdir, rm, rename } from "node:fs/promises";
import { basename, delimiter, join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { javaCompilerOptions, jvmConsumerPom, jvmMaven, jvmRun, jvmTools
	, kotlinCompilerOptions, mavenGoals, mavenSettings } from "./type-corpus-jvm-tools.mjs";

const inventory = async root => Object.fromEntries(await Promise.all(
	(await nativeArtifactPaths(root)).map(async path => {
		const bytes = await readFile(join(root, path));
		return [path, { bytes: bytes.length, sha256: sha256(bytes) }];
	})
));

/**
 * Create an install policy closed over one verified Maven handoff.
 *
 * @param options - Verified component package and plugin closure.
 * @param options.handoff - Relocated prepared package set.
 * @param options.pkg - Maven component package receipt entry.
 * @param options.dependencies - Authenticated Maven plugin closure.
 */
export const callbackSubtypeJvmInstaller = ({ handoff, pkg, dependencies }) => async options => {
	const { profile, root, archive, archiveSha256, environment } = options;
	const tools = await jvmTools(environment), project = join(root, "maven-project");
	const component = pkg.artifacts.find(item => item.path.endsWith(".jar"));
	const pom = pkg.artifacts.find(item => item.path.endsWith(".pom"));
	assert.equal(archive, join(handoff, component.path));
	assert.equal(archiveSha256, component.sha256);
	await mkdir(join(project, "repository"), { recursive: true });
	await mkdir(join(project, "home")); await mkdir(join(project, "empty-source"));
	assert.equal(sha256(await readFile(join(handoff, dependencies.archive))), dependencies.sha256);
	await jvmRun("/usr/bin/tar", [
		"--use-compress-program=/usr/bin/gzip", "-xf"
		, join(handoff, dependencies.archive), "-C", project
	], project, copiedCleanEnvironment);
	assert.deepEqual(await inventory(join(project, "repository")), dependencies.files);
	await saveLakeFile(project, "settings.xml", mavenSettings);
	await saveLakeFile(project, "pom.xml", jvmConsumerPom(pkg));
	await jvmMaven(tools, project, [
		mavenGoals.install
		, `-Dfile=${join(handoff, component.path)}`
		, `-DpomFile=${join(handoff, pom.path)}`
	], copiedCleanEnvironment);
	await jvmMaven(tools, project, [
		mavenGoals.resolve, "-Dmdep.outputFile=classpath.txt"
	], copiedCleanEnvironment);
	const classpath = (await readFile(join(project, "classpath.txt"), "utf8"))
		.trim().split(delimiter);
	assert.ok(classpath.length >= 2);
	assert.equal(sha256(await readFile(classpath[0])), component.sha256);
	const classes = join(project, "classes"); await mkdir(classes);
	if(profile === "java")
		await jvmRun(tools.javac, [
			...javaCompilerOptions
			, "-sourcepath", join(project, "empty-source")
			, "-classpath", classpath.join(delimiter)
			, "-d", classes, join(root, "consumer.java")
		], project, copiedCleanEnvironment);
	else
		await jvmRun(environment.LEAN_BRIDGE_KOTLINC, [
			...kotlinCompilerOptions
			, "-jdk-home", tools.jdk
			, "-classpath", classpath.join(delimiter)
			, "-include-runtime", "-d", join(project, "consumer.jar")
			, join(root, "consumer.kt")
		], project, { ...environment, JAVA_HOME: tools.jdk });
	const deployment = join(root, "relocated");
	await mkdir(join(deployment, "lib"), { recursive: true });
	const runtimeClasspath = [];
	if(profile === "java")
	{
		await rename(classes, join(deployment, "classes"));
		runtimeClasspath.push("classes");
	}
	else
	{
		await cp(join(project, "consumer.jar"), join(deployment, "consumer.jar"));
		runtimeClasspath.push("consumer.jar");
	}
	for(const [index, path] of classpath.entries())
	{
		const target = `lib/${index}-${basename(path)}`;
		await cp(path, join(deployment, target)); runtimeClasspath.push(target);
	}
	const runtime = join(root, "runtime-only");
	await jvmRun(tools.jlink, [
		"--module-path", join(tools.jdk, "jmods")
		, "--add-modules", "java.base"
		, "--no-header-files", "--no-man-pages", "--output", runtime
	], project, copiedCleanEnvironment);
	const expectedDeployment = await inventory(deployment);
	const expectedRuntime = await inventory(runtime);
	await rm(project, { recursive: true, force: true });
	assert.deepEqual((await readdir(root)).sort(), [
		"consumer." + (profile === "java" ? "java" : "kt")
		, "relocated", "runtime-only"
	]);
	const command = join(runtime, "bin/java");
	const main = profile === "java" ? "Consumer" : "ConsumerKt";
	const run = async () => {
		assert.deepEqual(await inventory(deployment), expectedDeployment);
		assert.deepEqual(await inventory(runtime), expectedRuntime);
		const temporary = join(deployment, "native-temp"); await mkdir(temporary);
		const args = [
			"--enable-native-access=ALL-UNNAMED"
			, `-Djava.io.tmpdir=${temporary}`
			, "-classpath", runtimeClasspath.join(delimiter), main
		];
		const clean = { ...copiedCleanEnvironment, JAVA_HOME: runtime };
		const first = await jvmRun(command, args, deployment, clean);
		assert.deepEqual(await readdir(temporary), []);
		const second = await jvmRun(command, args, deployment, clean);
		assert.equal(second.code, first.code);
		assert.equal(second.stdout, first.stdout); assert.equal(second.stderr, first.stderr);
		assert.deepEqual(await readdir(temporary), []); await rm(temporary, { recursive: true });
		assert.deepEqual(await inventory(deployment), expectedDeployment);
		return first;
	};
	return { context: {
		offlineMaven: true, runtimeOnly: true, repeatExecution: true
		, componentSha256: component.sha256
		, dependencyClosureSha256: dependencies.sha256
	}
	, command, args: [], run };
};
