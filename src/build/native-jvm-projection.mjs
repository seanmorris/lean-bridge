/**
 * Compile generated Java once before compiler-free Maven packaging.
 *
 * @file
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generateCopiedJvmPackage } from "../backends/jvm/copied-values.mjs";
import { auditManagedBindingPackage } from "../backends/managed/package-audit.mjs";
import { nativeArtifactPaths } from "./native-artifacts.mjs";
import { ordinaryJvmEvidence } from "./native-jvm-artifacts.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { packageOrdinaryMaven } from "../release/native-maven.mjs";

/**
 * Compile generated Java against an isolated classpath and package its outputs.
 *
 * @param options - Private staging, verified native roots, compiler environment and target settings.
 * @param options.working - Private release staging directory.
 * @param options.nativeRoot - Verified native component artifacts.
 * @param options.runtimeRoot - Verified shared native runtime.
 * @param options.adapterRoot - Verified C adapter artifacts.
 * @param options.leanPrefix - Lean compiler license notices.
 * @param options.settings - Optional Maven coordinate and version.
 * @param options.glibcMinimumVersion - Validated Linux ABI floor.
 * @param options.environment - Explicit compiler environment.
 * @param options.signal - Optional cancellation signal.
 */
export const projectOrdinaryJvm = async ({ working, nativeRoot, runtimeRoot, adapterRoot, leanPrefix, settings, glibcMinimumVersion, environment, signal }) => {
	const { model, projection, evidence } = await ordinaryJvmEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	const root = join(working, "native/jvm"), files = generateCopiedJvmPackage(model.bindingIr, evidence);
	auditManagedBindingPackage(model.bindingIr, files, "jvm");
	for(const [path, contents] of Object.entries(files))
	{ await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), contents, { flag: "wx" }); }
	const env = { ...environment };
	for(const key of ["CLASSPATH", "JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS", "JDK_JAVAC_OPTIONS", "_JAVA_OPTIONS"]) delete env[key];
	const run = args => processBuildRunner.capture({ command: environment.LEAN_BRIDGE_JAVAC ?? "javac", args, cwd: root, env, signal });
	const versionResult = await run(["-version"]), version = (versionResult.stdout || versionResult.stderr).trim();
	if(!/^javac 22(?:[.+ -]|$)/.test(version)) throw new Error("Ordinary Maven packages require the Java 22 compiler");
	await mkdir(join(root, "empty-classpath"));
	await run(["--release", "22", "-g:none", "-proc:none", "-encoding", "UTF-8", "-classpath", "empty-classpath", "-sourcepath", "src/main/java", "-d", "classes", ...Object.keys(files).filter(path => path.endsWith(".java")).sort()]);
	const inventory = {};
	for(const path of await nativeArtifactPaths(root))
	{ const bytes = await readFile(join(root, path)); inventory[path] = { bytes: bytes.length, sha256: sha256(bytes) }; }
	await writeFile(join(root, "native-jvm.json"), canonicalJson({ schemaVersion: 1, profile: "native-library-v1", bindingIrSha256: model.bindingIrSha256, evidence, compiler: version, namespace: projection.namespace, files: inventory }), { flag: "wx" });
	return packageOrdinaryMaven({ working, jvmRoot: root, nativeRoot, runtimeRoot, adapterRoot, leanPrefix, settings, glibcMinimumVersion });
};
