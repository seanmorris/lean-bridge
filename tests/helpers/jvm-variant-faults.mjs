/**
 * Isolated verified JVM variant sources with arena and active-union probes.
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
 * Probe private conversions separately from the installed release classes.
 *
 * @param options - Verified sources and original package inputs.
 * @param options.consumer - Private task-owned root.
 * @param options.environment - Selected JVM tools.
 * @param options.sources - Verified generated source projection.
 * @param options.jar - Original JAR carrying the native resources.
 * @param options.projection - Private layout indices, not expected Lean results.
 */
export const checkJvmVariantFaults = async ({ consumer, environment, sources, jar, projection }) => {
	const root = join(consumer, "variant-probe"), prefix = "src/main/java/org/leanbridge/variants/", replacements = [];
	const files = { ...sources };
	const replace = (file, pattern, replacement, minimum = 1) => {
		const matches = [...files[file].matchAll(pattern)]; assert.ok(matches.length >= minimum, String(pattern));
		replacements.push(matches.length); files[file] = files[file].replace(pattern, replacement);
	};
	const runtime = `${prefix}Runtime.java`, scope = `${prefix}Scope.java`;
	replace(runtime, /(private static [^\n]+ (?:to|from)\d+\([^\n]*\) \{\n)/g, "$1        VariantProbe.check();\n", 60);
	replace(runtime, /Arena arena = Arena\.ofConfined\(\)/g, "Arena arena = VariantProbe.arena()", 14);
	for(const file of [runtime, scope]) replace(file, /\b(scope\.arena|arena)\.allocate\(/g, "VariantProbe.allocate($1, ");
	replace(runtime, /( {16}int status = \(int\)CALL\d+)/g, "                VariantProbe.calls++;\n$1", 14);
	replace(runtime, /finally \{ (CLEAR\d+\.invokeExact\(output\);) \}/g, "finally { VariantProbe.clears++; $1 }", 10);
	files[`${prefix}VariantProbe.java`] = `package org.leanbridge.variants;
import java.lang.foreign.*;
final class VariantProbe {
    private VariantProbe() { }
    static int count, target, calls, clears;
    static final java.util.List<Arena> arenas = new java.util.ArrayList<>();
    static void check() { if (++count == target) throw new OutOfMemoryError("injected conversion failure"); }
    static Arena arena() { var arena = Arena.ofConfined(); try { arenas.add(arena); return arena; } catch (Throwable error) { arena.close(); throw error; } }
    static MemorySegment allocate(Arena arena, long bytes, long alignment) { var value = arena.allocate(bytes, alignment); check(); return value; }
    static void closed() { for (var arena : arenas) if (arena.scope().isAlive()) throw new AssertionError("arena still alive"); }
    static void reset() { closed(); arenas.clear(); count = target = 0; }
}
`;
	const program = await readFile("tests/fixtures/variant-consumers/jvm-faults.java", "utf8");
	files[`${prefix}Faults.java`] = program;
	for(const [path, source] of Object.entries(files)) await saveLakeFile(root, path, source);
	await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-d", "classes", ...Object.keys(files)], root);
	const layouts = projection.surface.copies.filter(copy => copy.variant).map(copy => [copy.index, copy.size, copy.alignment, copy.payloadOffset, copy.cases[0].size].join(":"));
	assert.equal(layouts.length, 7);
	const temp = join(root, "native-temp"); await mkdir(temp);
	const jarSha256 = sha256(await readFile(jar));
	const result = await runCopied(environment.LEAN_BRIDGE_JAVA, ["--enable-native-access=ALL-UNNAMED", `-Djava.io.tmpdir=${temp}`, "-cp", `classes:${jar}`, "org.leanbridge.variants.Faults", ...layouts], root, copiedCleanEnvironment);
	assert.equal(result.stderr, ""); assert.match(result.stdout, /^variant-jvm-faults:\d+:13\n$/);
	assert.deepEqual(await readdir(temp), []); assert.equal(sha256(await readFile(jar)), jarSha256);
	const checks = Number(result.stdout.split(":")[1]); assert.ok(checks > 100);
	await rm(root, { recursive: true, force: true });
	return { checks, layoutChecks: 13, malformedTags: 7, inactiveCases: 6
		, partialInputChecks: 64, replacements
		, originalSources: Object.fromEntries(Object.entries(sources).map(([path, source]) => [path, sha256(source)]))
		, instrumentedSources: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)]))
		, probeSourceSha256: sha256(program)
		, isolatedInstrumentedProjection: true, releaseJarUnchanged: true
		, normalExitCleanup: true };
};
