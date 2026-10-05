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
 * @param options.profile - Java or the metadata-backed Kotlin projection.
 * @param options.dependencies - Verified prepared Maven dependency closure for Kotlin.
 * @param options.handoff - Directory containing that dependency archive.
 */
export const checkJvmCollectionFaults = async ({ consumer, environment, sources, jar, projection, profile = "java", dependencies, handoff }) => {
	assert.ok(["java", "kotlin"].includes(profile));
	const kotlin = profile === "kotlin", runtimeName = kotlin ? projection.helpers.runtime : "Runtime";
	const root = join(consumer, kotlin ? "collection-kotlin-probe" : "collection-probe"), prefix = "src/main/java/org/leanbridge/collections/";
	const files = { ...sources }, replacements = [];
	const replace = (file, pattern, replacement, minimum = 1) => {
		const matches = [...files[file].matchAll(pattern)]; assert.ok(matches.length >= minimum, String(pattern));
		replacements.push(matches.length); files[file] = files[file].replace(pattern, replacement);
	};
	const runtime = `${prefix}${runtimeName}.java`, scope = `${prefix}Scope.java`;
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
	let program = await readFile("tests/fixtures/collection-consumers/jvm-faults.java", "utf8");
	const classpath = [jar];
	if(kotlin)
	{
		// Compile against the original Kotlin classes and its declared Maven runtime.
		// Only the private converters and shared Scope are instrumented.
		const archive = join(handoff, dependencies.archive);
		assert.equal(sha256(await readFile(archive)), dependencies.sha256);
		await mkdir(root, { recursive: true });
		const libraries = Object.keys(dependencies.files).filter(path => /^org\/jetbrains\/(?:kotlin\/kotlin-stdlib|annotations)\//.test(path) && path.endsWith(".jar"));
		assert.ok(libraries.includes("org/jetbrains/kotlin/kotlin-stdlib/2.2.0/kotlin-stdlib-2.2.0.jar"));
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", archive, "-C", root, ...libraries.map(path => `repository/${path}`)], consumer);
		for(const path of libraries)
		{
			const library = join(root, "repository", path);
			assert.equal(sha256(await readFile(library)), dependencies.files[path].sha256); classpath.push(library);
		}
		const names = ["Api", "Primitives", "Packet", "Empty", "Single", "Count", "Pair", "Reversed"];
		program = program.replace("import java.math.BigInteger;", `import java.math.BigInteger;\n${names.map(name => `import org.leanbridge.collections.kotlin.${name};`).join("\n")}`)
			.replace("check(count > 0);", "check(count > 0); check(CollectionProbe.calls == 1); check(CollectionProbe.clears == 1);");
	}
	files[`${prefix}Faults.java`] = program;
	files[`${prefix}Conversions.java`] = (await readFile("tests/fixtures/collection-consumers/jvm-conversions.java", "utf8")).replace("ConversionProbe.class", `${runtimeName}.class`);
	for(const [path, source] of Object.entries(files)) await saveLakeFile(root, path, source);
	await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, ...kotlin ? ["-classpath", classpath.join(":")] : [], "-d", "classes", ...Object.keys(files)], root);
	const temp = join(root, "native-temp"); await mkdir(temp);
	const args = ["--enable-native-access=ALL-UNNAMED", `-Djava.io.tmpdir=${temp}`, "-cp", `classes:${classpath.join(":")}`];
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
		, ...kotlin ? { profile, runtime: runtimeName, compiledKotlinApiFromOriginalJar: true } : {}
		, replacements, isolatedInstrumentedProjection: true
		, releaseJarUnchanged: true, normalExitCleanup: true
		, probeSourceSha256: sha256(program)
		, originalSources: Object.fromEntries(Object.entries(sources).map(([path, source]) => [path, sha256(source)]))
		, instrumentedSources: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)])) };
};
