/**
 * Prepare installed JavaScript APIs from verified owned wasm32 components.
 *
 * @file
 */
import { lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generateJavaScriptPackage } from "../backends/javascript/generate.mjs";
import { generateOwnedWasmBroker } from "../backends/javascript/owned-wasm-broker.mjs";
import { readVerifiedOwnedJavaScriptWasmComponent, javascriptWasmOwnedPins as pins } from "../build/javascript-wasm-owned-artifacts.mjs";
import { javascriptWasmOwnedProfile as profile } from "../build/javascript-wasm-owned-model.mjs";
import { nativeArtifactPaths } from "../build/native-artifacts.mjs";
import { assembleComponentNpmRuntime } from "./component-npm-package.mjs";
import { componentNpmIdentity } from "./component-package-receipt.mjs";
import { createDeterministicTarGzFromFiles } from "./deterministic-archive.mjs";
import { readVerifiedSourceNotices } from "./source-notices.mjs";
import { compiledPackageMetadata, npmPackageMetadata } from "../analyze/package-metadata.mjs";
import { assertExportConfigurationCapabilities } from "../analyze/export-configuration.mjs";
import { writePackageSetReceipt } from "./package-set-receipt.mjs";

const runtimeRequirement = Object.freeze({ kind: "content-addressed-peer"
	, artifactIncluded: false, abiVersion: 1
	, leanCommit: pins.leanCommit, patchSetSha256: pins.patchSetSha256
	, profile: "side-lazy", shared: true
	, requiredImports: ["memory", "__indirect_function_table"] });
const save = async (root, path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes); };
const archive = files => createDeterministicTarGzFromFiles({ sourceDateEpoch: 1
	, files: [...files].map(([path, bytes]) => ({ path: `package/${path}`, bytes: Buffer.from(bytes), mode: 0o644 })) });

/**
 * Prove that every compiled import resolves in the selected shared runtime.
 * EM_JS callback imports are supplied by this component's exact metadata globals.
 *
 * @param options - Verified side module, descriptor and prepared runtime bytes.
 * @param options.mainModule - Prepared Emscripten JavaScript bytes.
 * @param options.mainWasm - Prepared shared runtime WebAssembly bytes.
 * @param options.sideWasm - Verified ownership side module bytes.
 * @param options.privateAbi - Compiler-authenticated component descriptor.
 */
export const assertOwnedJavaScriptRuntime = ({ mainModule, mainWasm, sideWasm, privateAbi }) => {
	const main = new WebAssembly.Module(mainWasm), side = new WebAssembly.Module(sideWasm);
	const exportsOf = module => new Set(WebAssembly.Module.exports(module).map(item => `${item.kind}:${item.name}`));
	const runtimeExports = exportsOf(main), sideExports = exportsOf(side);
	const required = [...generateOwnedWasmBroker().exports, "bridge_scalar_call", "bridge_scalar_frame_clear", "bridge_lean_runtime_status"];
	for(const name of required)
		if(!runtimeExports.has(`function:${name}`) || !mainModule.includes(Buffer.from(name))) throw new Error(`Prepared runtime lacks owned JavaScript support: ${name}`);
	const suffix = privateAbi.controlSymbol.slice("lbjs_component_".length, -"_control".length);
	const callbacks = new Set([`lbjs_${suffix}_dispatch_js`, `lbjs_${suffix}_finish_js`]);
	for(const item of WebAssembly.Module.imports(side))
	{
		const provided = item.kind === "function" ? item.module === "env" && (runtimeExports.has(`function:${item.name}`)
			|| callbacks.has(item.name) && sideExports.has(`global:__em_js__${item.name}`))
			: item.kind === "memory" ? item.module === "env" && item.name === "memory"
				: item.kind === "table" ? item.module === "env" && item.name === "__indirect_function_table"
					: item.module === "GOT.func" ? sideExports.has(`function:${item.name}`) || runtimeExports.has(`function:${item.name}`)
						: item.module === "GOT.mem" ? sideExports.has(`global:${item.name}`) || runtimeExports.has(`global:${item.name}`)
							: item.module === "env" && (["__memory_base", "__table_base", "__stack_pointer"].includes(item.name) || runtimeExports.has(`global:${item.name}`));
		if(!provided) throw new Error(`Prepared runtime cannot resolve owned import ${item.module}.${item.name}`);
	}
};

/**
 * Create a component archive and the same content-addressed runtime used by
 * copied npm packages. Consumers install both without compilers or source trees.
 *
 * @param options - Verified compiled component, prepared runtime and absent output.
 * @param options.componentRoot - Closed compiled ownership output.
 * @param options.runtimeRoot - Prepared shared main.mjs/main.wasm directory.
 * @param options.outputRoot - Absent package output directory.
 * @param options.signal - Optional cancellation signal.
 */
export const buildOwnedJavaScriptNpmPackages = async ({ componentRoot, runtimeRoot, outputRoot, signal }) => {
	const root = resolve(componentRoot), runtimeRootPath = resolve(runtimeRoot), output = resolve(outputRoot);
	const existing = await lstat(output).catch(error => { if(error.code !== "ENOENT") throw error; return null; });
	if(existing) throw new Error("Owned JavaScript package output already exists");
	const verified = await readVerifiedOwnedJavaScriptWasmComponent(root);
	const { model, receipt, privateAbi } = verified;
	const config = receipt.sourceIdentity.exportConfigurationSource === null ? { schemaVersion: 1 } : JSON.parse(receipt.sourceIdentity.exportConfigurationSource);
	assertExportConfigurationCapabilities(config, { target: "npm"
		, fields: ["package", "modules", "exports", "resources", "arities", "specializations", "contracts", "generators", "ownedAggregates"]
		, targetFields: ["name", "version"] });
	const coordinate = componentNpmIdentity(model.component, config.targets?.npm);
	const [mainModule, mainWasm, sideWasm] = await Promise.all([
		readFile(join(runtimeRootPath, "main.mjs"))
		, readFile(join(runtimeRootPath, "main.wasm"))
		, readFile(join(root, receipt.library))
	]);
	assertOwnedJavaScriptRuntime({ mainModule, mainWasm, sideWasm, privateAbi });
	const runtime = await assembleComponentNpmRuntime({ mainModule, mainWasm, runtimeRequirement });
	const generated = generateJavaScriptPackage(model.bindingIr), files = new Map(Object.entries(generated));
	const metadata = compiledPackageMetadata(receipt.sourceIdentity), packageJson = JSON.parse(generated["package.json"]);
	files.set("package.json", canonicalJson({ ...packageJson
		, name: coordinate.name, version: coordinate.version
		, description: model.bindingIr.documentation.summary
		, license: metadata.license ?? "UNLICENSED"
		, ...npmPackageMetadata(metadata), engines: { node: ">=22" }
		, files: [...packageJson.files, "metadata", "notices"]
		, exports: { ".": { ...packageJson.exports["."], browser: "./index.mjs" } }
		, dependencies: { "@lean-bridge/runtime": runtime.version }
		, leanBridge: { component: model.component.id, profile
			, bindingIrSha256: model.bindingIrSha256
			, componentIdentitySha256: verified.identity
			, runtimeIdentity: runtime.runtimeIdentity, sharedRuntime: true } }));
	files.set("internal/runtime.mjs", 'import { loadComponent } from "@lean-bridge/runtime";\nimport descriptor from "./descriptor.mjs";\nexport const runtime = await loadComponent(descriptor);\n');
	const descriptor = { schemaVersion: 1, id: model.component.id
		, buildHash: verified.identity
		, integrity: receipt.wasmLibrary.sha256, initializer: receipt.initializer
		, bindingIr: model.bindingIr, privateAbi };
	files.set("internal/descriptor.mjs", `export default Object.freeze({ ...${JSON.stringify(descriptor)}, sideModule: new URL("./component.so.wasm", import.meta.url) });\n`);
	files.set("internal/component.so.wasm", sideWasm);
	for(const path of await nativeArtifactPaths(root)) files.set(`metadata/compiler/${path}`, await readFile(join(root, path)));
	for(const [path, bytes] of (await readVerifiedSourceNotices(root, receipt.sourceIdentity)).files) files.set(`notices/${path}`, bytes);
	files.set("notices/lean-bridge.txt", await readFile(new URL("../../LICENSE", import.meta.url)));
	if((await readVerifiedOwnedJavaScriptWasmComponent(root)).identity !== verified.identity) throw new Error("Owned JavaScript compilation changed during packaging");
	const runtimeArchive = archive(runtime.files), componentArchive = archive(files);
	const runtimeName = `lean-bridge-runtime-${runtime.version}.tgz`;
	const archiveName = `${coordinate.name.replaceAll("/", "-")}-${coordinate.version}.tgz`;
	const componentName = archiveName === runtimeName ? `component-${archiveName}` : archiveName;
	await mkdir(dirname(output), { recursive: true });
	const staging = await mkdtemp(join(dirname(output), ".lean-owned-javascript-packages-"));
	try
	{
		for(const [path, bytes] of runtime.files) await save(staging, `runtime/package/${path}`, bytes);
		for(const [path, bytes] of files) await save(staging, `component/package/${path}`, bytes);
		await save(staging, runtimeName, runtimeArchive); await save(staging, componentName, componentArchive);
		const runtimeRef = { ecosystem: "npm", name: "@lean-bridge/runtime", version: runtime.version };
		const entry = (item, role, path, bytes) => ({ target: "npm", ecosystem: "npm"
			, name: item.name, version: item.version
			, profile, role, runtimeIdentity: runtime.runtimeIdentity
			, runtimeDelivery: role === "runtime" ? "provided" : "dependency"
			, requires: role === "runtime" ? [] : [runtimeRef]
			, artifacts: [{ path, bytes: bytes.length, sha256: sha256(bytes) }] });
		await writePackageSetReceipt({ root: staging, component: model.component
			, source: { treeSha256: receipt.sourceIdentity.sourceTreeSha256 }
			, profiles: [{ id: profile, bindingIrSha256: model.bindingIrSha256, runtimeIdentity: runtime.runtimeIdentity }]
			, packages: [entry(runtimeRef, "runtime", runtimeName, runtimeArchive), entry(coordinate, "component", componentName, componentArchive)]
			, signal });
		await rename(staging, output);
		return { output, runtimeIdentity: runtime.runtimeIdentity
			, runtimeVersion: runtime.version
			, runtimeArchive: join(output, runtimeName)
			, componentArchive: join(output, componentName), coordinate };
	}
	catch(error)
	{ await rm(staging, { recursive: true, force: true }); throw error; }
};
