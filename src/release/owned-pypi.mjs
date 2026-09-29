/**
 * Deterministic prepared Python wheels with explicitly owned structured values.
 *
 * @file
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { nativeArtifactPaths } from "../build/native-artifacts.mjs";
import { ownedPythonEvidence } from "../build/owned-python-artifacts.mjs";
import { generateOwnedPythonPackage } from "../backends/python/owned-package.mjs";
import { validateOrdinaryPythonSettings } from "../backends/python/copied-model.mjs";
import { compiledPackageMetadata, pythonPackageMetadata } from "../analyze/package-metadata.mjs";
import { readVerifiedSourceNotices } from "./source-notices.mjs";
import { createDeterministicZip } from "./deterministic-zip.mjs";
import { processBuildRunner } from "../build/process-runner.mjs";

/**
 * Reverify native inputs and ship a wheel that needs no consumer compiler.
 *
 * @param options - Verified artifacts, package coordinates and Python environment.
 */
export const packageOwnedPython = async options => {
	const { working, nativeRoot, runtimeRoot, adapterRoot, leanPrefix, settings = {}, glibcMinimumVersion, environment = process.env, signal } = options;
	validateOrdinaryPythonSettings(settings);
	if(!/^2\.\d+$/u.test(glibcMinimumVersion)) throw new TypeError("Invalid Python native glibc floor");
	const { model, prefix, evidence, adapter, receipt, libraryPaths } = await ownedPythonEvidence(options);
	const name = settings.name ?? `lean-${prefix.replaceAll("_", "-")}`;
	const version = settings.version ?? (model.component.version === "0.0.0-local" ? "0.0.0+local" : model.component.version);
	validateOrdinaryPythonSettings({ name, version });
	const transferredInputs = Boolean(model.ownedGraph.inputTransfers);
	const generated = generateOwnedPythonPackage(model.bindingIr, evidence, { transferredInputs }), moduleName = generated.packageDir;
	const root = join(working, "packages/pypi/wheel"), metadataRoot = `${moduleName}/lean_bridge`;
	const save = async (path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes, { flag: "wx" }); };
	const copy = async (source, path) => save(path, await readFile(source));
	for(const [path, source] of Object.entries(generated.files))
		await save(path.startsWith(`${moduleName}/`) ? path : `${metadataRoot}/${path}`, source);
	for(const [name, path] of Object.entries(libraryPaths))
		await copy(path, `${moduleName}/native/linux-x64/${name}`);
	for(const path of ["native-component.json", "model.json", "metadata.json", "binding-ir.json", "generated.lean", "component.h", "allocation-guard.h", "artifacts.json", "callbacks.c"])
		await copy(join(nativeRoot, path), `${metadataRoot}/component/${path}`);
	if(receipt.sourceIdentity.lakeDependencies?.generatedSourcesSha256 !== undefined)
	{
		const bytes = await readFile(join(nativeRoot, "lake-generated-sources.json"));
		if(sha256(bytes) !== receipt.sourceIdentity.lakeDependencies.generatedSourcesSha256) throw new Error("Owned Python generated Lean inputs differ from compilation");
		await save(`${metadataRoot}/component/lake-generated-sources.json`, bytes);
	}
	await copy(join(adapterRoot, "native-c-adapter.json"), `${metadataRoot}/native-c-adapter.json`);
	for(const path of [`include/${prefix}.h`, "internal/python-abi.h", "gmp/include/gmp.h"])
		await copy(join(adapterRoot, path), `${metadataRoot}/${path}`);
	await copy(join(runtimeRoot, "runtime.json"), `${metadataRoot}/runtime.json`);
	const distribution = name.replaceAll("-", "_"), distInfo = `${distribution}-${version}.dist-info`;
	const tag = `py3-none-manylinux_${glibcMinimumVersion.replace(".", "_")}_x86_64`;
	await copy(join(leanPrefix, "LICENSE"), `${distInfo}/licenses/Lean-LICENSE`);
	await copy(join(leanPrefix, "LICENSES"), `${distInfo}/licenses/Lean-LICENSES`);
	await copy(new URL("../../LICENSE", import.meta.url), `${distInfo}/licenses/LeanBridge-LICENSE`);
	for(const [path, bytes] of (await readVerifiedSourceNotices(nativeRoot, model.sourceIdentity)).files)
		await save(`${distInfo}/licenses/${path}`, bytes);
	for(const path of Object.keys(adapter.files).filter(path => path.startsWith("gmp/share/lean-bridge/")))
		await copy(join(adapterRoot, path), `${metadataRoot}/${path.slice("gmp/share/lean-bridge/".length)}`);
	const metadata = { description: "Compiled Lean API with checked resource-bearing values", ...compiledPackageMetadata(model.sourceIdentity) };
	const licenseFiles = (await nativeArtifactPaths(root)).filter(path => path.startsWith(`${distInfo}/licenses/`)).map(path => path.slice(`${distInfo}/licenses/`.length)).sort();
	const typing = generated.requiresTypeAliases ? 'Requires-Dist: typing_extensions (<5,>=4.6); python_version < "3.12"\n' : "";
	await save(`${distInfo}/METADATA`, `Metadata-Version: 2.4\nName: ${name}\nVersion: ${version}\n${pythonPackageMetadata(metadata)}\n${licenseFiles.map(path => `License-File: ${path}\n`).join("")}Requires-Python: >=3.11\n${typing}Description-Content-Type: text/markdown\n\n${generated.files["README.md"]}`);
	await save(`${distInfo}/WHEEL`, `Wheel-Version: 1.0\nGenerator: lean-bridge-python-owned/${transferredInputs ? 2 : 1}\nRoot-Is-Purelib: false\nTag: ${tag}\n`);
	await save(`${distInfo}/top_level.txt`, `${moduleName}\n`);
	const pythonFiles = (await nativeArtifactPaths(root)).filter(path => /\.pyi?$/u.test(path));
	await processBuildRunner.capture({ command: environment.LEAN_BRIDGE_PYTHON ?? "python3"
		, args: ["-I", "-B", "-c", 'import ast, pathlib, sys; assert sys.version_info >= (3, 11), "Python 3.11+ is required"; [ast.parse(pathlib.Path(path).read_text(encoding="utf-8"), filename=path) for path in sys.argv[1:]]', ...pythonFiles]
		, cwd: root, env: environment, signal });
	const files = {};
	for(const path of await nativeArtifactPaths(root))
	{ const bytes = await readFile(join(root, path)); files[path] = { bytes: bytes.length, sha256: sha256(bytes) }; }
	await save(`${metadataRoot}/package-receipt.json`, canonicalJson({ schemaVersion: transferredInputs ? 3 : 2
		, kind: "lean-bridge-owned-python-package", ecosystem: "pypi"
		, name, version, moduleName, tag, component: model.component
		, bindingIrSha256: model.bindingIrSha256
		, runtimeIdentity: evidence.runtimeIdentity
		, sourceIdentity: model.sourceIdentity, glibcMinimumVersion
		, ownedValues: generated.contract, files }));
	const record = [];
	for(const path of await nativeArtifactPaths(root))
	{ const bytes = await readFile(join(root, path)); record.push(`${path},sha256=${Buffer.from(sha256(bytes), "hex").toString("base64url")},${bytes.length}`); }
	record.push(`${distInfo}/RECORD,,`);
	await save(`${distInfo}/RECORD`, `${record.join("\n")}\n`);
	const archive = `${distribution}-${version}-${tag}.whl`, bytes = await createDeterministicZip({ directory: root, sourceDateEpoch: 315532800 });
	await mkdir(join(working, "archives"), { recursive: true });
	await writeFile(join(working, "archives", archive), bytes, { flag: "wx" });
	return { ecosystem: "pypi"
		, backend: transferredInputs ? "owned-python-v2" : "owned-python-v1"
		, runtimeIdentity: evidence.runtimeIdentity, glibcMinimumVersion, moduleName
		, packages: [{ archive, name, version, tag, bytes: bytes.length, sha256: sha256(bytes), compilerAccess: false }] };
};
