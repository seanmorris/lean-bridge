/**
 * Failure probes use a separate instrumented copy of verified Java projection sources.
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
 * Inject errors at conversion/allocation checkpoints and assert every arena closes.
 *
 * @param options - Verified sources, JAR and private ABI indices.
 * @param options.consumer - Task-owned root.
 * @param options.environment - Selected absolute Java tools.
 * @param options.sources - Verified compiler-generated Java sources.
 * @param options.jar - Exact prepared JAR used only for bundled native resources.
 * @param options.projection - Native type indices for buffer checks, not semantic expectations.
 */
export const checkJvmListFaults = async ({ consumer, environment, sources, jar, projection }) => {
	const root = join(consumer, "list-probe"), prefix = "src/main/java/org/leanbridge/lists/", replacements = [];
	const files = { ...sources };
	const replace = (file, pattern, replacement, minimum = 1) => {
		const matches = [...files[file].matchAll(pattern)]; assert.ok(matches.length >= minimum, String(pattern));
		replacements.push(matches.length); files[file] = files[file].replace(pattern, replacement);
	};
	const runtime = `${prefix}Runtime.java`, scope = `${prefix}Scope.java`;
	replace(runtime, /(private static [^\n]+ (?:to|from)\d+\([^\n]*\) \{\n)/g, "$1        ListProbe.check();\n", 100);
	replace(runtime, /Arena arena = Arena\.ofConfined\(\)/g, "Arena arena = ListProbe.arena()", 27);
	for(const file of [runtime, scope]) replace(file, /\b(scope\.arena|arena)\.allocate\(/g, "ListProbe.allocate($1, ");
	replace(runtime, /( {16}int status = \(int\)CALL\d+)/g, "                ListProbe.calls++;\n$1", 27);
	replace(runtime, /finally \{ (CLEAR\d+\.invokeExact\(output\);) \}/g, "finally { ListProbe.clears++; $1 }", 27);
	const probe = `package org.leanbridge.lists;
import java.lang.foreign.*;
final class ListProbe {
    private ListProbe() { }
    static int count, target, calls, clears;
    static final java.util.List<Arena> arenas = new java.util.ArrayList<>();
    static void check() { if (++count == target) throw new OutOfMemoryError("injected conversion failure"); }
    static Arena arena() { var arena = Arena.ofConfined(); try { arenas.add(arena); return arena; } catch (Throwable error) { arena.close(); throw error; } }
    static MemorySegment allocate(Arena arena, long bytes, long alignment) { var value = arena.allocate(bytes, alignment); check(); return value; }
    static void closed() { for (var arena : arenas) if (arena.scope().isAlive()) throw new AssertionError("arena still alive"); }
    static void reset() { closed(); arenas.clear(); count = target = 0; }
}
`;
	const program = await readFile("tests/fixtures/list-consumers/jvm-faults.java", "utf8");
	files[`${prefix}ListProbe.java`] = probe; files[`${prefix}Faults.java`] = program;
	for(const [path, source] of Object.entries(files)) await saveLakeFile(root, path, source);
	await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-d", "classes", ...Object.keys(files)], root);
	const index = field => projection.surface.copy(projection.surface.functions.find(fn => fn.field === field).declaration.result.type).index;
	const temp = join(root, "native-temp"); await mkdir(temp);
	const result = await runCopied(environment.LEAN_BRIDGE_JAVA, ["--enable-native-access=ALL-UNNAMED", `-Djava.io.tmpdir=${temp}`, "-cp", `classes:${jar}`, "org.leanbridge.lists.Faults", String(index("reverse_uint32")), String(index("mix"))], root, copiedCleanEnvironment);
	assert.equal(result.stderr, ""); assert.match(result.stdout, /^list-jvm-faults:\d+:11\n$/);
	assert.deepEqual(await readdir(temp), []);
	const checks = Number(result.stdout.split(":")[1]); assert.ok(checks > 70);
	await rm(root, { recursive: true, force: true });
	return { checks, layoutChecks: 11, partialInputChecks: 16, replacements
		, originalSources: Object.fromEntries(Object.entries(sources).map(([path, source]) => [path, sha256(source)]))
		, instrumentedSources: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)]))
		, probeSourceSha256: sha256(program)
		, isolatedInstrumentedProjection: true, releaseJarUnchanged: true
		, normalExitCleanup: true };
};
