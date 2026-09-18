/**
 * Assemble self-contained Composer ZIPs from verified ordinary native inputs.
 *
 * @file
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { readVerifiedSourceNotices } from "./source-notices.mjs";
import { compiledPackageMetadata, composerPackageMetadata } from "../analyze/package-metadata.mjs";
import { nativeArtifactPaths } from "../build/native-artifacts.mjs";
import { ordinaryPhpEvidence } from "../build/native-php-artifacts.mjs";
import { processBuildRunner } from "../build/process-runner.mjs";
import { generateCopiedPhpPackage } from "../backends/php/copied-values.mjs";
import { validateOrdinaryPhpSettings } from "../backends/php/copied-model.mjs";
import { auditPhpPackage } from "../backends/php/package-audit.mjs";
import { createDeterministicZip } from "./deterministic-zip.mjs";
import { brickMathRequirement } from "../backends/php/brick-math.mjs";

/**
 * Package verified PHP sources and native libraries without a consumer build hook.
 *
 * @param options - Closed native artifacts and Composer coordinates.
 */
export const packageOrdinaryPhp = async options => {
	const { working, nativeRoot, runtimeRoot, adapterRoot, leanPrefix, settings = {}, glibcMinimumVersion, environment = process.env, signal } = options;
	validateOrdinaryPhpSettings(settings);
	if(!/^2\.\d+$/.test(glibcMinimumVersion)) throw new TypeError("Invalid PHP native glibc floor");
	const { model, projection, evidence, receipt } = await ordinaryPhpEvidence(options);
	const name = settings.name ?? `lean-bridge/${projection.surface.prefix.replaceAll("_", "-")}`;
	const version = settings.version ?? (model.component.version === "0.0.0-local" ? "0.0.0" : model.component.version);
	validateOrdinaryPhpSettings({ name, version });
	const root = join(working, "packages/php-native/composer"), files = generateCopiedPhpPackage(model.bindingIr, evidence);
	auditPhpPackage(model.bindingIr, files);
	const save = async (path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes, { flag: "wx" }); };
	const copy = async (source, path) => save(path, await readFile(source));
	for(const [path, source] of Object.entries(files)) await save(path, source);
	for(const file of Object.keys(evidence.libraries))
		await copy(file === evidence.library ? join(adapterRoot, "lib", file) : file === receipt.library ? join(nativeRoot, file) : join(runtimeRoot, "lib", file), `native/linux-x64/${file}`);
	for(const path of ["native-component.json", "model.json", "metadata.json", "binding-ir.json", "generated.lean", "component.h", "artifacts.json"])
		await copy(join(nativeRoot, path), `lean-bridge/component/${path}`);
	if(receipt.sourceIdentity.lakeDependencies?.generatedSourcesSha256 !== undefined) await copy(join(nativeRoot, "lake-generated-sources.json"), "lean-bridge/component/lake-generated-sources.json");
	await copy(join(adapterRoot, "native-c-adapter.json"), "lean-bridge/native-c-adapter.json");
	await copy(join(adapterRoot, `include/${projection.surface.prefix}.h`), `lean-bridge/include/${projection.surface.prefix}.h`);
	await copy(join(runtimeRoot, "runtime.json"), "lean-bridge/runtime.json");
	await copy(join(leanPrefix, "LICENSE"), "licenses/Lean-LICENSE");
	await copy(join(leanPrefix, "LICENSES"), "licenses/Lean-LICENSES");
	for(const [path, bytes] of (await readVerifiedSourceNotices(nativeRoot, model.sourceIdentity)).files) await save(`licenses/${path}`, bytes);
	await copy(fileURLToPath(new URL("../../LICENSE", import.meta.url)), "licenses/LeanBridge-LICENSE");
	const composer = { name, version, type: "library", description: "Compiled Lean API with generated PHP copied-value conversions", ...composerPackageMetadata(compiledPackageMetadata(model.sourceIdentity)), require: { php: ">=8.2 <9", "ext-ffi": "*", ...brickMathRequirement }, autoload: { files: ["src/Api.php"] }, extra: { "lean-bridge": { profile: "ordinary-php-cli-ffi-v1", platform: "linux-x86_64", glibcMinimumVersion, namespace: projection.namespace, licenses: "licenses/" } } };
	await save("composer.json", canonicalJson(composer));
	for(const path of Object.keys(files).filter(path => path.endsWith(".php")))
		await processBuildRunner.capture({ command: environment.LEAN_BRIDGE_PHP ?? "php", args: ["-n", "-l", path], cwd: root, env: environment, signal });
	const inventory = {};
	for(const path of await nativeArtifactPaths(root))
	{ const bytes = await readFile(join(root, path)); inventory[path] = { bytes: bytes.length, sha256: sha256(bytes) }; }
	await save("lean-bridge/package-receipt.json", canonicalJson({ schemaVersion: 1, kind: "lean-bridge-ordinary-php-package", ecosystem: "composer", name, version, namespace: projection.namespace, component: model.component, bindingIrSha256: model.bindingIrSha256, runtimeIdentity: evidence.runtimeIdentity, sourceIdentity: model.sourceIdentity, glibcMinimumVersion, files: inventory }));
	const archive = `${name.replace("/", "-")}-${version}-linux-x86_64.zip`, bytes = await createDeterministicZip({ directory: root, sourceDateEpoch: 315532800 });
	await mkdir(join(working, "archives"), { recursive: true });
	await writeFile(join(working, "archives", archive), bytes, { flag: "wx" });
	return { ecosystem: "php-native", packageFormat: "composer", backend: "ordinary-php-cli-ffi-v1", runtimeIdentity: evidence.runtimeIdentity, glibcMinimumVersion, namespace: projection.namespace, packages: [{ archive, name, version, bytes: bytes.length, sha256: sha256(bytes), compilerAccess: false }] };
};
