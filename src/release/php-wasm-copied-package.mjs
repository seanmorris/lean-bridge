/**
 * Prepared npm runtime/component archives and a matching Composer PHP package.
 *
 * @file
 */
import { lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { nativeArtifactPaths } from "../build/native-artifacts.mjs";
import { readVerifiedPhpWasmCopiedComponent, readVerifiedPhpWasmCopiedRuntime, verifyPhpWasmCopiedFiles } from "../build/php-wasm-copied-artifacts.mjs";
import { compileCopiedPhpModel, validateOrdinaryPhpSettings } from "../backends/php/copied-model.mjs";
import { componentNpmIdentity } from "./component-package-receipt.mjs";
import { createDeterministicTarGzFromFiles, tarGzipPackingIdentity } from "./deterministic-archive.mjs";
import { createDeterministicZip } from "./deterministic-zip.mjs";
import { readVerifiedSourceNotices } from "./source-notices.mjs";
import { compiledPackageMetadata, composerPackageMetadata, npmPackageMetadata } from "../analyze/package-metadata.mjs";
import { brickMathRequirement, bundledBrickMath } from "../backends/php/brick-math.mjs";

const profile = "php-wasm-copied-loading-v1";
const runtimeName = "@lean-bridge/php-wasm-copied-runtime";
const receiptPath = "php-wasm-package-set.json";
const json = canonicalJson;
const same = (a, b) => json(a) === json(b);
const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const closed = (value, fields) => value && typeof value === "object" && !Array.isArray(value) && same(Object.keys(value).sort(), [...fields].sort());
const save = async (root, path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes, { flag: "wx" }); };
const inventory = async root => Object.fromEntries(await Promise.all((await nativeArtifactPaths(root)).map(async path => [path, identity(await readFile(join(root, path)))])));
const settings = (value, label) => {
	if(!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !["name", "version"].includes(key))) throw new TypeError(`Unknown ${label} package setting`);
};

const runtimePayload = async (root, runtime) => ({ ...runtime.manifest.files, "runtime.json": identity(await readFile(join(root, "runtime.json"))) });
const sources = async ({ model, receipt, runtime, runtimeFiles, packing, npmSettings, composerSettings, notices, sourceNotices }) => {
	const metadata = compiledPackageMetadata(model.sourceIdentity);
	settings(npmSettings, "npm"); settings(composerSettings, "Composer");
	const localVersion = model.component.version === "0.0.0-local" ? "0.0.0" : model.component.version;
	const npm = componentNpmIdentity({ name: `php-wasm-${model.component.name}`, version: localVersion }, npmSettings);
	if(npm.name === runtimeName) throw new TypeError("Component cannot replace the PHP-Wasm runtime package");
	const composer = { name: composerSettings.name ?? `lean-bridge/${model.component.name.replaceAll("_", "-")}-php-wasm`, version: composerSettings.version ?? localVersion };
	validateOrdinaryPhpSettings(composer);
	const brickMath = bundledBrickMath();
	const host = await readFile(new URL("../backends/php/php-wasm-copied-host.mjs", import.meta.url));
	const identityBasis = { schemaVersion: 1, profile
		, runtimeIdentity: runtime.identity
		, runtimeFiles, packing
		, host: identity(host)
		, phpLoader: identity(await readFile(new URL("../backends/php/php-wasm-copied-loader.mjs", import.meta.url)))
		, packaging: identity(await readFile(new URL(import.meta.url)))
		, phpDependencies: Object.fromEntries(Object.entries(brickMath).map(([path, bytes]) => [path, identity(Buffer.from(bytes))]))
		, notices: Object.fromEntries(Object.entries(notices).map(([path, bytes]) => [path, identity(bytes)])) };
	const loaderIdentity = sha256(json(identityBasis));
	const runtimeVersion = `0.0.0-copied1.${loaderIdentity}`;
	const { namespace } = compileCopiedPhpModel(model.bindingIr, { integerBits: 32 });
	const definition = { id: model.component.id, identity: sha256(json(receipt)), namespace, library: basename(receipt.library), composer: composer.name, runtimeIdentity: runtime.identity };
	const phpDependencies = { ...brickMath, "bootstrap.php": "<?php\ndeclare(strict_types=1);\nrequire_once __DIR__ . '/dependencies/brick-math/autoload.php';\nrequire_once __DIR__ . '/src/Api.php';\n" };
	const runtimeIndex = `import { createPhpWasmCopiedDescriptor } from './host.mjs';
const runtime = Object.freeze(${JSON.stringify({ identity: runtime.identity, loaderIdentity, library: basename(runtime.manifest.library) })});
export const createDescriptor = (component, assets) => createPhpWasmCopiedDescriptor({ ...runtime, url: new URL(${JSON.stringify(`./compiled/${runtime.manifest.library}`)}, import.meta.url) }, component, assets);
`;
	const componentIndex = `import { createDescriptor } from ${JSON.stringify(runtimeName)};
const descriptor = createDescriptor(${JSON.stringify(definition)}, {
  library: new URL(${JSON.stringify(`./compiled/${receipt.library}`)}, import.meta.url),
  api: new URL('./compiled/src/Api.php', import.meta.url),
  native: new URL('./compiled/src/Internal/Native.php', import.meta.url),
  registration: new URL('./lazy-library.txt', import.meta.url),
  php: {
${Object.keys(phpDependencies).map(path => `    ${JSON.stringify(path)}: new URL(${JSON.stringify(`./php/${path}`)}, import.meta.url),`).join("\n")}
  },
});
export const { getLibs, getFiles, extensions, autoload, lazy } = descriptor;
export default descriptor;
`;
	const runtimePackage = { name: runtimeName, version: runtimeVersion, type: "module", description: "Shared Lean runtime for compiled PHP-Wasm copied APIs", exports: { ".": "./index.mjs" }, files: ["index.mjs", "host.mjs", "compiled", "licenses", "runtime-identity.json"], leanBridge: { profile, runtimeIdentity: runtime.identity, loaderIdentity } };
	const componentPackage = { name: npm.name, version: npm.version, type: "module", description: `Compiled Lean API for PHP-Wasm: ${model.component.name}`, ...npmPackageMetadata(metadata), exports: { ".": "./index.mjs", "./package.json": "./package.json" }, files: ["index.mjs", "README.md", "lazy-library.txt", "compiled", "php", "licenses"], dependencies: { [runtimeName]: runtimeVersion }, peerDependencies: { "php-wasm": "0.1.0" }, leanBridge: { profile, component: model.component, componentIdentity: definition.identity, bindingIrSha256: model.bindingIrSha256, runtimeIdentity: runtime.identity, composer } };
	const composerPackage = { ...composer, type: "library", description: `Compiled Lean copied API for PHP-Wasm: ${model.component.name}`, ...composerPackageMetadata(metadata), require: { php: ">=8.4 <8.5", ...brickMathRequirement }, autoload: { files: ["src/Api.php"] }, extra: { "lean-bridge": { profile, component: model.component, componentIdentity: definition.identity, runtimeIdentity: runtime.identity, npm: { name: npm.name, version: npm.version }, namespace } } };
	const readme = `# ${model.component.name} for PHP-Wasm

Import this package's default descriptor and include it in PHP-Wasm's \`sharedLibs\` array. npm installs the matching Lean runtime dependency. The descriptor registers that runtime once per PHP host and mounts the generated PHP files.

\`\`\`js
import { PhpNode } from 'php-wasm/PhpNode';
import api from '${npm.name}';

const php = new PhpNode({ version: '8.4', sharedLibs: [api] });
await php.run(\`<?php require '\${api.autoload}';\`);
\`\`\`

Call the generated functions in the \`${namespace}\` PHP namespace. The \`compiled/src/Api.php\` file contains their typed declarations. Other descriptors can share the same \`sharedLibs\` list. Conflicting runtime, component and PHP namespace identities are rejected before startup.

For a Composer application, install the companion \`${composer.name}:${composer.version}\` ZIP, mount your application's \`vendor\` directory into PHP-Wasm, and use the named \`extensions\` export in \`sharedLibs\` instead of the default descriptor. Require your normal \`vendor/autoload.php\`. This export registers the native libraries without preloading a second copy of the PHP files.

For first-call loading, import \`{ lazy as api }\` from this package and pass \`dynamicLibs: [api]\` instead. With Composer, use \`api.extensions\` in \`dynamicLibs\`. The host loads PHP declarations at startup but fetches the Lean runtime and this component only on its first valid API call. An unused component stays unloaded. Different components may choose different modes; registering the same component in both modes is rejected.

This package uses PHP-Wasm 0.1.0, PHP 8.4.1 and the default host variant in Node or Chromium. Register descriptors before constructing the host. Lazy loading requires \`enable_dl=1\`; await each host request before starting another. After an extension-loading failure, create a new PHP instance. No compiler, FFI extension or install script is required. The handoff receipt verifies package bytes; the descriptor checks compatibility identities, not downloaded byte integrity.

Compound exports use null or Some for Option, Ok or Err for Except, and exact two-element lists for Prod. Some(null) retains a present Unit or an outer Some containing None, according to the declared type. Generated branch classes are final readonly and expose one value property. Calls validate payload types without weak-mode coercion and return independent copies, including nested arrays and records. PHP object identity is not Lean value equality. On wasm32, UInt32, UInt64, Int64, Nat, Int and USize use Brick\\Math\\BigInteger; ISize uses a 32-bit PHP int. These mappings apply inside compound payloads. Type nesting stops at 32. Validation, Zend conversion and native copying each have a 16 MiB accounting limit, not a bound on Lean working memory. Compound callables, lists, arbitrary variants and recursive copied types remain unsupported.
${model.types.some(type => type.kind === "callback") ? "\nPrimitive callbacks accept PHP callables with one to sixteen primitive arguments and a primitive result. Generated checks enforce exact values even in weak callers. UInt32, UInt64, Int64, Nat, Int and 32-bit USize use Brick\\Math\\BigInteger. Unit is null; Char is one Unicode scalar. Callback arguments are copied. The callable itself borrows one synchronous call; retained calls reject. Throwable failures preserve the original object after Lean cleanup. Reference parameters/returns, generators, compound callables and async reject.\n\nReturned LeanClosure objects are invokable with exactly the declared positional arguments. Call close() in finally; it is idempotent and defers disposal during an active call. isClosed() reports explicit closure, and destruction is a fallback. Saved callable aliases share the same lease. Cloning and serialization reject. Keep closures within their originating PHP instance. The pinned host cannot start Fibers. Each adapter allows 64 nested calls, the runtime allows 4096 closure identities, and existing 16 MiB conversion budgets apply.\n" : ""}
`;
	return {
		npm, composer, definition, loaderIdentity, runtimeVersion
		, files: {
			"runtime/package/index.mjs": runtimeIndex
			, "runtime/package/runtime-identity.json": json(identityBasis)
			, "runtime/package/host.mjs": host
			, "runtime/package/package.json": json(runtimePackage)
			, "component/package/index.mjs": componentIndex
			, "component/package/package.json": json(componentPackage)
			, "component/package/README.md": readme
			, "component/package/lazy-library.txt": definition.library
			, ...Object.fromEntries(Object.entries(phpDependencies).map(([path, bytes]) => [`component/package/php/${path}`, bytes]))
			, "composer/composer.json": json(composerPackage)
			, "composer/lean-bridge/compiled-package.json": json({ schemaVersion: 1, profile, ...definition, bindingIrSha256: model.bindingIrSha256, sourceIdentity: model.sourceIdentity })
			, ...Object.fromEntries(["runtime/package", "component/package", "composer"].flatMap(prefix => Object.entries(notices).map(([path, bytes]) => [`${prefix}/licenses/${path}`, bytes])))
			, ...Object.fromEntries(["component/package", "composer"].flatMap(prefix => [...sourceNotices].map(([path, bytes]) => [`${prefix}/licenses/${path}`, bytes])))
		}
	};
};

const archiveSpecs = generated => [
	{ ecosystem: "npm", role: "runtime", name: runtimeName, version: generated.runtimeVersion, directory: "runtime/package", archive: `lean-bridge-php-wasm-copied-runtime-${generated.runtimeVersion}.tgz` }
	, { ecosystem: "npm", role: "component", name: generated.npm.name, version: generated.npm.version, directory: "component/package", archive: `${generated.npm.name.replace(/^@/, "").replaceAll("/", "-")}-${generated.npm.version}.tgz` }
	, { ecosystem: "composer", role: "api", name: generated.composer.name, version: generated.composer.version, directory: "composer", archive: `${generated.composer.name.replace("/", "-")}-${generated.composer.version}-php-wasm.zip` }
];
const archiveBytes = async (root, spec) => {
	const directory = join(root, spec.directory);
	if(spec.ecosystem !== "npm") return createDeterministicZip({ directory, sourceDateEpoch: 315532800 });
	const files = await Promise.all((await nativeArtifactPaths(directory)).map(async path => ({
		path: `package/${path}`
		, bytes: await readFile(join(directory, path)), mode: 0o644
	})));
	return createDeterministicTarGzFromFiles({ files, sourceDateEpoch: 1 });
};

/**
 * Verify generated metadata and exact archives against their compiled inputs.
 *
 * @param root - Completed, unmodified handoff directory.
 */
export const readVerifiedPhpWasmCopiedPackageSet = async root => {
	const report = JSON.parse(await readFile(join(root, receiptPath), "utf8"));
	if(!closed(report, ["schemaVersion", "kind", "profile", "component", "componentIdentity", "runtimeIdentity", "loaderIdentity", "packing", "npmSettings", "composerSettings", "archives", "files"])
		|| report.schemaVersion !== 1 || report.kind !== "lean-bridge-php-wasm-copied-package-set" || report.profile !== profile) throw new Error("Invalid PHP-Wasm package set");
	const packing = { archiveRoot: "package", sourceDateEpoch: 1, ...await tarGzipPackingIdentity() };
	if(!same(report.packing, packing)) throw new Error("PHP-Wasm archive packing environment differs; use the recorded producer environment to reconstruct archives or the portable package-set receipt to verify downloaded bytes");
	await verifyPhpWasmCopiedFiles(root, report.files, receiptPath);
	const runtime = await readVerifiedPhpWasmCopiedRuntime(join(root, "runtime/package/compiled"));
	const { model, receipt } = await readVerifiedPhpWasmCopiedComponent(join(root, "component/package/compiled"), runtime.identity);
	const noticePaths = ["Lean-LICENSE", "Lean-LICENSES", "LeanBridge-LICENSE", ...(await nativeArtifactPaths(fileURLToPath(new URL("../../notices/runtime/", import.meta.url)))).map(path => `runtime/${path}`)];
	const notices = Object.fromEntries(await Promise.all(noticePaths.map(async path => [path, await readFile(join(root, "runtime/package/licenses", path))])));
	const { files: sourceNotices } = await readVerifiedSourceNotices(join(root, "component/package/compiled"), receipt.sourceIdentity);
	const runtimeFiles = await runtimePayload(join(root, "runtime/package/compiled"), runtime);
	const generated = await sources({ model, receipt, runtime, runtimeFiles, packing, npmSettings: report.npmSettings, composerSettings: report.composerSettings, notices, sourceNotices });
	if(!same(report.component, model.component) || report.componentIdentity !== generated.definition.identity || report.runtimeIdentity !== runtime.identity || report.loaderIdentity !== generated.loaderIdentity) throw new Error("PHP-Wasm package identities differ from compiled artifacts");
	for(const [path, bytes] of Object.entries(generated.files))
		if(!Buffer.from(bytes).equals(await readFile(join(root, path)))) throw new Error(`Generated PHP-Wasm package drift: ${path}`);
	for(const path of ["src/Api.php", "src/Internal/Native.php"])
		if(!(await readFile(join(root, "composer", path))).equals(await readFile(join(root, "component/package/compiled", path)))) throw new Error("Composer PHP differs from its compiled adapter");
	const archives = [];
	for(const spec of archiveSpecs(generated))
	{
		const bytes = await archiveBytes(root, spec);
		if(!bytes.equals(await readFile(join(root, "archives", spec.archive)))) throw new Error(`PHP-Wasm archive differs from verified package: ${spec.archive}`);
		archives.push({ ...spec, ...identity(bytes) });
	}
	if(!same(report.archives, archives)) throw new Error("PHP-Wasm archive receipt drift");
	const expected = [...Object.keys(generated.files), "composer/src/Api.php", "composer/src/Internal/Native.php", ...archives.map(item => `archives/${item.archive}`)];
	for(const prefix of ["runtime/package/compiled", "component/package/compiled"])
		expected.push(...(await nativeArtifactPaths(join(root, prefix))).map(path => `${prefix}/${path}`));
	if(!same(Object.keys(report.files).sort(), expected.sort())) throw new Error("Unexpected PHP-Wasm package payload");
	return { report, model, receipt, runtime };
};

/**
 * Assemble one atomic package set with startup and first-call descriptors.
 *
 * @param options - Verified component/runtime roots, Lean notices and exact coordinates.
 * @param options.componentRoot - Freshly compiled copied component directory.
 * @param options.runtimeRoot - Matching, separately built shared runtime directory.
 * @param options.outputRoot - New, atomic package handoff directory.
 * @param options.leanPrefix - Pinned Lean installation supplying license notices.
 * @param options.npmSettings - Exact npm component name and version.
 * @param options.composerSettings - Exact companion Composer name and version.
 * @param options.loading - The default descriptor is startup; consumers select lazy.
 */
export const buildPhpWasmCopiedPackages = async ({ componentRoot, runtimeRoot, outputRoot, leanPrefix, npmSettings = {}, composerSettings = {}, loading = "startup" }) => {
	if(loading !== "startup") throw new TypeError("Select lazy loading with the installed package's lazy descriptor, not a build option");
	settings(npmSettings, "npm"); settings(composerSettings, "Composer");
	const runtime = await readVerifiedPhpWasmCopiedRuntime(runtimeRoot);
	const { model, receipt } = await readVerifiedPhpWasmCopiedComponent(componentRoot, runtime.identity);
	const notices = { "Lean-LICENSE": await readFile(join(leanPrefix, "LICENSE")), "Lean-LICENSES": await readFile(join(leanPrefix, "LICENSES")), "LeanBridge-LICENSE": await readFile(new URL("../../LICENSE", import.meta.url)) };
	for(const path of await nativeArtifactPaths(fileURLToPath(new URL("../../notices/runtime/", import.meta.url)))) notices[`runtime/${path}`] = await readFile(new URL(`../../notices/runtime/${path}`, import.meta.url));
	const { files: sourceNotices } = await readVerifiedSourceNotices(componentRoot, receipt.sourceIdentity);
	const packing = { archiveRoot: "package", sourceDateEpoch: 1, ...await tarGzipPackingIdentity() };
	const runtimeFiles = await runtimePayload(runtimeRoot, runtime);
	const generated = await sources({ model, receipt, runtime, runtimeFiles, packing, npmSettings, composerSettings, notices, sourceNotices });
	const output = resolve(outputRoot);
	if(await lstat(output).then(() => true, error => { if(error.code === "ENOENT") return false; throw error; })) throw new Error("PHP-Wasm package output already exists");
	await mkdir(dirname(output), { recursive: true });
	const parent = await realpath(dirname(output));
	for(const input of [componentRoot, runtimeRoot])
	{
		const path = relative(await realpath(input), parent);
		if(path === "" || (!path.startsWith("../") && path !== ".." && !isAbsolute(path))) throw new Error("PHP-Wasm package output cannot be inside its compiled inputs");
	}
	const staging = await mkdtemp(join(dirname(output), ".lean-bridge-php-wasm-packages-"));
	try
	{
		for(const [path, bytes] of Object.entries(generated.files)) await save(staging, path, bytes);
		for(const [from, into] of [[runtimeRoot, "runtime/package/compiled"], [componentRoot, "component/package/compiled"]])
			for(const path of await nativeArtifactPaths(from)) await save(staging, `${into}/${path}`, await readFile(join(from, path)));
		for(const path of ["src/Api.php", "src/Internal/Native.php"]) await save(staging, `composer/${path}`, await readFile(join(staging, "component/package/compiled", path)));
		const archives = [];
		for(const spec of archiveSpecs(generated))
		{
			const bytes = await archiveBytes(staging, spec);
			await save(staging, `archives/${spec.archive}`, bytes);
			archives.push({ ...spec, ...identity(bytes) });
		}
		const report = { schemaVersion: 1, kind: "lean-bridge-php-wasm-copied-package-set", profile, component: model.component, componentIdentity: generated.definition.identity, runtimeIdentity: runtime.identity, loaderIdentity: generated.loaderIdentity, packing, npmSettings: { name: generated.npm.name, version: generated.npm.version }, composerSettings: generated.composer, archives, files: await inventory(staging) };
		await save(staging, receiptPath, json(report));
		await readVerifiedPhpWasmCopiedPackageSet(staging);
		await rename(staging, output);
		return { output, report };
	} catch(error)
	{ await rm(staging, { recursive: true, force: true }); throw error; }
};
