/**
 * Implements the component npm package module in the release subsystem.
 *
 * @file
 */

import { createHash } from "node:crypto";
import {
	copyFile,
	mkdir,
	readFile,
	readdir,
	writeFile,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import { generateJavaScriptPackage } from "../backends/javascript/generate.mjs";
import { canonicalJson } from "../capsule/node.mjs";
import { validateComponentReleaseBundleManifest } from "./component-release-bundle.mjs";
import { createDeterministicTarGz } from "./deterministic-archive.mjs";
import { assertComponentSignature, componentScalarAbi } from "../abi/component-scalars.mjs";
import { assertExportConfigurationCapabilities, assertExportConfigurationSnapshot, readExportConfiguration } from "../analyze/export-configuration.mjs";
import { componentNpmIdentity, validateComponentPackageReceipt } from "./component-package-receipt.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const json = value => `${JSON.stringify(value, null, 2)}\n`;

const ensureEmpty = async output => {
	await mkdir(output, { recursive: true });
	if((await readdir(output)).length !== 0) throw new Error(`component npm output is not empty: ${output}`);
};

const copy = async (source, destination) => {
	await mkdir(dirname(destination), { recursive: true });
	await copyFile(source, destination);
};

const verifiedBundle = async bundleRoot => {
	const root = resolve(bundleRoot);
	const manifest = JSON.parse(await readFile(join(root, "component-release-bundle.json"), "utf8"));
	validateComponentReleaseBundleManifest(manifest);
	for(const item of manifest.files)
	{
		const bytes = await readFile(join(root, item.path));
		if(bytes.length !== item.bytes || sha256(bytes) !== item.sha256)
		{
			throw new Error(`component bundle file differs from its manifest: ${item.path}`);
		}
	}
	return Object.freeze({ root, manifest: Object.freeze(manifest), manifestSha256: sha256(canonicalJson(manifest)) });
};

const runtimeModule = () => `import createMain from "./internal/main.mjs";
import { createComponentRuntime } from "./internal/component-runtime.mjs";
export const { loadComponent } = await createComponentRuntime(createMain, new URL("./internal/main.wasm", import.meta.url));
`;

const descriptorModule = ({ manifest, ir, abi, artifact, initializer }) => `const sideModule = new URL(${JSON.stringify(`./wasm/${basename(artifact.path)}`)}, import.meta.url);

export default Object.freeze({
  schemaVersion: 1,
  id: ${JSON.stringify(manifest.component.id)},
  buildHash: ${JSON.stringify(manifest.identitySha256)},
  integrity: ${JSON.stringify(artifact.sha256)},
  initializer: ${JSON.stringify(initializer)},
  sideModule,
  bindingIr: Object.freeze(${JSON.stringify(ir)}),
  privateAbi: Object.freeze(${JSON.stringify(abi)}),
});
`;

const componentRuntimeModule = () => `import { loadComponent } from "@lean-bridge/runtime";
import descriptor from "./descriptor.mjs";

export const runtime = await loadComponent(descriptor);
`;

/**
 * Builds component npm packages from validated inputs with deterministic output suitable for the deterministic release and independent-verification pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to build component npm packages.
 * @param root0.bundleRoot - Filesystem root containing the bundle.
 * @param root0.runtimeRoot - Filesystem root containing the runtime.
 * @param root0.outputRoot - Filesystem root containing the output.
 */
export const buildComponentNpmPackages = async ({ bundleRoot, runtimeRoot, outputRoot }) => {
	const output = resolve(outputRoot);
	const bundle = await verifiedBundle(bundleRoot);
	const record = await readExportConfiguration(join(bundle.root, "source"));
	assertExportConfigurationSnapshot(record, bundle.manifest.files
		.filter(item => item.path.startsWith("source/"))
		.map(item => ({ ...item, path: item.path.slice("source/".length) })));
	assertExportConfigurationCapabilities(record.configuration, { target: "npm", fields: ["modules", "exports", "generators"], targetFields: ["name", "version"] });
	const packageIdentity = componentNpmIdentity(bundle.manifest.component, record.configuration.targets?.npm);
	const runtime = resolve(runtimeRoot);
	const [ir, abi, artifactManifest, mainModule, mainWasm] = await Promise.all([
		readFile(join(bundle.root, "binding/binding-ir.json"), "utf8").then(JSON.parse)
		, readFile(join(bundle.root, "binding/private-abi.json"), "utf8").then(JSON.parse)
		, readFile(join(bundle.root, "metadata/component-artifact-manifest.json"), "utf8").then(JSON.parse)
		, readFile(join(runtime, "main.mjs"))
		, readFile(join(runtime, "main.wasm"))
	]);
	const artifact = bundle.manifest.files.find(item => item.role === "component");
	if(abi.version !== componentScalarAbi || abi.dispatch !== "scalar-frame-v2") throw new Error("Rebuild this component for scalar ABI 2");
	for(const declaration of ir.declarations) assertComponentSignature(declaration);
	for(const declaration of abi.exports) assertComponentSignature(declaration);
	const runtimeSource = (await readFile(new URL("./component-runtime.mjs", import.meta.url), "utf8")).replace("../abi/component-scalars.mjs", "./component-scalars.mjs");
	const scalarSource = await readFile(new URL("../abi/component-scalars.mjs", import.meta.url), "utf8");
	if(!mainModule.includes(Buffer.from("bridge_scalar_call")) || !mainModule.includes(Buffer.from("bridge_scalar_frame_clear"))) throw new Error("Prepared runtime lacks scalar ABI 2; rebuild the shared runtime");
	const runtimeExports = new Set(WebAssembly.Module.exports(new WebAssembly.Module(mainWasm)).map(item => `${item.kind}:${item.name}`));
	const side = new WebAssembly.Module(await readFile(join(bundle.root, artifact.path)));
	const sideExports = new Set(WebAssembly.Module.exports(side).map(item => item.name));
	for(const item of WebAssembly.Module.imports(side))
	{
		const provided = item.kind === "function" ? runtimeExports.has(`function:${item.name}`)
			: item.kind === "memory" ? item.module === "env" && item.name === "memory"
				: item.kind === "table" ? item.module === "env" && item.name === "__indirect_function_table"
					: item.module === "GOT.func" ? sideExports.has(item.name) || runtimeExports.has(`function:${item.name}`)
						: item.module === "env" && (["__memory_base", "__table_base", "__stack_pointer"].includes(item.name) || runtimeExports.has(`global:${item.name}`));
		if(!provided) throw new Error(`Prepared runtime cannot resolve component import ${item.module}.${item.name}`);
	}
	const runtimeFiles = new Map([
		["index.mjs", runtimeModule()]
		, ["internal/main.mjs", mainModule]
		, ["internal/main.wasm", mainWasm]
		, ["internal/component-runtime.mjs", runtimeSource]
		, ["internal/component-scalars.mjs", scalarSource]
		, ["LICENSE", await readFile(new URL("../../LICENSE", import.meta.url))]
	]);
	const noticeRoot = new URL("../../notices/runtime/", import.meta.url);
	for(const name of (await readdir(noticeRoot)).sort()) runtimeFiles.set(`notices/${name}`, await readFile(new URL(name, noticeRoot)));
	const runtimeMetadata = {
		name: "@lean-bridge/runtime"
		, description: "Shared Lean WebAssembly runtime for generated Lean Bridge packages."
		, license: "MIT", type: "module", sideEffects: true, engines: { node: ">=22" }
		, exports: { ".": { browser: "./index.mjs", import: "./index.mjs", default: "./index.mjs" } }
		, files: ["index.mjs", "internal", "LICENSE", "notices", "runtime-identity.json"]
		, leanBridge: { sharedRuntime: true, ...bundle.manifest.runtime, componentScalarAbi }
	};
	const identityBasis = {
		schemaVersion: 1, metadata: runtimeMetadata
		, packing: { archiveRoot: "package", sourceDateEpoch: 1, implementationSha256: sha256(await readFile(new URL("./deterministic-archive.mjs", import.meta.url))) }
		, files: [...runtimeFiles].map(([path, bytes]) => ({ path, sha256: sha256(bytes) })).sort((a, b) => a.path.localeCompare(b.path))
	};
	const runtimeIdentity = sha256(canonicalJson(identityBasis));
	const version = `0.0.0-abi${componentScalarAbi}.${runtimeIdentity}`;
	const runtimePackage = join(output, "runtime", "package");
	const componentPackage = join(output, "component", "package");
	await ensureEmpty(output);
	await mkdir(join(runtimePackage, "internal"), { recursive: true });
	runtimeFiles.set("runtime-identity.json", canonicalJson(identityBasis));
	runtimeFiles.set("package.json", json({ ...runtimeMetadata, version, leanBridge: { ...runtimeMetadata.leanBridge, runtimeIdentity } }));
	for(const [path, bytes] of runtimeFiles)
	{
		await mkdir(dirname(join(runtimePackage, path)), { recursive: true });
		await writeFile(join(runtimePackage, path), bytes);
	}

	const generated = generateJavaScriptPackage(ir);
	for(const [path, contents] of Object.entries(generated))
	{
		await mkdir(dirname(join(componentPackage, path)), { recursive: true });
		await writeFile(join(componentPackage, path), contents);
	}
	const componentPackageJson = JSON.parse(generated["package.json"]);
	const sbom = JSON.parse(await readFile(join(bundle.root, "metadata/sbom.json"), "utf8"));
	for(const notice of sbom.notices) await copy(join(bundle.root, notice.path), join(componentPackage, basename(notice.path)));
	const dependencyNotices = bundle.manifest.files.filter(file => file.role === "source" && file.path.startsWith("lake/packages/")
		&& /^(?:LICENSE|NOTICE|COPYING)(?:\..+)?$/i.test(basename(file.path)));
	for(const notice of dependencyNotices)
		await copy(join(bundle.root, notice.path), join(componentPackage, "notices/lake", notice.path.slice("lake/packages/".length)));
	const componentExports = componentPackageJson.exports?.["."] ?? {};
	await writeFile(join(componentPackage, "package.json"), json({
		...componentPackageJson
		, ...(dependencyNotices.length ? { files: [...new Set([...componentPackageJson.files, "notices"])] } : {})
		, name: packageIdentity.name
		, version: packageIdentity.version
		, license: sbom.license
		, description: ir.documentation.summary
		, engines: { node: ">=22" }
		, exports: {
			...componentPackageJson.exports,
			".": {
				...componentExports,
				browser: componentExports.import ?? "./index.mjs"
			}
		}
		, dependencies: { "@lean-bridge/runtime": version }
		, leanBridge: {
			component: ir.component.id
			, componentBundleSha256: bundle.manifestSha256
			, componentIdentitySha256: bundle.manifest.identitySha256
			, bindingIrSha256: bundle.manifest.bindingIrSemanticSha256
			, sharedRuntime: true
		}
	}));
	await writeFile(join(componentPackage, "internal/runtime.mjs"), componentRuntimeModule());
	await writeFile(join(componentPackage, "internal/descriptor.mjs"), descriptorModule({
		manifest: bundle.manifest
		, ir
		, abi
		, artifact
		, initializer: artifactManifest.structure.exports.internalInitializer
	}));
	await copy(join(bundle.root, artifact.path), join(componentPackage, "internal/wasm", basename(artifact.path)));
	for(const [source, destination] of [
		["component-release-bundle.json", "component-release-bundle.json"]
		, ["binding/binding-ir.json", "binding-ir.json"]
		, ["metadata/assurance.json", "assurance.json"]
		, ["metadata/provenance.json", "provenance.json"]
		, ["metadata/runtime-requirement.json", "runtime-requirement.json"]
		, ["metadata/sbom.json", "sbom.json"]
	]) await copy(join(bundle.root, source), join(componentPackage, "metadata", destination));
	if(record.path !== null) await copy(join(bundle.root, "source", record.path), join(componentPackage, "metadata", record.path));

	const sourceDateEpoch = 1;
	const runtimeArchive = await createDeterministicTarGz({ directory: runtimePackage, archiveRoot: "package", sourceDateEpoch });
	const componentArchive = await createDeterministicTarGz({ directory: componentPackage, archiveRoot: "package", sourceDateEpoch });
	const runtimeArchiveName = `lean-bridge-runtime-${version}.tgz`;
	const componentArchiveName = `${packageIdentity.name.replaceAll("/", "-")}-${packageIdentity.version}.tgz`;
	const runtimeArchivePath = join(output, runtimeArchiveName);
	const componentArchivePath = join(output, componentArchiveName === runtimeArchiveName ? `component-${componentArchiveName}` : componentArchiveName);
	await Promise.all([
		writeFile(runtimeArchivePath, runtimeArchive)
		, writeFile(componentArchivePath, componentArchive)
	]);
	const sourceManifest = bundle.manifest.files.find(item => item.path === "locks/component-build-plan.json");
	const provenance = bundle.manifest.files.find(item => item.path === "metadata/provenance.json");
	const runtimeRequirement = bundle.manifest.files.find(item => item.path === "metadata/runtime-requirement.json");
	const report = Object.freeze({
		schemaVersion: packageIdentity.coordinate === ir.component.id ? 1 : 2
		, kind: "lean-bridge-component-package-receipt"
		, component: Object.freeze({ ...ir.component })
		, source: Object.freeze({ treeSha256: JSON.parse(await readFile(join(bundle.root, sourceManifest.path), "utf8")).source.treeSha256 })
		, bindingIrSha256: bundle.manifest.bindingIrSemanticSha256
		, provenanceSha256: provenance.sha256
		, componentBundleSha256: bundle.manifestSha256
		, componentIdentitySha256: bundle.manifest.identitySha256
		, componentArtifactSha256: artifact.sha256
		, runtimeRequirementSha256: runtimeRequirement.sha256
		, runtime: Object.freeze({ package: `@lean-bridge/runtime@${version}`, archive: basename(runtimeArchivePath), sha256: sha256(runtimeArchive) })
		, package: Object.freeze({ package: packageIdentity.coordinate, archive: basename(componentArchivePath), sha256: sha256(componentArchive) })
		, policies: Object.freeze({ componentCompiledOnce: true, runtimeShared: true, runtimeBinaryInComponent: false, nativeCallablesOnly: true })
		, verificationCommand: "node verify-component-package-receipt.mjs --receipt component-package-receipt.json"
	});
	validateComponentPackageReceipt(report);
	await Promise.all([
		writeFile(join(output, "component-package-receipt.json"), canonicalJson(report))
		, copy(new URL("./component-package-receipt.mjs", import.meta.url), join(output, "verify-component-package-receipt.mjs"))
	]);
	return Object.freeze({ output, runtimeArchive: runtimeArchivePath, componentArchive: componentArchivePath, report });
};
