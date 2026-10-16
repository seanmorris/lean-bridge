/**
 * Observe explicit current JVM tools without rebuilding successful packages.
 * Complete JDK/Kotlin distributions remain trusted, as the producer declares.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, readFile, readdir, realpath, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, dirname, join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { runCopied } from "./copied-fixture-install.mjs";

/**
 * Measure actual executables, compiler versions and all Kotlin compiler JARs.
 * No historical record path or ambient Java options select the commands.
 *
 * @param selected - Explicit Java, javac and kotlinc paths.
 * @param directory - Canonical existing checker working directory.
 */
export const measureNominalSubtypeJvmCiTools = async (selected, directory) => {
	const tools = {};
	for(const name of ["java", "javac", "kotlinc"])
	{
		const command = await realpath(selected[name]);
		assert.equal(basename(command), name); assert.ok((await stat(command)).isFile());
		await access(command, constants.X_OK);
		tools[name] = { command, sha256: sha256(await readFile(command)) };
	}
	assert.equal(dirname(tools.java.command), dirname(tools.javac.command), "Java and javac must share one JDK");
	const java = await runCopied(tools.java.command, ["--version"], directory);
	assert.equal(java.code, 0); assert.equal(java.stderr, "");
	tools.java.version = java.stdout;
	const javac = await runCopied(tools.javac.command, ["-version"], directory);
	assert.equal(javac.code, 0); assert.ok(!javac.stdout || !javac.stderr);
	tools.javac.version = (javac.stdout || javac.stderr).trim();
	const home = dirname(dirname(tools.kotlinc.command)), lib = join(home, "lib"), compilerFiles = {};
	for(const name of (await readdir(lib)).filter(name => name.endsWith(".jar")).sort())
	{
		assert.match(name, /^[A-Za-z0-9_.+-]+\.jar$/u);
		const path = join(lib, name); assert.equal(await realpath(path), path);
		assert.ok((await stat(path)).isFile());
		compilerFiles[name] = sha256(await readFile(path));
	}
	for(const name of ["kotlin-compiler.jar", "kotlin-stdlib.jar", "annotations-13.0.jar"]) assert.ok(compilerFiles[name]);
	const kotlin = await runCopied(tools.java.command, [
		"-Xmx2g", "-classpath", join(lib, "*")
		, "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler"
		, "-kotlin-home", home, "-version"
	], directory);
	assert.equal(kotlin.code, 0); assert.ok(!kotlin.stdout || !kotlin.stderr);
	tools.kotlinc = { ...tools.kotlinc, version: (kotlin.stderr || kotlin.stdout).trim(), compilerFiles };
	for(const tool of Object.values(tools)) assert.equal(sha256(await readFile(tool.command)), tool.sha256);
	for(const [name, digest] of Object.entries(compilerFiles)) assert.equal(sha256(await readFile(join(lib, name))), digest);
	return tools;
};
