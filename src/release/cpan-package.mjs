/**
 * Prepared CPAN archives. Packaging only copies and hashes precompiled inputs.
 *
 * @file
 */
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generatePerlBindingPackage } from "../backends/perl/generate.mjs";
import { createDeterministicTarGzFromFiles } from "./deterministic-archive.mjs";
import { readVerifiedNativeRuntime, verifyNativeFiles } from "../build/native-artifacts.mjs";
import { createNativeModel } from "../build/native-model.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const templates = join(root, "src/backends/perl");
export const perlRuntimeVersion = "0.001";
const save = async (path, value) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, value); };
const copy = async (from, to) => { await mkdir(dirname(to), { recursive: true }); await copyFile(from, to); };
const json = canonicalJson;
const paths = async (directory, prefix = "") => {
	const files = [];
	for(const entry of await readdir(join(directory, prefix), { withFileTypes: true }))
	{
		const name = prefix ? `${prefix}/${entry.name}` : entry.name;
		if(entry.isSymbolicLink()) throw new Error(`symlink in CPAN payload: ${name}`);
		if(entry.isDirectory()) files.push(...await paths(directory, name));
		else if(entry.isFile()) files.push(name);
		else throw new Error(`special file in CPAN payload: ${name}`);
	}
	return files.sort();
};
const empty = async directory => {
	await mkdir(directory, { recursive: true });
	if((await readdir(directory)).length) throw new Error(`CPAN output is not empty: ${directory}`);
};
/**
  Record every prepared payload file before compiler-free archive assembly.

 * @param directory - Prepared distribution root.
 * @param manifest - Closed CPAN payload manifest and hash inventory.
 */
export const refreshCpanInventory = async (directory, manifest) => {
	const inventory = [...new Set([...(await paths(directory)), "MANIFEST", "lean-bridge-package.json"])].sort();
	await save(join(directory, "MANIFEST"), `${inventory.join("\n")}\n`);
	manifest.files = {};
	for(const path of await paths(directory)) if(path !== "lean-bridge-package.json")
    manifest.files[path] = sha256(await readFile(join(directory, path)));
	await save(join(directory, "lean-bridge-package.json"), json(manifest));
};

/**
 * Stage a shared runtime or generated component distribution from checked artifacts.
 *
 * @param root0 - Named inputs for this native build or packaging operation.
 * @param root0.outputRoot - New output directory; existing output must not be overwritten.
 * @param root0.runtimeRoot - Verified process-wide native runtime directory.
 * @param root0.componentRoot - Compiled native component directory, or null for the shared runtime package.
 * @param root0.leanPrefix - Pinned Lean installation containing the compiler and matching headers.
 * @param root0.version - Pinned interpreter version or CPAN decimal release version.
 * @param root0.glibcMinimumVersion - Minimum documented Linux glibc version.
 */
export const stageCpanPackage = async ({ outputRoot
	, runtimeRoot
	, componentRoot = null
	, leanPrefix
	, version = "0.001", glibcMinimumVersion = "2.38" }) => {
	if(!/^\d+\.\d{3}(?:_\d{2})?$/.test(version)) throw new TypeError("CPAN version must use Perl decimal version syntax");
	if(!/^2\.\d+$/.test(glibcMinimumVersion)) throw new TypeError("invalid CPAN glibc floor");
	const directory = resolve(outputRoot); await empty(directory);
	const { manifest: runtime, identity: nativeRuntimeIdentity } = await readVerifiedNativeRuntime(runtimeRoot);
	const bindingSources = {};
	for(const name of ["Runtime.xs", "runtime.h", "Runtime.pm", "Platform.pm"])
		bindingSources[name] = sha256(await readFile(join(templates, name)));
	const binding = { schemaVersion: 1, nativeRuntimeIdentity, sources: bindingSources };
	const runtimeIdentity = sha256(canonicalJson(binding));
	void leanPrefix;
	let moduleName = "LeanBridge::Runtime", xs = "Runtime.xs", include = "lib/LeanBridge/Runtime/include";
	if(componentRoot)
	{
		const model = JSON.parse(await readFile(join(componentRoot, "model.json"), "utf8"));
		const receipt = JSON.parse(await readFile(join(componentRoot, "native-component.json"), "utf8"));
		await verifyNativeFiles(componentRoot, JSON.parse(await readFile(join(componentRoot, "artifacts.json"), "utf8")).files);
		if(sha256(canonicalJson(model)) !== receipt.modelSha256
      || sha256(await readFile(join(componentRoot, "metadata.json"))) !== receipt.metadataSha256
      || canonicalJson(model.sourceIdentity) !== canonicalJson(receipt.sourceIdentity)
      || sha256(await readFile(join(componentRoot, "component.h"))) !== receipt.headerSha256)
			throw new Error("native component metadata or header identity differs from compilation");
		const reconstructed = createNativeModel({ metadata: JSON.parse(await readFile(join(componentRoot, "metadata.json"), "utf8"))
			, component: model.component, moduleName: model.moduleName
			, sourceIdentity: receipt.sourceIdentity });
		if(canonicalJson(reconstructed) !== canonicalJson(model)) throw new Error("native model differs from shared compiler metadata");
		if(!/^libcomponent_[0-9a-f]{20}\.so$/.test(receipt.library)) throw new Error("invalid native component library path");
		if(receipt.runtimeIdentity !== nativeRuntimeIdentity) throw new Error("component and runtime identities differ");
		if(sha256(await readFile(join(componentRoot, receipt.library))) !== receipt.nativeLibrary.sha256) throw new Error("corrupt native component");
		moduleName = model.moduleName; xs = "Component.xs"; include = ".";
		const files = generatePerlBindingPackage(model, { ...receipt, runtimeIdentity }), relative = moduleName.replaceAll("::", "/");
		for(const [path, bytes] of Object.entries(files)) await save(join(directory, path), path.endsWith(".pm") ? bytes.replace("our $VERSION = '0.001';", `our $VERSION = '${version}';`) : bytes);
		await copy(join(componentRoot, receipt.library), join(directory, `lib/${relative}/native/${receipt.library}`));
		for(const path of ["component.h", "model.json", "binding-ir.json", "native-component.json", "metadata.json", "generated.lean", "artifacts.json"])
      await copy(join(componentRoot, path), join(directory, path));
		const generatedDigest = receipt.sourceIdentity?.lakeDependencies?.generatedSourcesSha256;
		if(generatedDigest !== undefined)
		{
			const bytes = await readFile(join(componentRoot, "lake-generated-sources.json"));
			if(sha256(bytes) !== generatedDigest) throw new Error("native generated source handoff differs from compilation");
			await save(join(directory, "lake-generated-sources.json"), bytes);
		}
	} else
	{
		await copy(join(templates, "Runtime.xs"), join(directory, "Runtime.xs"));
		const runtimePm = join(directory, "lib/LeanBridge/Runtime.pm");
		await save(runtimePm, (await readFile(join(templates, "Runtime.pm"), "utf8")).replace("our $VERSION = '0.001';", `our $VERSION = '${version}';`));
		await copy(join(runtimeRoot, "runtime.json"), join(directory, "lib/LeanBridge/Runtime/runtime.json"));
		await save(join(directory, "lib/LeanBridge/Runtime/binding.json"), json(binding));
		await save(join(directory, "lib/LeanBridge/Runtime/target.json"), json({ glibcMinimumVersion }));
		await copy(join(templates, "Platform.pm"), join(directory, "lib/LeanBridge/Runtime/Platform.pm"));
		for(const path of Object.keys(runtime.files).filter(path => path.startsWith("lib/")))
      await copy(join(runtimeRoot, path), join(directory, "lib/LeanBridge/Runtime/native", basename(path)));
		for(const path of Object.keys(runtime.files).filter(path => path.startsWith("include/lean/")))
      await copy(join(runtimeRoot, path), join(directory, include, path.slice("include/".length)));
		await copy(join(runtimeRoot, "include/lean_bridge_native_runtime.h"), join(directory, include, "lean_bridge_native_runtime.h"));
		await copy(join(templates, "runtime.h"), join(directory, include, "runtime.h"));
	}
	await copy(join(templates, "Build.pm"), join(directory, "LeanBridgeBuild.pm"));
	await copy(join(templates, "Platform.pm"), join(directory, "inc/LeanBridge/Runtime/Platform.pm"));
	await copy(join(root, "LICENSE"), join(directory, "LICENSE"));
	for(const name of ["lean.txt", "lean-bundled.txt"]) await copy(join(root, "notices/runtime", name), join(directory, "notices", name));
	await save(join(directory, "Makefile.PL"), "use strict;\nuse warnings;\nuse lib '.';\nuse LeanBridgeBuild;\nLeanBridgeBuild::configure();\n");
	await save(join(directory, "t/00-load.t"), `use strict;\nuse warnings;\nuse Test::More tests => 1;\nuse_ok('${moduleName}');\n`);
	const distribution = moduleName.replaceAll("::", "-");
	await save(join(directory, "META.json"), json({ "meta-spec": { version: 2, url: "https://metacpan.org/pod/CPAN::Meta::Spec" }
		, name: distribution
		, version
		, abstract: "Generated native Lean bindings"
		, author: ["Lean Bridge contributors"]
		, license: ["mit"]
		, dynamic_config: true
		, release_status: version.includes("_") ? "testing" : "stable"
		, generated_by: "lean-bridge cpan-package-v1"
		, prereqs: { configure: { requires: { "ExtUtils::MakeMaker": "0", "ExtUtils::CBuilder": "0", "ExtUtils::ParseXS": "0", "JSON::PP": "0", "Digest::SHA": "0" } }
			, runtime: { requires: { perl: "5.036", "Math::BigInt": "0", "JSON::PP": "0", "Digest::SHA": "0", ...(componentRoot ? { "LeanBridge::Runtime": perlRuntimeVersion } : {}) } }
			, test: { requires: { "Test::More": "0" } } }
		, provides: { [moduleName]: { file: `lib/${moduleName.replaceAll("::", "/")}.pm`, version } }
		, resources: { repository: { type: "git", url: "https://github.com/seanmorris/lean-bridge.git" } }
		, no_index: { directory: ["inc", "prebuilt", "notices", "t"], file: ["LeanBridgeBuild.pm"], package: ["LeanBridge::Runtime::Platform"] } }));
	const manifest = { schemaVersion: 1
		, ecosystem: "cpan"
		, backend: "perl"
		, module: moduleName
		, version
		, distribution
		, runtimeVersion: componentRoot ? perlRuntimeVersion : version
		, runtimeIdentity
		, nativeRuntimeIdentity
		, glibcMinimumVersion
		, xs
		, include
		, prebuilt: []
		, files: {} };
	await refreshCpanInventory(directory, manifest);
	return { directory, manifest };
	};

/**
 * Archive exact prepared inputs; this function has no compiler or process runner.
 *
 * @param root0 - Named inputs for this native build or packaging operation.
 * @param root0.packageRoot - Prepared CPAN distribution directory.
 * @param root0.outputRoot - New output directory; existing output must not be overwritten.
 * @param root0.sourceDateEpoch - Fixed archive timestamp for reproducible output.
 */
export const archiveCpanPackage = async ({ packageRoot, outputRoot, sourceDateEpoch = 1 }) => {
	const directory = resolve(packageRoot), output = resolve(outputRoot);
	const manifest = JSON.parse(await readFile(join(directory, "lean-bridge-package.json"), "utf8"));
	if(!/^LeanBridge(?:-[A-Za-z][A-Za-z0-9_]*)+$/.test(manifest.distribution) || !/^\d+\.\d{3}(?:_\d{2})?$/.test(manifest.version)) throw new Error("invalid CPAN archive identity");
	const expected = [...Object.keys(manifest.files), "lean-bridge-package.json"].sort();
	if(canonicalJson(await paths(directory)) !== canonicalJson(expected)) throw new Error("CPAN payload contains unrecorded files");
	await mkdir(output, { recursive: true });
	const name = `${manifest.distribution}-${manifest.version}`;
	const files = [];
	for(const path of expected)
	{
		if(!/^[A-Za-z0-9_.+/-]+$/.test(path) || path.split("/").some(part => !part || part === "." || part === "..")) throw new Error("invalid CPAN payload path");
		const bytes = path === "lean-bridge-package.json" ? Buffer.from(canonicalJson(manifest)) : await readFile(join(directory, path));
		if(path !== "lean-bridge-package.json" && sha256(bytes) !== manifest.files[path]) throw new Error(`CPAN payload changed: ${path}`);
		files.push({ path: `${name}/${path}`, bytes, mode: 0o644 });
	}
	const archive = createDeterministicTarGzFromFiles({ files, sourceDateEpoch });
	const path = join(output, `${name}.tar.gz`); await writeFile(path, archive);
	const receipt = { schemaVersion: 1
		, ecosystem: "cpan"
		, backend: "perl"
		, archive: basename(path)
		, sha256: sha256(archive)
		, runtimeIdentity: manifest.runtimeIdentity
		, abiVariants: manifest.prebuilt.map(item => item.abiKey)
		, compilerAccess: false };
	await save(join(output, `${name}.receipt.json`), json(receipt));
	return { path, receipt };
};
