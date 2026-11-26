/**
 * Build installable native CPython host-import wheels from explicit producer inputs.
 * The project build derives its entry signatures from freshly compiled interfaces.
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
import { validateOrdinaryPythonSettings } from "../backends/python/copied-model.mjs";
import { pythonPackageMetadata } from "../analyze/package-metadata.mjs";
import {hostPublicHash} from "../analyze/host-records.mjs";
import { compileHostSources } from "../build/host-elaboration.mjs";
import { compileTaskResourceLedger, taskResourceLedger } from "../build/task-resource-ledger.mjs";
import { createDeterministicZip } from "./deterministic-zip.mjs";
import { writeWheelRecord } from "./wheel-record.mjs";
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
const wheel = async ({ stage, output, name, version, tag, summary, metadata = {}, requires = "", licenses }) => {
	const root = join(stage, "wheel"), dist = `${normalize(name)}-${version}.dist-info`;
	for(const [key, bytes] of Object.entries(licenses)) await save(root, `${dist}/licenses/${key}`, bytes);
	await save(root, `${dist}/WHEEL`, `Wheel-Version: 1.0\nGenerator: lean-bridge-python-host/1\nRoot-Is-Purelib: false\nTag: ${tag}\n`);
	const fields = pythonPackageMetadata({ description: summary, ...metadata });
	await save(root, `${dist}/METADATA`, `Metadata-Version: 2.4\nName: ${name}\nVersion: ${version}\n${fields}\nRequires-Python: >=3.11\n${requires}${Object.keys(licenses).map(n => `License-File: ${n}\n`).join("")}\n`);
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
	const { sources, module, projectContract, ir, name, version, license, runtimeRoot, leanPrefix, python, workRoot, output, cc = "cc", environment = process.env, signal } = options;
	validateOrdinaryPythonSettings({ name, version });
	if(!name || !version || name === runtimePackage || !sources?.length || (!license && !projectContract?.notices)
		|| !sources.some(s => s.module === module) || new Set(sources.map(s => s.module)).size !== sources.length
		|| sources.some(s => !moduleName.test(s.module) || /^(?:LeanBridge(?:\.|$)|BridgeHostExports$)/u.test(s.module) || typeof s.source !== "string"))
		throw new TypeError("invalid Python host component source, license or package coordinates");
	const { identity, manifest } = await readVerifiedNativeRuntime(runtimeRoot);
	const run = (command, args, cwd, env = environment) => processBuildRunner.capture({ command, args, cwd, env, signal });
	if(manifest.leanCommit !== pinnedCompiledLean || !(await run(join(leanPrefix, "bin/lean"), ["--version"], workRoot)).stdout.includes(pinnedCompiledLean))
		throw new Error("host component compiler/runtime pin differs");
	return workspace(workRoot, async stage => {
		const [include, pylib, suffix, abi] = JSON.parse((await run(python, ["-I", "-c", pythonConfig], stage)).stdout);
		const tag = `${abi}-${abi}-${platformTag}`, pkg = normalize(name);
		const app = join(stage, "producer"), root = join(stage, "wheel", pkg);
		const { entries, env, objects, api, evidence } = await compileHostSources({ ...options, environment, run, app });
		const synchronous = projectContract?.synchronousIO === true;
		const leanResources = api?.types.filter(t => t.kind === "resource" && !t.host && t.source?.producer === "lean") ?? [];
		const ledger = leanResources.length ? await taskResourceLedger(identity) : null;
		const config = { ir, module, entries, runtimeIdentity: identity
			, modules: projectContract?.modules, synchronousIO: synchronous
			, pythonTaskObjects: evidence?.selection.pythonTaskObjects===true
			, ...ledger ? { leanResources, ledgerId: ledger.id } : {} };
		const leaseLoader = ledger && await readFile(new URL("../backends/python/resource-loader.py", import.meta.url), "utf8");
		const skeleton = generatePythonHostExtension({ ...config, componentIdentity: "0".repeat(64) });
		const sourceIdentity = sources.map(s => ({ module: s.module, sha256: sha256(s.source) }));
		const sourceTreeSha256 = projectContract?.sourceTreeSha256 ?? sha256(canonicalJson({ name, version, module, entries, sourceIdentity, bindingIrSha256: skeleton.bindingIrSha256, licenseSha256: sha256(license) }));
		const runtimePackageVersion = loaderVersion(identity, await readFile(loaderPath));
		const componentIdentity = sha256(canonicalJson({ sourceTreeSha256
			, skeleton, tag, runtimePackageVersion
			, ...(evidence ? { provenance: evidence } : {})
			, ...ledger ? { resourceLedger: ledger.id, loader: sha256(leaseLoader) } : {} }));
		const generated = generatePythonHostExtension({ ...config, componentIdentity });
		await save(app, "BridgeHostExports.lean", generated.entryLean);
		await run(join(leanPrefix, "bin/lean"), ["-j1", "-c", "entry.c", "BridgeHostExports.lean"], app, env);
		// A linker cannot check C prototypes across translation units. Compile the
		// exact declarations used by the extension beside Lean's emitted definitions.
		await save(app, "checked-entry.c", `#include "entry.c"\n${generated.entryDeclarations}\n`);
		objects.push("checked-entry.c");
		await save(app, "provider.c", generated.source);
		await save(app, "exports.map", "{ global: PyInit__native; local: *; };\n");
		await mkdir(root, { recursive: true });
		const binary = `_native${suffix}`;
		let ledgerDigest;
		if(ledger)
		{
			await compileTaskResourceLedger({ ledger, app, runtimeRoot, cc, run });
			const bytes = await readFile(join(app, ledger.name)); validateNativeElf(bytes);
			ledgerDigest = sha256(bytes); await save(root, ledger.name, bytes);
		}
		await run(cc, [
			"-std=gnu11", "-O1", "-g0", "-shared", "-fPIC"
			// Lean and CPython headers can embed __FILE__ even with no debug info.
			, `-ffile-prefix-map=${workRoot}=/build/lean-bridge`
			, `-ffile-prefix-map=${app}=/build/lean-bridge/component`
			, `-ffile-prefix-map=${runtimeRoot}=/build/lean-bridge/runtime`
			, `-ffile-prefix-map=${include}=/build/lean-bridge/${abi}/include`
			, "-I", join(runtimeRoot, "include"), "-I", include, ...objects
			, "provider.c", "-L", join(runtimeRoot, "lib")
			, "-lleanshared", "-llean_bridge_native", pylib
			, ...ledger ? [ledger.flag, "-L.", "-l:" + ledger.name, "-Wl,-z,nodelete", "-Wl,-rpath,$ORIGIN"] : []
			, "-Wl,-z,defs", "-Wl,--build-id=none", "-Wl,--version-script=exports.map"
			, `-Wl,-rpath,$ORIGIN/../${runtimeModule}/lib`
			, "-pthread", "-lm", "-o", join(root, binary)
		], app);
		const bytes = await readFile(join(root, binary)); validateNativeElf(bytes);
		if([resolve(workRoot), resolve(include)].some(path => bytes.includes(Buffer.from(path))))
			throw new Error("CPython extension retained a private producer or SDK path");
		await save(root, "__init__.py", `from ${runtimeModule} import _verify
from hashlib import file_digest as _digest
from pathlib import Path as _Path
_runtime = _verify("${identity}")
with (_Path(__file__).parent / "${binary}").open("rb") as _binary:
    if _digest(_binary, "sha256").hexdigest() != "${sha256(bytes)}":
        raise ImportError("compiled Lean component identity differs")
${ledger ? `${leaseLoader}\n_lb_ledger = _lb_load_ledger("${ledger.id}", "${ledgerDigest}")\n` : ""}${generated.python}
if not _native._matches_runtime(*_runtime):
    raise ImportError("extension resolved a different Lean runtime")
del _runtime${ledger ? '\nif not _native._matches_ledger(_lb_ledger):\n    raise ImportError("extension resolved a different Lean resource ledger")\ndel _lb_ledger' : ""}
`);
		await save(root, "__init__.pyi", generated.stub); await save(root, "py.typed", "");
		await save(root, "host_types.py", generated.types);
		const bindingIrSha256 = api ? hostPublicHash(api) : generated.bindingIrSha256;
		if(api)
		{
			await save(root, "binding-ir.json", canonicalJson(api));
			if(ir) await save(root, "host-imports.json", canonicalJson(ir));
			await save(root, "elaboration.json", canonicalJson(evidence));
		}
		await save(root, "host-component.json", canonicalJson({
			schemaVersion: 1, componentIdentity, sourceIdentity
			, runtimeIdentity: identity, bindingIrSha256
			, hostImportsSha256: generated.bindingIrSha256
			, entries, module, tag, binary, binarySha256: sha256(bytes)
			, runtimePackageVersion, ...ledger ? { resourceLedger: { name: ledger.name, identity: ledger.id, sha256: ledgerDigest } } : {}
		}));
		const archive = await wheel({
			stage, output, name, version, tag
			, summary: ir ? "Compiled Lean component with generated Python host imports" : synchronous ? "Synchronous compiled Lean IO for Python" : "Compiled Lean tasks for Python asyncio"
			, metadata: projectContract?.metadata
			, requires: `Requires-Dist: ${runtimePackage} (==${runtimePackageVersion})\n`
			, licenses: { ...(projectContract?.notices ?? { "Source-LICENSE": license }), "LeanBridge-LICENSE": await readFile(notice) } });
		const profile = synchronous ? "native-python-io-v1" : entries.some(e => e.delivery) ? "native-python-task-v1" : null;
		return { ...archive, runtimeIdentity: identity, runtimePackageVersion, componentIdentity, sourceTreeSha256, bindingIrSha256, ...profile ? { profile } : {}, ...api ? { api, evidence, component: projectContract.component } : {} };
	});
};

/**
 * Verify and close a pair of original archives as a standard Lean Bridge package set.
 *
 * @param options - Handoff directory and compiler/runtime archive reports.
 */
export const writePythonHostPackageSet = async options => {
	const { root, runtime, component, archivePrefix = "" } = options;
	if(runtime.name !== runtimePackage || runtime.runtimeIdentity !== component.runtimeIdentity
		|| runtime.version !== component.runtimePackageVersion) throw new Error("incompatible Python host runtime package");
	const profile = { id: component.profile ?? "native-python-host-v1", runtimeIdentity: runtime.runtimeIdentity, bindingIrSha256: component.bindingIrSha256 };
	const requires = [{ ecosystem: "pypi", name: runtime.name, version: runtime.version }];
	const packages = [runtime, component].map((p, i) => ({
		ecosystem: "pypi", target: "pypi", name: p.name, version: p.version
		, profile: profile.id, runtimeIdentity: runtime.runtimeIdentity
		, runtimeDelivery: i ? "dependency" : "provided"
		, role: i ? "component" : "runtime"
		, requires: i ? requires : []
		, artifacts: [{ path: archivePrefix + p.archive, bytes: p.bytes, sha256: p.sha256 }]
	}));
	return writePackageSetReceipt({
		root, profiles: [profile], packages
		, component: component.component ?? { id: `python/${component.name}@${component.version}`, name: component.name, version: component.version }
		, source: { treeSha256: component.sourceTreeSha256 } });
};
