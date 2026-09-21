/**
 * Failure injection into an isolated verified JVM alias projection.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { javaCompilerOptions } from "./type-corpus-jvm-tools.mjs";

/**
 * Assert cleanup on partial input failures, malformed outputs and allocation errors.
 *
 * @param options - Verified source and package inputs.
 * @param options.consumer - Private consumer root.
 * @param options.environment - Selected tools.
 * @param options.sources - Verified compiled projection sources.
 * @param options.jar - Unchanged release JAR containing native resources.
 * @param options.projection - Private conversion indices, not semantic expectations.
 */
export const checkJvmAliasFaults = async ({ consumer, environment, sources, jar, projection }) => {
	const root = join(consumer, "alias-probe"), prefix = "src/main/java/org/leanbridge/aliases/", replacements = [];
	const files = { ...sources };
	const replace = (file, pattern, replacement, minimum = 1) => {
		const matches = [...files[file].matchAll(pattern)]; assert.ok(matches.length >= minimum, String(pattern));
		replacements.push(matches.length); files[file] = files[file].replace(pattern, replacement);
	};
	const runtime = `${prefix}Runtime.java`, scope = `${prefix}Scope.java`;
	replace(runtime, /(private static [^\n]+ (?:to|from)\d+\([^\n]*\) \{\n)/g, "$1        AliasProbe.check();\n", 50);
	replace(runtime, /Arena arena = Arena\.ofConfined\(\)/g, "Arena arena = AliasProbe.arena()", 31);
	for(const file of [runtime, scope]) replace(file, /\b(scope\.arena|arena)\.allocate\(/g, "AliasProbe.allocate($1, ");
	replace(runtime, /( {16}int status = \(int\)CALL\d+)/g, "                AliasProbe.calls++;\n$1", 31);
	replace(runtime, /finally \{ (CLEAR\d+\.invokeExact\(output\);) \}/g, "finally { AliasProbe.clears++; $1 }", 13);
	files[`${prefix}AliasProbe.java`] = `package org.leanbridge.aliases;
import java.lang.foreign.*;
final class AliasProbe {
    private AliasProbe() { }
    static int count, target, calls, clears;
    static final java.util.List<Arena> arenas = new java.util.ArrayList<>();
    static void check() { if (++count == target) throw new OutOfMemoryError("injected conversion failure"); }
    static Arena arena() { var arena = Arena.ofConfined(); try { arenas.add(arena); return arena; } catch (Throwable error) { arena.close(); throw error; } }
    static MemorySegment allocate(Arena arena, long bytes, long alignment) { var value = arena.allocate(bytes, alignment); check(); return value; }
    static void closed() { for (var arena : arenas) if (arena.scope().isAlive()) throw new AssertionError("arena still alive"); }
    static void reset() { closed(); arenas.clear(); count = target = 0; }
}
`;
	const program = await readFile("tests/fixtures/alias-consumers/jvm-faults.java", "utf8");
	files[`${prefix}Faults.java`] = program;
	for(const [path, source] of Object.entries(files)) await saveLakeFile(root, path, source);
	await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-d", "classes", ...Object.keys(files)], root);
	const index = field => projection.surface.copy(projection.surface.functions.find(fn => fn.field === field).declaration.result.type).index;
	const temp = join(root, "native-temp"); await mkdir(temp);
	const jarSha256 = sha256(await readFile(jar));
	const result = await runCopied(environment.LEAN_BRIDGE_JAVA, ["--enable-native-access=ALL-UNNAMED", `-Djava.io.tmpdir=${temp}`, "-cp", `classes:${jar}`, "org.leanbridge.aliases.Faults", ...["echo_maybe", "echo_outcome", "reverse_rows", "echo_string", "echo_char"].map(field => String(index(field)))], root, copiedCleanEnvironment);
	assert.equal(result.stderr, ""); assert.match(result.stdout, /^alias-jvm-faults:\d+:18\n$/);
	assert.deepEqual(await readdir(temp), []); assert.equal(sha256(await readFile(jar)), jarSha256);
	const checks = Number(result.stdout.split(":")[1]); assert.ok(checks > 150);
	await rm(root, { recursive: true, force: true });
	return { checks, layoutChecks: 18, partialInputChecks: 64, replacements
		, originalSources: Object.fromEntries(Object.entries(sources).map(([path, source]) => [path, sha256(source)]))
		, instrumentedSources: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)]))
		, probeSourceSha256: sha256(program)
		, isolatedInstrumentedProjection: true, releaseJarUnchanged: true
		, normalExitCleanup: true };
};
