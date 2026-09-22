/**
 * Verify cleanup through a private instrumented copy, leaving release JARs intact.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { javaCompilerOptions } from "./type-corpus-jvm-tools.mjs";

/**
 * Inject conversion/allocation failures and inspect every arena and output clear.
 *
 * @param options - Original verified sources and the prepared JAR.
 * @param options.consumer - Task-owned isolated consumer directory.
 * @param options.environment - Selected Java tools.
 * @param options.sources - Verified original Java projection sources.
 * @param options.jar - Prepared JAR, used for its bundled native libraries only.
 * @param options.projection - Private converter indices, not expected public values.
 */
export const checkJvmCollectionFaults = async ({ consumer, environment, sources, jar, projection }) => {
	const root = join(consumer, "collection-probe"), prefix = "src/main/java/org/leanbridge/collections/";
	const files = { ...sources }, replacements = [];
	const replace = (file, pattern, replacement, minimum = 1) => {
		const matches = [...files[file].matchAll(pattern)]; assert.ok(matches.length >= minimum, String(pattern));
		replacements.push(matches.length); files[file] = files[file].replace(pattern, replacement);
	};
	const runtime = `${prefix}Runtime.java`, scope = `${prefix}Scope.java`;
	replace(runtime, /(private static [^\n]+ (?:to|from)\d+\([^\n]*\) \{\n)/g, "$1        CollectionProbe.check();\n", 100);
	replace(runtime, /Arena arena = Arena\.ofConfined\(\)/g, "Arena arena = CollectionProbe.arena()", 35);
	for(const file of [runtime, scope]) replace(file, /\b(scope\.arena|arena)\.allocate\(/g, "CollectionProbe.allocate($1, ");
	replace(runtime, /( {16}int status = \(int\)CALL\d+)/g, "                CollectionProbe.calls++;\n$1", 35);
	replace(runtime, /finally \{ (CLEAR\d+\.invokeExact\(output\);) \}/g, "finally { CollectionProbe.clears++; $1 }", 30);
	files[`${prefix}CollectionProbe.java`] = `package org.leanbridge.collections;
import java.lang.foreign.*;
final class CollectionProbe {
    private CollectionProbe() { }
    static int count, target, calls, clears;
    static final java.util.List<Arena> arenas = new java.util.ArrayList<>();
    static void check() { if (++count == target) throw new OutOfMemoryError("injected conversion failure"); }
    static Arena arena() { var arena = Arena.ofConfined(); try { arenas.add(arena); return arena; } catch (Throwable error) { arena.close(); throw error; } }
    static MemorySegment allocate(Arena arena, long bytes, long alignment) { var result = arena.allocate(bytes, alignment); check(); return result; }
    static void closed() { for (var arena : arenas) if (arena.scope().isAlive()) throw new AssertionError("arena still alive"); }
    static void reset() { closed(); arenas.clear(); count = target = calls = clears = 0; }
}
`;
	const program = await readFile("tests/fixtures/collection-consumers/jvm-faults.java", "utf8");
	files[`${prefix}Faults.java`] = program;
	files[`${prefix}Conversions.java`] = (await readFile("tests/fixtures/collection-consumers/jvm-conversions.java", "utf8")).replace("ConversionProbe.class", "Runtime.class");
	for(const [path, source] of Object.entries(files)) await saveLakeFile(root, path, source);
	await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-d", "classes", ...Object.keys(files)], root);
	const temp = join(root, "native-temp"); await mkdir(temp);
	const args = ["--enable-native-access=ALL-UNNAMED", `-Djava.io.tmpdir=${temp}`, "-cp", `classes:${jar}`];
	const run = await runCopied(environment.LEAN_BRIDGE_JAVA, [...args, "org.leanbridge.collections.Faults"], root);
	assert.equal(run.stderr, ""); const observation = JSON.parse(run.stdout);
	assert.ok(observation.checkpoints > 250); assert.equal(observation.partialInputs, 64);
	assert.equal(observation.allArenasClosed, true); assert.equal(observation.outputsClearedExactlyOnce, true);
	assert.deepEqual(await readdir(temp), []);
	const scalar = name => projection.surface.copies.find(copy => copy.scalarName === name);
	const fn = name => projection.surface.copy(projection.surface.functions.find(fn => fn.publicName === name).declaration.result.type);
	const indices = ["unit", "bool", "char", "string", "bytes", "nat", "int"].map(scalar).concat(fn("arrayReverseUint32").element, fn("deep")).map(copy => String(copy.index));
	const conversions = await runCopied(environment.LEAN_BRIDGE_JAVA, [...args, "org.leanbridge.collections.Conversions", ...indices], root);
	assert.equal(conversions.stderr, ""); const malformed = JSON.parse(conversions.stdout);
	assert.ok(malformed.rejected > 500); assert.deepEqual(await readdir(temp), []);
	await rm(root, { recursive: true, force: true });
	return { ...observation, malformed
		, replacements, isolatedInstrumentedProjection: true
		, releaseJarUnchanged: true, normalExitCleanup: true
		, probeSourceSha256: sha256(program)
		, originalSources: Object.fromEntries(Object.entries(sources).map(([path, source]) => [path, sha256(source)]))
		, instrumentedSources: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)])) };
};
