/**
 * Observe real subprocesses with explicit stand-in tools, not JVM acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { copiedCleanEnvironment } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { measureNominalSubtypeJvmCiTools } from "./nominal-subtype-jvm-ci-tools.mjs";

test("nominal JVM tool observation isolates commands and authenticates compiler JARs", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-jvm-ci-tools-"));
	t.after(() => rm(root, { recursive: true }));
	const selected = {
		java: join(root, 'jdk with "quotes"/bin/java')
		, javac: join(root, 'jdk with "quotes"/bin/javac')
		, kotlinc: join(root, "kotlin tools/bin/kotlinc") };
	const javaVersion = "openjdk 22.0.2 2024-07-16\nSynthetic version fixture\n", kotlinVersion = "info: kotlinc-jvm 2.2.0 (JRE 22.0.2+9)";
	const kotlinHome = join(root, "kotlin tools"), lib = join(kotlinHome, "lib");
	const source = name => `#!${process.execPath}
import assert from 'node:assert/strict';
import fs from 'node:fs';
for (const [key, value] of Object.entries(${JSON.stringify(copiedCleanEnvironment)})) assert.equal(process.env[key], value);
for (const key of ['JAVA_TOOL_OPTIONS','JDK_JAVA_OPTIONS','JDK_JAVAC_OPTIONS','_JAVA_OPTIONS','JAVA_OPTS','KOTLIN_OPTS','KOTLIN_RUNNER','CLASSPATH']) assert.equal(process.env[key], undefined);
const args = process.argv.slice(2);
if (${JSON.stringify(name)} === 'javac') {
  assert.deepEqual(args, ['-version']); process.stdout.write('javac 22.0.2\\n');
} else if (args[0] === '--version') {
  assert.deepEqual(args, ['--version']); process.stdout.write(${JSON.stringify(javaVersion)});
} else {
  assert.deepEqual(args, ['-Xmx2g','-classpath',${JSON.stringify(join(lib, "*"))},'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler','-kotlin-home',${JSON.stringify(kotlinHome)},'-version']);
  if (fs.existsSync('alter-compiler')) fs.appendFileSync(${JSON.stringify(join(lib, "kotlin-compiler.jar"))}, 'changed');
  process.stderr.write(${JSON.stringify(kotlinVersion + "\n")});
}
`;
	for(const [name, path] of Object.entries(selected))
	{
		await saveLakeFile(root, path.slice(root.length + 1), name === "kotlinc" ? "stand-in launcher, never invoked\n" : source(name));
		await chmod(path, 0o755);
	}
	const jars = ["kotlin-compiler.jar", "kotlin-stdlib.jar", "annotations-13.0.jar", "extra-compiler.jar"];
	for(const name of jars) await saveLakeFile(root, "kotlin tools/lib/" + name, "stand-in compiler input " + name);
	const result = await measureNominalSubtypeJvmCiTools(selected, root);
	assert.equal(result.java.version, javaVersion); assert.equal(result.javac.version, "javac 22.0.2");
	assert.equal(result.kotlinc.version, kotlinVersion);
	for(const [name, path] of Object.entries(selected))
	{
		assert.equal(result[name].command, path); assert.equal(result[name].sha256, sha256(await readFile(path)));
	}
	assert.deepEqual(Object.keys(result.kotlinc.compilerFiles).sort(), jars.sort());
	for(const name of jars) assert.equal(result.kotlinc.compilerFiles[name], sha256(await readFile(join(lib, name))));
	await saveLakeFile(root, "other-jdk/bin/javac", source("javac")); await chmod(join(root, "other-jdk/bin/javac"), 0o755);
	await assert.rejects(measureNominalSubtypeJvmCiTools({ ...selected, javac: join(root, "other-jdk/bin/javac") }, root));
	await assert.rejects(measureNominalSubtypeJvmCiTools({ ...selected, java: join(root, "missing") }, root));
	const compiler = join(lib, "kotlin-compiler.jar"), original = await readFile(compiler);
	await rm(compiler); await assert.rejects(measureNominalSubtypeJvmCiTools(selected, root));
	await symlink(join(lib, "kotlin-stdlib.jar"), compiler); await assert.rejects(measureNominalSubtypeJvmCiTools(selected, root));
	await rm(compiler); await saveLakeFile(root, "kotlin tools/lib/kotlin-compiler.jar", original);
	await saveLakeFile(root, "alter-compiler", "change during command");
	await assert.rejects(measureNominalSubtypeJvmCiTools(selected, root));
	t.diagnostic("Five missing, mixed-JDK, symlink and mid-observation drift controls; stand-in subprocesses do not claim installed JVM execution");
});
