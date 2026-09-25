/**
 * Isolated JVM conversion failures over the original installed native libraries.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { compileJvmSources } from "../../src/build/compile-jvm-sources.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { jvmRun } from "./type-corpus-jvm-tools.mjs";
import { copiedCleanEnvironment } from "./copied-fixture-install.mjs";

/**
 * Inject at conversion boundaries and allocation/acquisition sites, not cleanup.
 *
 * @param sources - Verified installed source files, never modified in place.
 */
export const instrumentJvmStructuredCallables = sources => {
	const files = { ...sources }, replacements = {};
	const prefix = "src/main/java/org/leanbridge/structured/";
	const replace = (file, name, pattern, replacement, expected) => {
		const matches = [...files[file].matchAll(pattern)];
		if(expected !== undefined) assert.equal(matches.length, expected, `${file}: ${name}`);
		else assert.ok(matches.length, `${file}: ${name}`);
		replacements[`${file}:${name}`] = matches.length;
		files[file] = files[file].replace(pattern, replacement);
	};
	for(const name of ["Runtime", "KotlinRuntime"])
	{
		const file = `${prefix}${name}.java`;
		replace(file, "conversions", / {4}private static ([^\n]+?) ((?:to|from)\d+)\(([^\n]*)\) \{\n/g, (_match, type, method, parameters) => {
			const args = parameters.endsWith(", Scope scope") ? "value, scope" : "value";
			return `    private static ${type} ${method}(${parameters}) {
        StructuredProbe.tick();
        var converted = core${method}(${args});
        StructuredProbe.tick(); return converted;
    }
    private static ${type} core${method}(${parameters}) {
`;
		}, 50);
		replace(file, "arenas", /Arena arena = Arena\.ofConfined\(\)/g, "Arena arena = StructuredProbe.arena()");
		// The lease's ADDRESS allocation belongs to disposal, not conversion.
		replace(file, "allocations", /\b(scope\.arena|arena)\.allocate\((?!ADDRESS\))/g, "StructuredProbe.allocate($1, ");
		replace(file, "calls", /( {16}int status = \(int\)(?:CALL|OWNED)\d+)/g, "                StructuredProbe.calls++;\n$1", 40);
		replace(file, "clears", /finally \{ ((?:CLEAR|DROP)\d+\.invokeExact\(output\);) \}/g, "finally { $1 StructuredProbe.cleared(output); }", 40);
		replace(file, "hosts", /UPCALL(\d+)\.bindTo\(new Host\1\(callback, scope, frame\)\)/g, "UPCALL$1.bindTo(StructuredProbe.host(new Host$1(callback, scope, frame)))", 14);
		replace(file, "stubs", /(var stub = Linker\.nativeLinker\(\)\.upcallStub\([^\n]+;)/g, "$1\n        StructuredProbe.tick();", 14);
		replace(file, "leases", /(var lease = new ClosureLease\(DROP\d+\);)/g, "StructuredProbe.tick(); $1 StructuredProbe.tick();", 14);
		replace(file, "adoption", /lease\.adopt\(output\); return result;/g, "StructuredProbe.tick(); lease.adopt(output); return result;", 14);
	}
	replace(`${prefix}Runtime.java`, "registration", /return CLEANER\.register\(owner, lease\);/g,
		"StructuredProbe.tick(); var cleanable = CLEANER.register(owner, lease); StructuredProbe.tick(); return cleanable;", 1);
	replace(`${prefix}Runtime.java`, "disposal", /release\.invokeExact\(output\); pointer = 0;/g,
		"release.invokeExact(output); StructuredProbe.disposed(output); pointer = 0;", 1);
	replace(`${prefix}Scope.java`, "allocations", /\barena\.allocate\(/g, "StructuredProbe.allocate(arena, ", 1);
	return { files, replacements };
};

/**
 * Run both separately instrumented projections against their unchanged JAR.
 *
 * @param options - Verified installed files and task-owned scratch paths.
 * @param options.root - Private consumer project root.
 * @param options.sources - Verified original generated source map.
 * @param options.jar - Installed original archive, only used for bundled resources.
 * @param options.environment - Explicit JVM compiler tools.
 * @param options.tools - Selected Java executable.
 * @param options.classpath - Offline-resolved installed dependencies.
 * @param options.projection - Independent layout indices for malformed-value probes.
 */
export const checkJvmStructuredFaults = async ({ root, sources, jar, environment, tools, classpath, projection }) => {
	const directory = join(root, "structured-probes"), originalHash = sha256(await readFile(jar));
	const instrumented = instrumentJvmStructuredCallables(sources), files = instrumented.files;
	const prefix = "src/main/java/org/leanbridge/structured/";
	const runtime = await readFile("tests/fixtures/structured-callable-consumers/jvm-probe.java", "utf8");
	const program = await readFile("tests/fixtures/structured-callable-consumers/jvm-faults.java", "utf8");
	const javaValues = await readFile("tests/fixtures/structured-callable-consumers/java-values.java", "utf8");
	const kotlinValues = await readFile("tests/fixtures/structured-callable-consumers/kotlin-values.kt", "utf8");
	files[`${prefix}StructuredProbe.java`] = runtime;
	files[`${prefix}StructuredFaults.java`] = program;
	files[`${prefix}StructuredValues.java`] = "package org.leanbridge.structured;\n" + javaValues;
	files["src/main/kotlin/org/leanbridge/structured/kotlin/StructuredValues.kt"] = "package org.leanbridge.structured.kotlin\n" + kotlinValues;
	try
	{
		for(const [path, source] of Object.entries(files)) await saveLakeFile(directory, path, source);
		await compileJvmSources({ root: directory, files, environment });
		const index = shape => projection.surface.copy(projection.surface.functions.find(fn => fn.field === `call_${shape}`).declaration.result.type).index;
		const indices = ["option", "result", "variant", "array", "list"].map(index);
		const temp = join(directory, "native-temp"); await mkdir(temp);
		const runs = [];
		for(const profile of ["java", "kotlin"])
		{
			const result = await jvmRun(tools.java, ["--enable-native-access=ALL-UNNAMED", `-Djava.io.tmpdir=${temp}`, "-cp", `classes:${classpath}`, "org.leanbridge.structured.StructuredFaults", profile, ...indices.map(String)], directory, copiedCleanEnvironment);
			assert.equal(result.stderr, ""); assert.deepEqual(await readdir(temp), []);
			const record = JSON.parse(result.stdout); assertJvmStructuredFaults(record);
			runs.push(record);
		}
		assert.equal(sha256(await readFile(jar)), originalHash);
		return { runs, replacements: instrumented.replacements
			, originalSources: Object.fromEntries(Object.entries(sources).map(([path, source]) => [path, sha256(source)]))
			, instrumentedSources: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)]))
			, probeSourceSha256: sha256(runtime), programSourceSha256: sha256(program)
			, javaValuesSha256: sha256(javaValues)
			, kotlinValuesSha256: sha256(kotlinValues)
			, archiveSha256: originalHash, isolatedInstrumentedProjection: true
			, originalNativeLibraries: true, releaseJarUnchanged: true
			, normalExitCleanup: true };
	}
	finally
	{
		await rm(directory, { recursive: true, force: true });
	}
};

/**
 * Require both failure classes at all five paths for every copied shape.
 *
 * @param record - One Java or Kotlin isolated execution.
 */
export const assertJvmStructuredFaults = record => {
	assert.ok(["java", "kotlin"].includes(record.profile));
	assert.equal(record.liveIdentities, 0); assert.equal(record.openArenas, 0);
	assert.equal(record.liveHosts, 0);
	assert.equal(record.malformed, 15); assert.equal(record.deferredCloseChecks, 8);
	assert.deepEqual(record.shapes.map(value => value.shape), ["array", "list", "option", "result", "tuple", "record", "variant", "alias"]);
	let faults = 0;
	for(const entry of record.shapes)
	{
		assert.deepEqual(Object.keys(entry.paths).sort(), ["callback", "create", "create-call", "held-call", "repeated"]);
		const counts = Object.values(entry.paths);
		assert.ok(counts.every(value => Number.isInteger(value) && value > 0));
		assert.equal(entry.faults, 2 * counts.reduce((sum, value) => sum + value, 0));
		faults += entry.faults;
	}
	assert.equal(record.faults, faults); assert.ok(record.checks > faults);
	assert.ok(record.clears > 0 && record.disposals > 0);
};
