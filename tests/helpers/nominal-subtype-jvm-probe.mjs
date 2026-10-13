/**
 * Compile public API-presence probes against the original installed Maven JAR.
 * Preserve exact child outcomes and diagnostics before interpreting them.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment } from "./copied-fixture-install.mjs";
import { captureCorpusCompiler } from "./type-corpus-compiler.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { nominalSubtypeJvmModes, nominalSubtypeJvmProfiles } from "./nominal-subtype-jvm-fixture.mjs";
import { inspectFinContainerEdgeJvmArchive } from "./fin-container-edge-jvm-closure.mjs";

export const nominalSubtypeJvmInputNames = Object.freeze([
	"first", "second", "combine", "nested", "echo", "aliases", "echoGroups"
	, "echoPair", "inspectAliasPair", "eventFirst", "eventSecond", "echoEvent"
	, "plainFin"
]);
const kotlinInputs = {
	first: "value: Envelope", second: "value: Envelope"
	, combine: "left: Envelope, right: Envelope", nested: "value: EnvelopePair"
	, echo: "value: Envelope"
	, aliases: "left: Array<Option<Envelope>>, right: Array<Option<Envelope>>"
	, echoGroups: "value: Array<Option<Envelope>>", echoPair: "value: AliasPair"
	, inspectAliasPair: "value: AliasPair", eventFirst: "value: Event"
	, eventSecond: "value: Event", echoEvent: "value: Event"
	, plainFin: "value: java.math.BigInteger"
};

/**
 * Reference every input-only public method and the input-only nominal record.
 *
 * @param profile - Java or Kotlin public API.
 */
export const nominalSubtypeJvmProbeSource = profile => {
	assert.ok(nominalSubtypeJvmProfiles.includes(profile));
	if(profile === "java") return "import org.leanbridge.nominalsubtypes.*;\nfinal class Probe {\n"
		+ nominalSubtypeJvmInputNames.map(name => `    static Object ${name}() { return Api.${name}(${["combine", "aliases"].includes(name) ? "null, null" : "null"}); }\n`).join("")
		+ "    static EnvelopePair inputValue;\n}\n";
	return "import org.leanbridge.nominalsubtypes.kotlin.*\n"
		+ nominalSubtypeJvmInputNames.map(name => `fun ${name}(${kotlinInputs[name]}) = Api.${name}(${["combine", "aliases"].includes(name) ? "left, right" : "value"})\n`).join("");
};

/**
 * Require success for full APIs, or exactly the requested missing members for results.
 * Unknown compiler diagnostics never count as a successful negative probe.
 *
 * @param record - Original complete compiler process and output identities.
 * @param profile - Independently selected public API.
 * @param mode - Independently selected package API surface.
 */
export const checkNominalSubtypeJvmProbe = (record, profile, mode) => {
	assert.ok(nominalSubtypeJvmProfiles.includes(profile)); assert.ok(nominalSubtypeJvmModes.includes(mode));
	assert.equal(record.profile, profile); assert.equal(record.mode, mode);
	const source = nominalSubtypeJvmProbeSource(profile);
	assert.equal(record.source, source); assert.equal(record.sourceSha256, sha256(source));
	assert.match(record.archiveSha256, /^[a-f0-9]{64}$/u);
	assert.equal(record.run.stdout, "");
	if(mode === "full")
	{
		assert.equal(record.run.code, 0, record.run.stderr); assert.equal(record.run.stderr, "");
		assert.ok(record.outputs[profile === "java" ? "Probe.class" : "ProbeKt.class"]?.bytes > 0);
		for(const [path, entry] of Object.entries(record.outputs))
		{
			assert.ok(profile === "java" ? path === "Probe.class" : path === "ProbeKt.class" || path === "META-INF/main.kotlin_module");
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "sha256"]);
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes > 0);
			assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
		}
		return;
	}
	assert.equal(record.run.code, 1); assert.deepEqual(record.outputs, {});
	const diagnostics = profile === "java"
		? [...record.run.stderr.matchAll(/^probe\.java:(\d+):(\d+): (compiler\.err\.[^\n]+)$/gmu)]
		: [...record.run.stderr.matchAll(/^probe\.kt:(\d+):(\d+): error: \[([^\]]+)\] ([^\n]+)$/gmu)];
	assert.equal(diagnostics.length, 14, record.run.stderr);
	assert.equal((record.run.stderr.match(profile === "java" ? /compiler\.err\./gu : /error:/gu) ?? []).length, 14);
	assert.doesNotMatch(record.run.stderr, /compiler\.warn\.|warning:/u);
	const expected = [...nominalSubtypeJvmInputNames, "EnvelopePair"], found = [];
	for(const [, lineText, columnText, code, message] of diagnostics)
	{
		const line = Number(lineText), column = Number(columnText), text = profile === "java" ? code : message;
		assert.ok(Number.isSafeInteger(column) && column > 0);
		if(profile === "kotlin") assert.equal(code, "UNRESOLVED_REFERENCE");
		else assert.match(code, /^compiler\.err\.cant\.resolve\.location(?:\.args)?:/u);
		const name = expected.find(name => new RegExp(`\\b${name}\\b`, "u").test(text));
		assert.ok(name, text); found.push(name);
		const marker = name === "EnvelopePair" ? "EnvelopePair" : `Api.${name}(`;
		assert.equal(line, source.split("\n").findIndex(value => value.includes(marker)) + 1);
	}
	assert.deepEqual(found.sort(), expected.sort());
};

/**
 * Probe exact package bytes in an isolated directory, leaving the installation unchanged.
 *
 * @param options - Original archive and explicitly selected compiler paths.
 * @param options.root - Fresh task-owned probe directory.
 * @param options.archive - Original verified Maven JAR bytes.
 * @param options.archiveSha256 - Digest from the verified package-set receipt.
 * @param options.environment - Selected JDK and Kotlin toolchain paths.
 * @param options.profile - Java or Kotlin public API.
 * @param options.mode - Full API or result-only API.
 * @param options.output - Persistent directory for the original probe records.
 */
export const runNominalSubtypeJvmProbe = async ({ root, archive, archiveSha256, environment, profile, mode, output }) => {
	assert.ok(nominalSubtypeJvmProfiles.includes(profile)); assert.ok(nominalSubtypeJvmModes.includes(mode));
	inspectFinContainerEdgeJvmArchive(archive, archiveSha256);
	await assert.rejects(access(root), { code: "ENOENT" }); await mkdir(root, { recursive: true });
	const source = nominalSubtypeJvmProbeSource(profile), name = profile === "java" ? "probe.java" : "probe.kt";
	await saveLakeFile(root, "component.jar", archive); await saveLakeFile(root, name, source); await mkdir(join(root, "classes"));
	const command = profile === "java" ? environment.LEAN_BRIDGE_JAVAC : environment.LEAN_BRIDGE_KOTLINC;
	const args = profile === "java"
		? ["--release", "22", "-Werror", "-proc:none", "-XDrawDiagnostics", "-cp", "component.jar", "-d", "classes", name]
		: ["-Werror", "-jvm-target", "22", "-Xrender-internal-diagnostic-names", "-cp", "component.jar", name, "-d", "classes"];
	const env = profile === "java" ? copiedCleanEnvironment
		: { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin", JAVA_HOME: dirname(dirname(environment.LEAN_BRIDGE_JAVA)) };
	const run = await captureCorpusCompiler(command, args, root, env), outputs = {};
	for(const path of await nativeArtifactPaths(join(root, "classes")))
	{
		const bytes = await readFile(join(root, "classes", path)); outputs[path] = { bytes: bytes.length, sha256: sha256(bytes) };
		await saveLakeFile(output, "classes/" + path, bytes);
	}
	const record = { profile, mode, command, args, cwd: root, environment: env
		, source, sourceSha256: sha256(source), archiveSha256, run, outputs };
	await saveLakeFile(output, name, source); await saveLakeFile(output, "record.json", canonicalJson(record));
	assert.deepEqual(await readFile(join(root, "component.jar")), archive);
	assert.equal(await readFile(join(root, name), "utf8"), source);
	checkNominalSubtypeJvmProbe(record, profile, mode);
	return record;
};
