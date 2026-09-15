/**
 * Assemble ordinary Python platform wheels from verified native compilation.
 *
 * @file
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { readVerifiedSourceNotices } from "./source-notices.mjs";
import { nativeArtifactPaths } from "../build/native-artifacts.mjs";
import { ordinaryPythonEvidence } from "../build/native-python-artifacts.mjs";
import { processBuildRunner } from "../build/process-runner.mjs";
import { generateCopiedPythonPackage } from "../backends/python/copied-values.mjs";
import { validateOrdinaryPythonSettings } from "../backends/python/copied-model.mjs";
import { auditPythonPackage } from "../backends/python/package-audit.mjs";
import { createDeterministicZip } from "./deterministic-zip.mjs";

/**
 * Package a deterministic wheel without recompiling Lean or requiring setuptools.
 *
 * @param options - Closed native artifacts, coordinates and syntax-check environment.
 */
export const packageOrdinaryPython = async options => {
	const { working, nativeRoot, runtimeRoot, adapterRoot, leanPrefix, settings = {}, glibcMinimumVersion, environment = process.env, signal } = options;
	validateOrdinaryPythonSettings(settings);
	if(!/^2\.\d+$/.test(glibcMinimumVersion)) throw new TypeError("Invalid Python native glibc floor");
	const { model, projection, evidence, receipt } = await ordinaryPythonEvidence(options);
	const name = settings.name ?? `lean-${projection.surface.prefix.replaceAll("_", "-")}`;
	const version = settings.version ?? (model.component.version === "0.0.0-local" ? "0.0.0+local" : model.component.version);
	validateOrdinaryPythonSettings({ name, version });
	const root = join(working, "packages/pypi/wheel"), files = generateCopiedPythonPackage(model.bindingIr, evidence);
	auditPythonPackage(model.bindingIr, files);
	const moduleName = projection.packageDir, metadataRoot = `${moduleName}/lean_bridge`;
	const save = async (path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes, { flag: "wx" }); };
	const copy = async (source, path) => save(path, await readFile(source));
	for(const [path, text] of Object.entries(files)) await save(path.startsWith(`${moduleName}/`) ? path : `${metadataRoot}/${path}`, text);
	for(const file of Object.keys(evidence.libraries))
		await copy(file === evidence.library ? join(adapterRoot, "lib", file) : file === receipt.library ? join(nativeRoot, file) : join(runtimeRoot, "lib", file), `${moduleName}/native/linux-x64/${file}`);
	for(const path of ["native-component.json", "model.json", "metadata.json", "binding-ir.json", "generated.lean", "component.h", "artifacts.json"])
		await copy(join(nativeRoot, path), `${metadataRoot}/component/${path}`);
	if(receipt.sourceIdentity.lakeDependencies?.generatedSourcesSha256 !== undefined) await copy(join(nativeRoot, "lake-generated-sources.json"), `${metadataRoot}/component/lake-generated-sources.json`);
	await copy(join(adapterRoot, "native-c-adapter.json"), `${metadataRoot}/native-c-adapter.json`);
	await copy(join(adapterRoot, `include/${projection.surface.prefix}.h`), `${metadataRoot}/include/${projection.surface.prefix}.h`);
	await copy(join(runtimeRoot, "runtime.json"), `${metadataRoot}/runtime.json`);
	const distribution = name.replaceAll("-", "_"), distInfo = `${distribution}-${version}.dist-info`;
	const tag = `py3-none-manylinux_${glibcMinimumVersion.replace(".", "_")}_x86_64`;
	await copy(join(leanPrefix, "LICENSE"), `${distInfo}/licenses/Lean-LICENSE`);
	await copy(join(leanPrefix, "LICENSES"), `${distInfo}/licenses/Lean-LICENSES`);
	for(const [path, bytes] of (await readVerifiedSourceNotices(nativeRoot, model.sourceIdentity)).files) await save(`${distInfo}/licenses/${path}`, bytes);
	await copy(fileURLToPath(new URL("../../LICENSE", import.meta.url)), `${distInfo}/licenses/LeanBridge-LICENSE`);
	await save(`${distInfo}/METADATA`, `Metadata-Version: 2.1\nName: ${name}\nVersion: ${version}\nSummary: Compiled Lean API with generated Python copied-value conversions\nLicense: See bundled license notices\nRequires-Python: >=3.11\nDescription-Content-Type: text/markdown\n\n${files["README.md"]}`);
	await save(`${distInfo}/WHEEL`, `Wheel-Version: 1.0\nGenerator: lean-bridge-python-copied/1\nRoot-Is-Purelib: false\nTag: ${tag}\n`);
	await save(`${distInfo}/top_level.txt`, `${moduleName}\n`);
	const pythonFiles = (await nativeArtifactPaths(root)).filter(path => /\.pyi?$/.test(path));
	await processBuildRunner.capture({ command: environment.LEAN_BRIDGE_PYTHON ?? "python3", args: ["-I", "-B", "-c", 'import ast, pathlib, sys; assert sys.version_info >= (3, 11), "Python 3.11+ is required"; [ast.parse(pathlib.Path(path).read_text(encoding="utf-8"), filename=path) for path in sys.argv[1:]]', ...pythonFiles], cwd: root, env: environment, signal });
	const inventory = {};
	for(const path of await nativeArtifactPaths(root))
	{ const bytes = await readFile(join(root, path)); inventory[path] = { bytes: bytes.length, sha256: sha256(bytes) }; }
	await save(`${metadataRoot}/package-receipt.json`, canonicalJson({ schemaVersion: 1, kind: "lean-bridge-ordinary-python-package", ecosystem: "pypi", name, version, moduleName, tag, component: model.component, bindingIrSha256: model.bindingIrSha256, runtimeIdentity: evidence.runtimeIdentity, sourceIdentity: model.sourceIdentity, glibcMinimumVersion, files: inventory }));
	const record = [];
	for(const path of await nativeArtifactPaths(root))
	{ const bytes = await readFile(join(root, path)); record.push(`${path},sha256=${Buffer.from(sha256(bytes), "hex").toString("base64url")},${bytes.length}`); }
	record.push(`${distInfo}/RECORD,,`);
	await save(`${distInfo}/RECORD`, `${record.join("\n")}\n`);
	const archive = `${distribution}-${version}-${tag}.whl`, bytes = await createDeterministicZip({ directory: root, sourceDateEpoch: 315532800 });
	await mkdir(join(working, "archives"), { recursive: true });
	await writeFile(join(working, "archives", archive), bytes, { flag: "wx" });
	return { ecosystem: "pypi", backend: "ordinary-python-v1", runtimeIdentity: evidence.runtimeIdentity, glibcMinimumVersion, moduleName, packages: [{ archive, name, version, tag, bytes: bytes.length, sha256: sha256(bytes), compilerAccess: false }] };
};
