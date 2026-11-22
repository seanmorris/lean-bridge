/**
 * Build a relocatable Linux C11 task and stream archive with its pinned shared runtime.
 *
 * @file
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { hashBindingIr } from "../binding-ir/canonical.mjs";
import { compileHostSources } from "../build/host-elaboration.mjs";
import { readVerifiedNativeRuntime, validateNativeElf } from "../build/native-artifacts.mjs";
import { pinnedCompiledLean } from "../build/elaborated-component.mjs";
import { processBuildRunner } from "../build/process-runner.mjs";
import { generateCTaskExports } from "../backends/c/task-exports.mjs";
import { validateNativeCSettings } from "./native-c-family.mjs";
import { createDeterministicTarGzFromFiles } from "./deterministic-archive.mjs";
import { writePackageSetReceipt } from "./package-set-receipt.mjs";

const asset = path => readFile(new URL(path, import.meta.url));

/**
 * Compile the captured project and assemble its installed header, libraries, notices and receipt.
 *
 * @param options - Captured source contract, verified toolchain and private release directories.
 */
export const buildCTaskPackage = async options => {
	const { projectContract, name, version, workRoot, runtimeRoot, leanPrefix, environment, signal } = options;
	validateNativeCSettings({ name, version });
	if(options.ir || !name || !version || options.sources.some(s => /^(?:LeanBridge(?:\.|$)|BridgeCAsync$)/u.test(s.module))) throw new TypeError("Invalid C task source modules or coordinates");
	const { identity: runtimeIdentity, manifest } = await readVerifiedNativeRuntime(runtimeRoot);
	const run = (command, args, cwd, env = environment) => processBuildRunner.capture({ command, args, cwd, env, signal });
	if(manifest.leanCommit !== pinnedCompiledLean || !(await run(join(leanPrefix, "bin/lean"), ["--version"], workRoot)).stdout.includes(pinnedCompiledLean)) throw new Error("C task compiler/runtime pin differs");
	const stage = await mkdtemp(join(workRoot, ".c-task-"));
	try
	{
		const app = join(stage, "producer");
		const { entries, objects, api, env, evidence } = await compileHostSources({ ...options, app, run });
		const bindingIrSha256 = hashBindingIr(api), profile = "native-c-task-v1";
		const delivery = await asset("../backends/c/task-delivery.h"), notification = await asset("../backends/native/task-notification.h");
		const config = { name, modules: projectContract.modules, entries };
		const skeleton = generateCTaskExports({ ...config, componentIdentity: "0".repeat(64) });
		const componentIdentity = sha256(canonicalJson({ runtimeIdentity
			, bindingIrSha256
			, evidence
			, skeleton
			, delivery: sha256(delivery), notification: sha256(notification) }));
		const gen = generateCTaskExports({ ...config, componentIdentity }), p = gen.prefix;
		const save = (f, data) => writeFile(join(app, f), data, { flag: "wx" });
		await save("BridgeCAsync.lean", gen.entryLean);
		await run(join(leanPrefix, "bin/lean"), ["-j1", "-c", "entry.c", "BridgeCAsync.lean"], app, env);
		await save("checked-entry.c", `#include "entry.c"\n${gen.declarations}\n`);
		await save(`${p}.h`, gen.header); await save("adapter.c", gen.source);
		await save("task-delivery.h", delivery); await save("task-notification.h", notification);
		await save("exports.map", `{ global: ${gen.symbols.join("; ")}; local: *; };\n`);
		const library = `lib${p}.so`;
		await run(environment.CC ?? "cc", ["-std=gnu11"
			, "-O1"
			, "-g0"
			, "-shared"
			, "-fPIC"
			, "-I"
			, join(runtimeRoot, "include")
			, `-ffile-prefix-map=${runtimeRoot}=/build/lean-bridge/runtime`
			, `-ffile-prefix-map=${app}=/build/lean-bridge/component`
			, ...objects
			, "checked-entry.c"
			, "adapter.c"
			, "-L"
			, join(runtimeRoot, "lib")
			, "-lleanshared"
			, "-llean_bridge_native"
			, "-pthread"
			, "-lm"
			, "-Wl,-z,defs,-z,nodelete"
			, "-Wl,--build-id=none"
			, "-Wl,--version-script=exports.map"
			, `-Wl,-soname,${library}`
			, "-Wl,-rpath,$ORIGIN", "-o", library], app);
		const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38";
		if(!/^2\.\d+$/u.test(floor)) throw new TypeError("Invalid native glibc floor");
		const files = new Map(), sharedLibs = Object.keys(manifest.files).filter(f => f.startsWith("lib/"));
		for(const [path, file] of [[`lib/${library}`, join(app, library)], ...sharedLibs.map(f => [f, join(runtimeRoot, f)])])
		{
			const bytes = await readFile(file); validateNativeElf(bytes);
			if(file === join(app, library) && bytes.includes(Buffer.from(workRoot))) throw new Error("C task library retained a private staging path");
			for(const m of (await run("readelf", ["--version-info", file], app)).stdout.matchAll(/GLIBC_(\d+)\.(\d+)(?:\.(\d+))?/gu))
				if(+m[1] > 2 || (+m[1] === 2 && (+m[2] > +floor.slice(2) || (+m[2] === +floor.slice(2) && +m[3] > 0)))) throw new Error(`C task library exceeds glibc ${floor}: ${m[0]}`);
			if(file !== join(app, library) && sha256(bytes) !== manifest.files[path].sha256) throw new Error("C task runtime changed during packaging");
			files.set(path, bytes);
		}
		const cmakePackage = `LeanBridge${p.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join("")}`;
		const cmakeTarget = `LeanBridge::${p}`, share = "share/lean-bridge";
		files.set(`include/${p}.h`, gen.header);
		files.set(`lib/pkgconfig/${name}.pc`, `prefix=\${pcfiledir}/../..
includedir=\${prefix}/include
libdir=\${prefix}/lib
Name: ${name}
Description: Compiled Lean C11 tasks
Version: ${version}
Libs: -L\${libdir} -Wl,-rpath,\${libdir} -l${p}
Cflags: -I\${includedir}
`);
		files.set(`lib/cmake/${cmakePackage}/${cmakePackage}Config.cmake`, `if(NOT TARGET ${cmakeTarget})
  get_filename_component(_lb_root "\${CMAKE_CURRENT_LIST_DIR}/../../.." ABSOLUTE)
  add_library(${cmakeTarget} SHARED IMPORTED)
  set_target_properties(${cmakeTarget} PROPERTIES IMPORTED_LOCATION "\${_lb_root}/lib/${library}" INTERFACE_INCLUDE_DIRECTORIES "\${_lb_root}/include")
  unset(_lb_root)
endif()
`);
		files.set(`${share}/binding-ir.json`, canonicalJson(api)); files.set(`${share}/elaboration.json`, canonicalJson(evidence));
		files.set(`${share}/generated.lean`, gen.entryLean); files.set(`${share}/runtime.json`, canonicalJson(manifest));
		files.set(`${share}/licenses/LeanBridge-LICENSE`, await asset("../../LICENSE"));
		for(const f of ["LICENSE", "LICENSES"]) files.set(`${share}/licenses/Lean-${f}`, await readFile(join(leanPrefix, f)));
		for(const [path, bytes] of Object.entries(projectContract.notices)) files.set(`${share}/licenses/${path}`, bytes);
		files.set("package-metadata.json", canonicalJson(projectContract.metadata ?? {}));
		files.set("README.md", `# ${name} ${version}\n\nLinux x86-64, glibc ${floor} or later. Include ${p}.h and link with pkg-config package ${name} or CMake target ${cmakeTarget} (find_package(${cmakePackage} CONFIG REQUIRED)). The shared Lean runtime initializes automatically.\n\nUse the API on the process main thread. Zero-initialize handles. A task starts immediately; a stream starts its factory but does not pull until _pull. Only one pull can be outstanding. _poll returns OK when ready, or PENDING with a borrowed descriptor: wait for readability without reading or closing it. _take never blocks. A task result, stream END or failed step consumes the handle; a stream item leaves it idle. _close cancels outstanding work without waiting for it. Copied stale handles do not become valid again. Dispose owned output buffers (including nested results) before reuse. String inputs are strict length-delimited UTF-8. IO_ERROR, typed failures, and returned Except values are distinct.\n`);
		const records = [...files].map(([path, value]) => ({ path, bytes: Buffer.isBuffer(value) ? value : Buffer.from(value), mode: 0o644 }));
		const inventory = Object.fromEntries(records.map(f => [f.path, { bytes: f.bytes.length, sha256: sha256(f.bytes) }]));
		const component = projectContract.component, archiveRoot = `${name}-${version}-c`;
		const pkg = { schemaVersion: 1
			, kind: "lean-bridge-native-c-package"
			, ecosystem: "c"
			, name
			, version
			, component
			, profile
			, componentIdentity
			, runtimeIdentity
			, bindingIrSha256
			, glibcMinimumVersion: floor
			, cmakePackage
			, cmakeTarget
			, pkgConfig: name
			, files: inventory };
		records.push({ path: "lean-bridge-package.json", mode: 0o644, bytes: Buffer.from(canonicalJson(pkg)) });
		const data = createDeterministicTarGzFromFiles({ files: records.map(f => ({ ...f, path: `${archiveRoot}/${f.path}` })), sourceDateEpoch: 1 });
		const archive = `${archiveRoot}.tar.gz`;
		await writeFile(join(options.output, archive), data, { flag: "wx" });
		const receipt = await writePackageSetReceipt({ root: workRoot
			, component
			, source: { treeSha256: projectContract.sourceTreeSha256 }
			, profiles: [{ id: profile, bindingIrSha256, runtimeIdentity }], signal
			, packages: [{ target: "c"
				, ecosystem: "c"
				, name
				, version
				, profile
				, role: "component"
				, runtimeIdentity
				, runtimeDelivery: "embedded"
				, requires: []
				, artifacts: [{ path: `archives/${archive}`, bytes: data.length, sha256: sha256(data) }] }] });
		return { receipt, api, evidence, bindingIrSha256, runtimeIdentity };
	} finally
	{
		await rm(stage, { recursive: true, force: true });
	}
};
