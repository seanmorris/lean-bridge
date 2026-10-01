/**
 * Source-free Composer releases with authenticated ownership-aware native APIs.
 *
 * @file
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { compiledPackageMetadata, composerPackageMetadata } from "../analyze/package-metadata.mjs";
import { generateOwnedPhpPackage, auditOwnedPhpPackage } from "../backends/php/owned-package.mjs";
import { validateOrdinaryPhpSettings } from "../backends/php/copied-model.mjs";
import { brickMathRequirement } from "../backends/php/brick-math.mjs";
import { nativeArtifactPaths } from "../build/native-artifacts.mjs";
import { ownedPhpEvidence } from "../build/owned-php-artifacts.mjs";
import { processBuildRunner } from "../build/process-runner.mjs";
import { readVerifiedSourceNotices } from "./source-notices.mjs";
import { createDeterministicZip } from "./deterministic-zip.mjs";

/**
 * Reverify sources and native identities, then package without install scripts.
 *
 * @param options - Artifact roots, producer environment and Composer settings.
 */
export const packageOwnedPhp = async options => {
	const { working, nativeRoot, runtimeRoot, adapterRoot, leanPrefix, settings = {}, glibcMinimumVersion, environment = process.env, signal } = options;
	validateOrdinaryPhpSettings(settings);
	if(!/^2\.\d+$/u.test(glibcMinimumVersion)) throw new TypeError("Invalid PHP native glibc floor");
	const { model, receipt, evidence, adapter, libraryPaths } = await ownedPhpEvidence(options);
	const transferredInputs = Boolean(model.ownedGraph.inputTransfers);
	const anchoredResults = Boolean(model.ownedGraph.resultAnchors);
	const generated = generateOwnedPhpPackage(model.bindingIr, evidence, { transferredInputs, anchoredResults }), prefix = generated.c.prefix;
	auditOwnedPhpPackage(model.bindingIr, generated.files, { transferredInputs, anchoredResults });
	const name = settings.name ?? `lean-bridge/${prefix.replaceAll("_", "-")}`;
	const version = settings.version ?? (model.component.version === "0.0.0-local" ? "0.0.0" : model.component.version);
	validateOrdinaryPhpSettings({ name, version });
	const root = join(working, "packages/php-native/composer");
	const save = async (path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes, { flag: "wx" }); };
	const copy = async (source, path) => save(path, await readFile(source));
	for(const [path, source] of Object.entries(generated.files)) await save(path, source);
	for(const [name, path] of Object.entries(libraryPaths)) await copy(path, `native/linux-x64/${name}`);
	for(const path of ["native-component.json", "model.json", "metadata.json", "binding-ir.json", "generated.lean", "component.h", "allocation-guard.h", "artifacts.json", "callbacks.c"])
		await copy(join(nativeRoot, path), `lean-bridge/component/${path}`);
	if(receipt.sourceIdentity.lakeDependencies?.generatedSourcesSha256 !== undefined)
	{
		const bytes = await readFile(join(nativeRoot, "lake-generated-sources.json"));
		if(sha256(bytes) !== receipt.sourceIdentity.lakeDependencies.generatedSourcesSha256) throw new Error("Owned PHP generated Lean inputs differ from compilation");
		await save("lean-bridge/component/lake-generated-sources.json", bytes);
	}
	await copy(join(adapterRoot, "native-php-adapter.json"), "lean-bridge/native-php-adapter.json");
	for(const path of Object.keys(adapter.files).filter(path => !path.startsWith("lib/") && !path.startsWith("gmp/lib/")))
		await copy(join(adapterRoot, path), `lean-bridge/adapter/${path}`);
	await copy(join(runtimeRoot, "runtime.json"), "lean-bridge/runtime.json");
	await copy(join(leanPrefix, "LICENSE"), "licenses/Lean-LICENSE");
	await copy(join(leanPrefix, "LICENSES"), "licenses/Lean-LICENSES");
	await copy(new URL("../../LICENSE", import.meta.url), "licenses/LeanBridge-LICENSE");
	for(const [path, bytes] of (await readVerifiedSourceNotices(nativeRoot, model.sourceIdentity)).files) await save(`licenses/${path}`, bytes);
	const composer = { name, version, type: "library"
		, description: "Compiled Lean API with checked resource-bearing PHP values"
		, ...composerPackageMetadata(compiledPackageMetadata(model.sourceIdentity))
		, require: { php: ">=8.2 <9", "ext-ffi": "*", ...brickMathRequirement }
		, autoload: { files: ["src/Api.php"] }
		, extra: { "lean-bridge": { profile: "owned-php-cli-ffi-v1", platform: "linux-x86_64", glibcMinimumVersion, namespace: generated.namespace, licenses: "licenses/" } } };
	await save("composer.json", canonicalJson(composer));
	for(const path of Object.keys(generated.files).filter(path => path.endsWith(".php")))
		await processBuildRunner.capture({ command: environment.LEAN_BRIDGE_PHP ?? "php", args: ["-n", "-l", path], cwd: root, env: environment, signal });
	const files = {};
	for(const path of await nativeArtifactPaths(root))
	{ const bytes = await readFile(join(root, path)); files[path] = { bytes: bytes.length, sha256: sha256(bytes) }; }
	await save("lean-bridge/package-receipt.json", canonicalJson({ schemaVersion: 1
		, kind: "lean-bridge-owned-php-package", ecosystem: "composer", name, version
		, namespace: generated.namespace, component: model.component
		, bindingIrSha256: model.bindingIrSha256
		, runtimeIdentity: evidence.runtimeIdentity
		, sourceIdentity: model.sourceIdentity
		, glibcMinimumVersion, ownedValues: generated.contract, files }));
	const archive = `${name.replace("/", "-")}-${version}-linux-x86_64.zip`;
	const bytes = await createDeterministicZip({ directory: root, sourceDateEpoch: 315532800 });
	await mkdir(join(working, "archives"), { recursive: true });
	await writeFile(join(working, "archives", archive), bytes, { flag: "wx" });
	return { ecosystem: "php-native", packageFormat: "composer"
		, backend: "owned-php-cli-ffi-v1"
		, runtimeIdentity: evidence.runtimeIdentity, glibcMinimumVersion
		, namespace: generated.namespace
		, packages: [{ archive, name, version, bytes: bytes.length, sha256: sha256(bytes), compilerAccess: false }] };
};
