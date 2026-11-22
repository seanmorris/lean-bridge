/**
 * Build installable native CPython host-import wheels from explicit producer inputs.
 * This lower-level assembly is not a substitute for ordinary/reviewed project analysis.
 *
 * @file
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { pinnedCompiledLean } from "../build/elaborated-component.mjs";
import { readVerifiedNativeRuntime, validateNativeElf } from "../build/native-artifacts.mjs";
import { processBuildRunner } from "../build/process-runner.mjs";
import { generatePythonHostExtension } from "../backends/python/host-exports.mjs";
import { createDeterministicZip } from "./deterministic-zip.mjs";
import { writeWheelRecord } from "./pypi-package.mjs";
import { writePackageSetReceipt } from "./package-set-receipt.mjs";

const moduleName = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/u;
const runtimeModule = "lean_bridge_host_runtime", runtimePackage = "lean-bridge-host-runtime";
const loaderPath = new URL("../backends/python/host-runtime.py", import.meta.url);
const loaderVersion = (nativeIdentity, loader) => `1+${nativeIdentity}.${sha256(loader)}`;
const platformTag = "linux_x86_64";
const normalize = name => name.replaceAll("-", "_");
const save = async (root, path, value) => {
	const file = join(root, path); await mkdir(dirname(file), { recursive: true });
	await writeFile(file, value, { flag: "wx" });
};
const workspace = async (workRoot, fn) => {
	const stage = await mkdtemp(join(resolve(workRoot), ".python-host-"));
	try
	{ return await fn(stage); }
	finally
	{ await rm(stage, { force: true, recursive: true }); }
};
const notice = fileURLToPath(new URL("../../LICENSE", import.meta.url));
const wheel = async ({ stage, output, name, version, tag, summary, requires = "", licenses }) => {
	const root = join(stage, "wheel"), dist = `${normalize(name)}-${version}.dist-info`;
	for(const [key, bytes] of Object.entries(licenses)) await save(root, `${dist}/licenses/${key}`, bytes);
	await save(root, `${dist}/WHEEL`, `Wheel-Version: 1.0\nGenerator: lean-bridge-python-host/1\nRoot-Is-Purelib: false\nTag: ${tag}\n`);
	await save(root, `${dist}/METADATA`, `Metadata-Version: 2.4\nName: ${name}\nVersion: ${version}\nSummary: ${summary}\nRequires-Python: >=3.11\n${requires}${Object.keys(licenses).map(n => `License-File: ${n}\n`).join("")}\n`);
	await writeWheelRecord(root, dist);
	const bytes = await createDeterministicZip({ directory: root, sourceDateEpoch: 315532800 });
	const archive = `${normalize(name)}-${version}-${tag}.whl`;
	await save(output, archive, bytes); return { name, version, archive, sha256: sha256(bytes), bytes: bytes.length, tag };
};

/**
 * Assemble one shared dependency for all compatible host-component wheels.
 *
 * @param options - Verified runtime, matching Lean distribution, staging parent and handoff directory.
 */
export const packagePythonHostRuntime = async options => {
	const { runtimeRoot, leanPrefix, workRoot, output } = options;
	const { identity, manifest } = await readVerifiedNativeRuntime(runtimeRoot);
	if(manifest.leanCommit !== pinnedCompiledLean) throw new Error("host runtime compiler pin differs");
	return workspace(workRoot, async stage => {
		const root = join(stage, "wheel", runtimeModule), loader = await readFile(loaderPath), version = loaderVersion(identity, loader);
		await save(root, "runtime.json", await readFile(join(runtimeRoot, "runtime.json")));
		for(const path of Object.keys(manifest.files).filter(p => p.startsWith("lib/")))
			await save(root, path, await readFile(join(runtimeRoot, path)));
		await save(root, "__init__.py", loader);
		const archive = await wheel({
			stage, output, name: runtimePackage, version, tag: `py3-none-${platformTag}`
			, summary: "Shared Lean runtime for compiled host imports"
			, licenses: {
				"LeanBridge-LICENSE": await readFile(notice)
				, "Lean-LICENSE": await readFile(join(leanPrefix, "LICENSE"))
				, "Lean-LICENSES": await readFile(join(leanPrefix, "LICENSES"))
			}
		});
		return { ...archive, runtimeIdentity: identity };
	});
};
const pythonConfig = `import json, platform, sys, sysconfig as c
from pathlib import Path
assert sys.implementation.name == "cpython" and sys.version_info[:2] in ((3,11),(3,12))
assert sys.platform == "linux" and platform.machine() == "x86_64" and not c.get_config_var("Py_DEBUG")
lib = c.get_config_var("LDLIBRARY")
paths = (Path(sys.base_prefix)/"lib"/lib,Path(c.get_config_var("LIBDIR"))/lib)
print(json.dumps([c.get_path("include"), str(next(p for p in paths if p.is_file())), c.get_config_var("EXT_SUFFIX"), "cp%d%d"%sys.version_info[:2]]))`;

/**
 * Compile the application and generated declarations in an isolated staging directory.
 * The caller supplies captured producer modules in dependency order and source license text.
 *
 * @param options - Producer source, reviewed named entry signatures, import contract and tools.
 */
export const buildPythonHostWheel = async options => {
	const { sources, module, entries, ir, name, version, license, runtimeRoot, leanPrefix, python, workRoot, output, cc = "cc" } = options;
	if(!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(name) || name === runtimePackage || !/^\d+\.\d+\.\d+$/u.test(version)
		|| !sources?.length || !license || !sources.some(s => s.module === module) || new Set(sources.map(s => s.module)).size !== sources.length
		|| sources.some(s => !moduleName.test(s.module) || /^(?:LeanBridge(?:\.|$)|BridgeHostExports$)/u.test(s.module) || typeof s.source !== "string"))
		throw new TypeError("invalid Python host component source, license or package coordinates");
	const { identity, manifest } = await readVerifiedNativeRuntime(runtimeRoot);
	const run = (command, args, cwd, env = process.env) => processBuildRunner.capture({ command, args, cwd, env });
	if(manifest.leanCommit !== pinnedCompiledLean || !(await run(join(leanPrefix, "bin/lean"), ["--version"], workRoot)).stdout.includes(pinnedCompiledLean))
		throw new Error("host component compiler/runtime pin differs");
	return workspace(workRoot, async stage => {
		const [include, pylib, suffix, abi] = JSON.parse((await run(python, ["-I", "-c", pythonConfig], stage)).stdout);
		const tag = `${abi}-${abi}-${platformTag}`, pkg = normalize(name);
		const config = { ir, module, entries, runtimeIdentity: identity };
		const skeleton = generatePythonHostExtension({ ...config, componentIdentity: "0".repeat(64) });
		const sourceIdentity = sources.map(s => ({ module: s.module, sha256: sha256(s.source) }));
		const sourceTreeSha256 = sha256(canonicalJson({ name, version, module, entries, sourceIdentity, bindingIrSha256: skeleton.bindingIrSha256, licenseSha256: sha256(license) }));
		const runtimePackageVersion = loaderVersion(identity, await readFile(loaderPath));
		const componentIdentity = sha256(canonicalJson({ sourceTreeSha256, skeleton, tag, runtimePackageVersion }));
		const generated = generatePythonHostExtension({ ...config, componentIdentity });
		const app = join(stage, "producer"), root = join(stage, "wheel", pkg);
		const env = { ...process.env, LEAN_PATH: app, LEAN_NUM_THREADS: "1" }, objects = [];
		const modules = [{ module: "LeanBridge.Host.Python", source: generated.hostLean }, ...sources, { module: "BridgeHostExports", source: generated.entryLean }];
		for(const [i, s] of modules.entries())
		{
			const relative = s.module.replaceAll(".", "/");
			await save(app, `${relative}.lean`, s.source);
			await run(join(leanPrefix, "bin/lean"), ["-j1", "-o", `${relative}.olean`, "-c", `module${i}.c`, `${relative}.lean`], app, env);
			objects.push(`module${i}.c`);
		}
		await save(app, "provider.c", generated.source);
		await save(app, "exports.map", "{ global: PyInit__native; local: *; };\n");
		await mkdir(root, { recursive: true });
		const binary = `_native${suffix}`;
		await run(cc, [
			"-std=gnu11", "-O1", "-g0", "-shared", "-fPIC"
			, "-I", join(runtimeRoot, "include"), "-I", include, ...objects
			, "provider.c", "-L", join(runtimeRoot, "lib")
			, "-lleanshared", "-llean_bridge_native", pylib
			, "-Wl,-z,defs", "-Wl,--build-id=none", "-Wl,--version-script=exports.map"
			, `-Wl,-rpath,$ORIGIN/../${runtimeModule}/lib`
			, "-pthread", "-lm", "-o", join(root, binary)
		], app);
		const bytes = await readFile(join(root, binary)); validateNativeElf(bytes);
		await save(root, "__init__.py", `from ${runtimeModule} import _verify
from hashlib import file_digest as _digest
from pathlib import Path as _Path
_runtime = _verify("${identity}")
with (_Path(__file__).parent / "${binary}").open("rb") as _binary:
    if _digest(_binary, "sha256").hexdigest() != "${sha256(bytes)}":
        raise ImportError("compiled Lean component identity differs")
${generated.python}
if not _native._matches_runtime(*_runtime):
    raise ImportError("extension resolved a different Lean runtime")
del _runtime
`);
		await save(root, "__init__.pyi", generated.stub); await save(root, "py.typed", "");
		await save(root, "host_types.py", generated.types);
		await save(root, "host-component.json", canonicalJson({
			schemaVersion: 1, componentIdentity, sourceIdentity
			, runtimeIdentity: identity, bindingIrSha256: generated.bindingIrSha256
			, entries, module, tag, binary, binarySha256: sha256(bytes)
			, runtimePackageVersion
		}));
		const archive = await wheel({
			stage, output, name, version, tag
			, summary: "Compiled Lean component with generated Python host imports"
			, requires: `Requires-Dist: ${runtimePackage} (==${runtimePackageVersion})\n`
			, licenses: { "Source-LICENSE": license, "LeanBridge-LICENSE": await readFile(notice) } });
		return { ...archive, runtimeIdentity: identity, runtimePackageVersion, componentIdentity, sourceTreeSha256, bindingIrSha256: generated.bindingIrSha256 };
	});
};

/**
 * Verify and close a pair of original archives as a standard Lean Bridge package set.
 *
 * @param options - Handoff directory and compiler/runtime archive reports.
 */
export const writePythonHostPackageSet = async options => {
	const { root, runtime, component } = options;
	if(runtime.name !== runtimePackage || runtime.runtimeIdentity !== component.runtimeIdentity
		|| runtime.version !== component.runtimePackageVersion) throw new Error("incompatible Python host runtime package");
	const profile = { id: "native-python-host-v1", runtimeIdentity: runtime.runtimeIdentity, bindingIrSha256: component.bindingIrSha256 };
	const requires = [{ ecosystem: "pypi", name: runtime.name, version: runtime.version }];
	const packages = [runtime, component].map((p, i) => ({
		ecosystem: "pypi", target: "pypi", name: p.name, version: p.version
		, profile: profile.id, runtimeIdentity: runtime.runtimeIdentity
		, runtimeDelivery: i ? "dependency" : "provided"
		, role: i ? "component" : "runtime"
		, requires: i ? requires : []
		, artifacts: [{ path: p.archive, bytes: p.bytes, sha256: p.sha256 }]
	}));
	return writePackageSetReceipt({
		root, profiles: [profile], packages
		, component: { id: `python/${component.name}@${component.version}`, name: component.name, version: component.version }
		, source: { treeSha256: component.sourceTreeSha256 } });
};
