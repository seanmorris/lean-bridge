/**
 * Compile generated Java once before compiler-free Maven packaging.
 *
 * @file
 */
import { generateCallableJvmGraphPackage } from "../backends/jvm/callable-graph-package.mjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generateCopiedJvmKotlinPackage } from "../backends/jvm/copied-kotlin.mjs";
import { generateCopiedJvmGraphPackage } from "../backends/jvm/copied-graph-package.mjs";
import { auditManagedBindingPackage } from "../backends/managed/package-audit.mjs";
import { nativeArtifactPaths } from "./native-artifacts.mjs";
import { ordinaryJvmEvidence } from "./native-jvm-artifacts.mjs";
import { compileJvmSources } from "./compile-jvm-sources.mjs";
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
	const root = join(working, "native/jvm");
	const files = model.copiedGraph ? (model.copiedGraph.callbacks ? generateCallableJvmGraphPackage : generateCopiedJvmGraphPackage)(model.bindingIr, evidence) : generateCopiedJvmKotlinPackage(model.bindingIr, evidence);
	auditManagedBindingPackage(model.bindingIr, files, "jvm");
	for(const [path, contents] of Object.entries(files))
	{ await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), contents, { flag: "wx" }); }
	const compilers = await compileJvmSources({ root, files, environment, signal });
	const inventory = {};
	for(const path of await nativeArtifactPaths(root))
	{ const bytes = await readFile(join(root, path)); inventory[path] = { bytes: bytes.length, sha256: sha256(bytes) }; }
	await writeFile(join(root, "native-jvm.json"), canonicalJson({ schemaVersion: 1, profile: "native-library-v1", bindingIrSha256: model.bindingIrSha256, evidence, ...compilers, namespace: projection.namespace, files: inventory }), { flag: "wx" });
	return packageOrdinaryMaven({ working, jvmRoot: root, nativeRoot, runtimeRoot, adapterRoot, leanPrefix, settings, glibcMinimumVersion });
};
