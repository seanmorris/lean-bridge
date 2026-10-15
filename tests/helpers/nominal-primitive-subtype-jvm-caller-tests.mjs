/**
 * Compile the nineteen-base Java and Kotlin callers against the genuine generated APIs and run them
 * against an independent Java stand-in whose named mutations must each fail. No Lean compilation and
 * no installed package execution happen here; installed acceptance is a separate producer run.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readFile } from "node:fs/promises";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { createDeterministicZip } from "../../src/release/deterministic-zip.mjs";
import { runNominalPrimitiveSubtypeJvmProbe, runNominalPrimitiveSubtypeKotlinNullProbe } from "./nominal-primitive-subtype-jvm-probe.mjs";
import { generateCopiedJvmKotlinPackage } from "../../src/backends/jvm/copied-kotlin.mjs";
import { compileJvmSources } from "../../src/build/compile-jvm-sources.mjs";
import { nominalPrimitiveSubtypeJvmCaller, nominalPrimitiveSubtypeJvmModel, nominalPrimitiveSubtypeJvmProfiles, nominalPrimitiveSubtypeJvmReview, parseNominalPrimitiveSubtypeJvmResult } from "./nominal-primitive-subtype-jvm-fixture.mjs";
import { nativeFixtureEnvironment, runCopied, copiedCleanEnvironment } from "./copied-fixture-install.mjs";
import { captureCorpusCompiler } from "./type-corpus-compiler.mjs";
import { waitNominalSubtypeDotnetResources } from "./nominal-subtype-dotnet-resources.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const flag = process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_CALLER_TEST;
assert.ok(flag === undefined || flag === "0" || flag === "1");
/** Shared mutations exercise the producers and host conversions; the full API adds the selections. */
export const nominalPrimitiveSubtypeJvmMutants = Object.freeze({
	shared: Object.freeze(["word-bits", "produce-lenient", "produce-digit", "missing-group", "pair-left-empty", "missing-event-value", "wrong-choice-tag", "negative-nat", "uint8-range", "surrogate-char", "lone-surrogate", "usize-range"])
	, full: Object.freeze(["echo-a", "echo-b", "refuse-unit", "combine", "wrong-error-path", "fin-after-subtype", "mutate-accepted-input", "mutate-rejected-input", "float-sign", "late-fin"])
});

const syntheticArchive = async root => {
	const payload = join(root, "synthetic-payload"), files = {};
	for(const path of await nativeArtifactPaths(join(root, "classes")))
	{
		const bytes = await readFile(join(root, "classes", path));
		await saveLakeFile(payload, path, bytes); files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
	}
	const manifest = "Manifest-Version: 1.0\n\n";
	await saveLakeFile(payload, "META-INF/MANIFEST.MF", manifest);
	files["META-INF/MANIFEST.MF"] = { bytes: Buffer.byteLength(manifest), sha256: sha256(manifest) };
	await saveLakeFile(payload, "META-INF/lean-bridge/package-receipt.json", canonicalJson({
		schemaVersion: 1, kind: "lean-bridge-ordinary-maven-package"
		, ecosystem: "maven", syntheticOnly: true, files
	}));
	return createDeterministicZip({ directory: payload, sourceDateEpoch: 315532800 });
};

const compileCaller = async (root, profile, classpath, target, environment) => {
	await mkdir(join(root, target));
	if(profile === "java") return runCopied(environment.LEAN_BRIDGE_JAVAC
		, ["--release", "22", "-Werror", "-proc:none", "-cp", classpath, "-d", target, "consumer.java"], root);
	return runCopied(environment.LEAN_BRIDGE_KOTLINC
		, ["-Werror", "-jvm-target", "22", "-cp", classpath, "consumer.kt", "-include-runtime", "-d", target + "/consumer.jar"]
		, root, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin", JAVA_HOME: dirname(dirname(environment.LEAN_BRIDGE_JAVA)) });
};

test("primitive-base JVM callers compile against genuine APIs and reject every independent faulty model", {
	skip: flag !== "1", timeout: 2_400_000
}, async t => {
	const environment = nativeFixtureEnvironment(["java", "kotlin"]);
	const stdlib = join(dirname(dirname(environment.LEAN_BRIDGE_KOTLINC)), "lib/kotlin-stdlib.jar");
	let callers = 0, controls = 0, probes = 0, nullProbes = 0;
	for(const mode of ["full", "result-only"])
	{
		await waitNominalSubtypeDotnetResources("build", { notify: message => t.diagnostic(message) });
		const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-primitive-jvm-caller-controls-"));
		let complete = false;
		try
		{
			const files = generateCopiedJvmKotlinPackage(nominalPrimitiveSubtypeJvmReview(mode));
			for(const [path, source] of Object.entries(files)) await saveLakeFile(root, path, source);
			const compilation = await compileJvmSources({ root, files, environment });
			await saveLakeFile(root, "compilation.json", canonicalJson(compilation));
			const archive = await syntheticArchive(root);
			for(const invalid of [false, true])
			{
				await runNominalPrimitiveSubtypeKotlinNullProbe({ root: join(root, `nullability-${invalid}`)
					, archive, archiveSha256: sha256(archive), environment, mode, invalid
					, output: join(root, `nullability-${invalid}-records`) });
				nullProbes++;
			}
			for(const profile of nominalPrimitiveSubtypeJvmProfiles)
			{
				await runNominalPrimitiveSubtypeJvmProbe({ root: join(root, `api-${profile}`)
					, archive, archiveSha256: sha256(archive), environment, profile, mode
					, output: join(root, `api-${profile}-records`) });
				probes++;
				const model = await nominalPrimitiveSubtypeJvmModel(profile, mode), modelPath = `model-${profile}/Api.java`, modelClasses = `model-${profile}-classes`;
				await saveLakeFile(root, modelPath, model); await mkdir(join(root, modelClasses));
				await runCopied(environment.LEAN_BRIDGE_JAVAC, ["--release", "22", "-Werror", "-proc:none", "-cp", `classes:${stdlib}`, "-d", modelClasses, modelPath], root);
				for(const route of ["ordinary", "reviewed"])
				{
					const source = await nominalPrimitiveSubtypeJvmCaller(profile, route, mode), extension = profile === "java" ? "java" : "kt";
					await saveLakeFile(root, `consumer.${extension}`, source);
					await compileCaller(root, profile, "classes", `genuine-${profile}-${route}`, environment);
					const classpath = `${modelClasses}:classes`, target = `model-${profile}-${route}`;
					await compileCaller(root, profile, classpath, target, environment);
					const args = ["-cp"
						, `${classpath}:${profile === "java" ? target : target + "/consumer.jar"}`
						, profile === "java" ? "Consumer" : "ConsumerKt"];
					const env = { ...copiedCleanEnvironment, NOMINAL_JVM_ROUTE: route };
					const accepted = await runCopied(environment.LEAN_BRIDGE_JAVA, args, root, env);
					assert.equal(accepted.stderr, ""); parseNominalPrimitiveSubtypeJvmResult(accepted.stdout, profile, mode);
					await saveLakeFile(root, `${profile}-${route}-accepted.json`, canonicalJson(accepted));
					callers++;
					const mutants = [...nominalPrimitiveSubtypeJvmMutants.shared, ...mode === "full" ? nominalPrimitiveSubtypeJvmMutants.full : []];
					for(const mutant of mutants)
					{
						const failed = await captureCorpusCompiler(environment.LEAN_BRIDGE_JAVA, args, root, { ...env, NOMINAL_JVM_MUTANT: mutant });
						await saveLakeFile(root, `${profile}-${route}-${mutant}.json`, canonicalJson(failed));
						assert.equal(failed.code, 1, `${profile}/${route}/${mode}/${mutant}`);
						assert.equal(failed.stdout, ""); assert.match(failed.stderr, /AssertionError: (?:failed:|accepted:)/u);
						controls++;
					}
					t.diagnostic(`${profile} ${route} ${mode}: genuine API compiled; ${mutants.length} synthetic caller controls passed`);
				}
			}
			complete = true;
		}
		finally
		{
			if(complete) await rm(root, { recursive: true });
			else t.diagnostic(`Retained failed source-only primitive JVM controls: ${root}`);
		}
	}
	assert.equal(callers, 8); assert.equal(controls, 136); assert.equal(probes, 4); assert.equal(nullProbes, 4);
	t.diagnostic("Eight genuine caller compilations, 136 synthetic mutations, four API probes and four nullability/control compilations; no Lean or installed execution");
});
