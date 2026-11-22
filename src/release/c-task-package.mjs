/**
 * Build relocatable Linux C11 and C++20 task archives with their pinned shared runtime.
 *
 * @file
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { hashBindingIr } from "../binding-ir/canonical.mjs";
import { compileHostSources } from "../build/host-elaboration.mjs";
import { readVerifiedNativeRuntime, validateNativeElf } from "../build/native-artifacts.mjs";
import { pinnedCompiledLean } from "../build/elaborated-component.mjs";
import { processBuildRunner } from "../build/process-runner.mjs";
import { generateCTaskExports } from "../backends/c/task-exports.mjs";
import { retainedTask } from "../backends/c/task-callback-exports.mjs";
import { generateCppTaskHeader } from "../backends/cpp/task-exports.mjs";
import { boostSources } from "../backends/cpp/boost.mjs";
import { taskGmpKit } from "../build/task-gmp.mjs";
import { validateNativeCSettings } from "./native-c-family.mjs";
import { createDeterministicTarGzFromFiles } from "./deterministic-archive.mjs";
import { writePackageSetReceipt } from "./package-set-receipt.mjs";
import { writeRustTaskRelease } from "./rust-task-package.mjs";
import { validateOrdinaryCargoSettings } from "../backends/rust/copied-model.mjs";

const asset = path => readFile(new URL(path, import.meta.url));

/**
 * Compile the captured project and assemble its installed header, libraries, notices and receipt.
 *
 * @param options - Captured source contract, verified toolchain and private release directories.
 */
export const buildCTaskPackage = async options => {
	const { projectContract, name, version, workRoot, runtimeRoot, leanPrefix, environment, signal } = options;
	const target = options.target ?? "c", cpp = target === "cpp", rust = target === "cargo";
	if(!["c", "cpp", "cargo"].includes(target)) throw new TypeError("Invalid native task target");
	if(projectContract?.synchronousIO && target !== "c") throw new TypeError("Standalone synchronous C-family packaging currently requires the C11 target");
	(rust ? validateOrdinaryCargoSettings : validateNativeCSettings)({ name, version });
	if(options.ir || !name || !version || options.sources.some(s => /^(?:LeanBridge(?:\.|$)|BridgeCAsync$)/u.test(s.module))) throw new TypeError("Invalid C task source modules or coordinates");
	const { identity: runtimeIdentity, manifest } = await readVerifiedNativeRuntime(runtimeRoot);
	const run = (command, args, cwd, env = environment) => processBuildRunner.capture({ command, args, cwd, env, signal });
	if(manifest.leanCommit !== pinnedCompiledLean || !(await run(join(leanPrefix, "bin/lean"), ["--version"], workRoot)).stdout.includes(pinnedCompiledLean)) throw new Error("C task compiler/runtime pin differs");
	const stage = await mkdtemp(join(workRoot, ".c-task-"));
	try
	{
		const app = join(stage, "producer");
		const { entries, objects, api, env, evidence } = await compileHostSources({ ...options, app, run });
		const synchronous = projectContract.synchronousIO === true;
		const bindingIrSha256 = hashBindingIr(api), profile = `native-${cpp ? "cpp" : "c"}-${synchronous ? "io" : "task"}-v1`;
		const delivery = await asset("../backends/c/task-delivery.h"), notification = await asset("../backends/native/task-notification.h");
		const resources = api.types.filter(t => t.kind === "resource");
		const config = { name, modules: projectContract.modules, entries, resources, synchronousIO: synchronous, rustCallbacks: rust, cppCallbacks: cpp, cCallbacks: target === "c", integerMode: cpp || rust ? "words" : "gmp" };
		const callbackHeaders = new Map();
		if(entries.some(retainedTask)) for(const [file, path] of [["task-callback-queue.h", "../backends/native/"], ["task-callback-port.h", "../backends/c/"]])
			callbackHeaders.set(file, await asset(path + file));
		if(target === "c" && callbackHeaders.size) callbackHeaders.set("task-host-callback.h", await asset("../backends/c/task-host-callback.h"));
		const ledger = resources.length ? {
			header: await asset("../backends/native/task-resource-ledger.h")
			, source: await asset("../backends/native/task-resource-ledger.c")
		} : null;
		const ledgerId = ledger && sha256(canonicalJson({ runtimeIdentity, header: sha256(ledger.header), source: sha256(ledger.source) }));
		const ledgerName = ledger && `liblb_task_resources_${ledgerId}.so`, ledgerFlag = `-DLB_LEASE_PREFIX=lb_task_resource_${ledgerId}_`;
		const skeleton = generateCTaskExports({ ...config, componentIdentity: "0".repeat(64) });
		const integers = skeleton.integerMode && await asset("../backends/c/task-integers.h");
		const gmp = integers && !cpp && !rust && await taskGmpKit({ root: join(stage, "gmp"), environment, signal });
		const boost = integers && cpp && boostSources();
		const componentIdentity = sha256(canonicalJson({ runtimeIdentity
			, bindingIrSha256
			, evidence
			, skeleton
			, delivery: sha256(delivery), notification: sha256(notification)
			, ...callbackHeaders.size ? { callbacks: Object.fromEntries([...callbackHeaders].map(([f, b]) => [f, sha256(b)])) } : {}
			, ...ledger ? { resourceLedger: ledgerId } : {}
			, ...integers ? { integerAdapter: sha256(integers) } : {}
			, ...gmp ? { gmpKit: gmp.identity } : {} }));
		const gen = generateCTaskExports({ ...config, componentIdentity }), p = gen.prefix;
		const save = (f, data) => writeFile(join(app, f), data, { flag: "wx" });
		await save("BridgeCAsync.lean", gen.entryLean);
		await run(join(leanPrefix, "bin/lean"), ["-j1", "-c", "entry.c", "BridgeCAsync.lean"], app, env);
		await save("checked-entry.c", `#include "entry.c"\n${gen.declarations}\n`);
		await save(`${p}.h`, gen.header); await save("adapter.c", gen.source);
		await save("task-delivery.h", delivery); await save("task-notification.h", notification);
		for(const [file, bytes] of callbackHeaders) await save(file, bytes);
		if(ledger)
		{
			await save("task-resource-ledger.h", ledger.header); await save("ledger.c", ledger.source);
			await run(environment.CC ?? "cc", ["-std=gnu11"
				, "-O1"
				, "-g0"
				, "-shared"
				, "-fPIC"
				, ledgerFlag
				, "-I"
				, join(runtimeRoot, "include")
				, `-ffile-prefix-map=${runtimeRoot}=/build/lean-bridge/runtime`
				, `-ffile-prefix-map=${app}=/build/lean-bridge/component`
				, "ledger.c"
				, "-L"
				, join(runtimeRoot, "lib")
				, "-lleanshared"
				, "-llean_bridge_native"
				, "-Wl,-z,defs,-z,nodelete"
				, "-Wl,--build-id=none"
				, `-Wl,-soname,${ledgerName}`
				, "-Wl,-rpath,$ORIGIN"
				, "-o"
				, ledgerName], app);
		}
		if(integers) await save("task-integers.h", integers);
		await save("exports.map", `{ global: ${gen.symbols.join("; ")}; local: *; };\n`);
		const library = `lib${p}.so`;
		await run(environment.CC ?? "cc", ["-std=gnu11"
			, "-O1"
			, "-g0"
			, "-shared"
			, "-fPIC"
			, "-I"
			, join(runtimeRoot, "include")
			, ...gmp ? ["-I", join(gmp.root, "include"), `-ffile-prefix-map=${gmp.root}=/build/gmp`] : []
			, `-ffile-prefix-map=${runtimeRoot}=/build/lean-bridge/runtime`
			, `-ffile-prefix-map=${app}=/build/lean-bridge/component`
			, ...objects
			, "checked-entry.c"
			, "adapter.c"
			, "-L"
			, join(runtimeRoot, "lib")
			, "-lleanshared"
			, "-llean_bridge_native"
			, ...ledger ? [ledgerFlag, "-L.", "-l:" + ledgerName] : []
			, ...gmp ? ["-L", join(gmp.root, "lib"), "-l:libgmp.so.10"] : []
			, "-pthread"
			, "-lm"
			, "-Wl,-z,defs,-z,nodelete"
			, "-Wl,--build-id=none"
			, "-Wl,--version-script=exports.map"
			, `-Wl,-soname,${library}`
			, "-Wl,-rpath,$ORIGIN", "-o", library], app);
		const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38";
		if(!/^2\.\d+$/u.test(floor)) throw new TypeError("Invalid native glibc floor");
		const files = new Map(gmp ? gmp.files : []), sharedLibs = Object.keys(manifest.files).filter(f => f.startsWith("lib/"));
		const compiled = [[`lib/${library}`, join(app, library)], ...sharedLibs.map(f => [f, join(runtimeRoot, f)])];
		if(ledger) compiled.push([`lib/${ledgerName}`, join(app, ledgerName)]);
		if(gmp) compiled.push(["lib/libgmp.so.10", join(gmp.root, "lib/libgmp.so.10")]);
		for(const [path, file] of compiled)
		{
			const bytes = await readFile(file); validateNativeElf(bytes);
			if(file === join(app, library) && bytes.includes(Buffer.from(workRoot))) throw new Error("C task library retained a private staging path");
			for(const m of (await run("readelf", ["--version-info", file], app)).stdout.matchAll(/GLIBC_(\d+)\.(\d+)(?:\.(\d+))?/gu))
				if(+m[1] > 2 || (+m[1] === 2 && (+m[2] > +floor.slice(2) || (+m[2] === +floor.slice(2) && +m[3] > 0)))) throw new Error(`C task library exceeds glibc ${floor}: ${m[0]}`);
			if(sharedLibs.includes(path) && sha256(bytes) !== manifest.files[path].sha256) throw new Error("C task runtime changed during packaging");
			if(gmp && path === "lib/libgmp.so.10" && (!bytes.equals(gmp.files.get(path)) || !/\(SONAME\)\s+Library soname: \[libgmp\.so\.10\]/u.test((await run("readelf", ["-d", file], app)).stdout))) throw new Error("C task GMP library identity differs");
			files.set(path, bytes);
		}
		if(rust) return await writeRustTaskRelease({ ...options, prefix: p, files, entries, api, evidence, floor, gen, manifest, runtimeIdentity, bindingIrSha256, componentIdentity });
		const cmakePackage = `LeanBridge${p.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join("")}`;
		const cmakeTarget = `LeanBridge::${p}`, share = "share/lean-bridge";
		files.set(`include/${p}.h`, gen.header);
		if(cpp)
		{
			const dir = "lean_bridge/async_v2", hpp = generateCppTaskHeader({ prefix: p, entries, resources });
			if(boost) for(const [path, value] of Object.entries(boost))
			{
				files.set(path, value);
				if(path.startsWith("include/"))
				{
					const src = path.slice(8);
					await mkdir(join(app, src.slice(0, src.lastIndexOf("/"))), { recursive: true });
					await save(src, value);
				}
			}
			await mkdir(join(app, dir), { recursive: true });
			for(const base of ["task-loop.hpp", "task-values.hpp", "task-routine.hpp", ...ledger ? ["task-resource.hpp"] : [], ...callbackHeaders.size ? ["task-callback.hpp"] : []])
			{
				const bytes = await asset(`../backends/cpp/${base}`);
				files.set(`include/${dir}/${base}`, bytes); await save(`${dir}/${base}`, bytes);
			}
			files.set(`include/${p}.hpp`, hpp); await save(`${p}.hpp`, hpp);
			await save("consumer-header.cpp", `#include "${p}.hpp"\n`);
			await run(environment.CXX ?? "c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-I.", "consumer-header.cpp"], app);
		}
		files.set(`lib/pkgconfig/${name}.pc`, `prefix=\${pcfiledir}/../..
includedir=\${prefix}/include
libdir=\${prefix}/lib
Name: ${name}
Description: Compiled Lean ${cpp ? "C++20" : "C11"} ${synchronous ? "synchronous calls" : "tasks"}
Version: ${version}
Libs: -L\${libdir} -Wl,-rpath,\${libdir} -l${p}${cpp ? " -pthread" : gmp ? " -l:libgmp.so.10" : ""}
Cflags: -I\${includedir}${cpp ? " -pthread" : ""}${boost ? " -DBOOST_MP_STANDALONE" : ""}
`);
		files.set(`lib/cmake/${cmakePackage}/${cmakePackage}Config.cmake`, `if(NOT TARGET ${cmakeTarget})${cpp ? "\n  include(CMakeFindDependencyMacro)\n  find_dependency(Threads)" : ""}
  get_filename_component(_lb_root "\${CMAKE_CURRENT_LIST_DIR}/../../.." ABSOLUTE)
  add_library(${cmakeTarget} SHARED IMPORTED)
  set_target_properties(${cmakeTarget} PROPERTIES IMPORTED_LOCATION "\${_lb_root}/lib/${library}" INTERFACE_INCLUDE_DIRECTORIES "\${_lb_root}/include"${cpp ? ' INTERFACE_COMPILE_FEATURES "cxx_std_20" INTERFACE_LINK_LIBRARIES "Threads::Threads"' : gmp ? ' INTERFACE_LINK_LIBRARIES "${_lb_root}/lib/libgmp.so.10"' : ""}${boost ? ' INTERFACE_COMPILE_DEFINITIONS "BOOST_MP_STANDALONE"' : ""})
  unset(_lb_root)
endif()
`);
		files.set(`${share}/binding-ir.json`, canonicalJson(api)); files.set(`${share}/elaboration.json`, canonicalJson(evidence));
		files.set(`${share}/generated.lean`, gen.entryLean); files.set(`${share}/runtime.json`, canonicalJson(manifest));
		files.set(`${share}/licenses/LeanBridge-LICENSE`, await asset("../../LICENSE"));
		for(const f of ["LICENSE", "LICENSES"]) files.set(`${share}/licenses/Lean-${f}`, await readFile(join(leanPrefix, f)));
		for(const [path, bytes] of Object.entries(projectContract.notices)) files.set(`${share}/licenses/${path}`, bytes);
		files.set("package-metadata.json", canonicalJson(projectContract.metadata ?? {}));
		if(synchronous) files.set("README.md", `# ${name} ${version}\n\nLinux x86-64, glibc ${floor} or later. Include ${p}.h and link with pkg-config ${name} or CMake target ${cmakeTarget}. Call the generated _call functions on the process main thread. They return immediately after Lean finishes, without a task handle or event loop. IO_ERROR carries a UTF-8 message; TYPED_ERROR writes the declared EIO payload. A returned Except is ordinary data. Zero-initialize aggregate outputs, and use their named disposers before reuse. The matching Lean runtime is included.\n`);
		else if(cpp) files.set("README.md", `# ${name} ${version}\n\nInclude ${p}.hpp and use namespace lean_bridge::${p}. Linux x86-64, glibc ${floor} or later; the matching Lean runtime is included. Link CMake target ${cmakeTarget} (find_package(${cmakePackage} CONFIG REQUIRED)), or use C++20 and pkg-config ${name}.\n\nA function returning Future<T> starts a real Lean task. Use .get() or co_await on the main thread. Stream<T>::next() requests precisely one item and returns a Future<std::optional<T>>; empty means exhausted. A returned Result<T,E> is a variant of Ok<T> and Err<E>; IOError, StartError<E> and StepError<E> represent three different failure channels. Tasks and streams are move-only. Explicit cancel()/close(), scope exit and coroutine abandonment release pending work. Worker-thread disposal queues cleanup until the main thread pumps or enters an API; it never invokes Lean on the worker. Routine<T>::get() drives suspended C++20 coroutines using poll, without a worker or timer. An application with its own main loop may call run_one(timeout_ms). Destroy externally owned suspended coroutine frames on that same thread. shutdown() permanently stops this C++ dispatcher, cancelling its owners; pump outstanding waiters to observe Cancelled.\n`);
		else files.set("README.md", `# ${name} ${version}\n\nLinux x86-64, glibc ${floor} or later. Include ${p}.h and link with pkg-config package ${name} or CMake target ${cmakeTarget} (find_package(${cmakePackage} CONFIG REQUIRED)). The shared Lean runtime initializes automatically.\n\nUse the API on the process main thread. Zero-initialize handles. A task starts immediately; a stream starts its factory but does not pull until _pull. Only one pull can be outstanding. _poll returns OK when ready, or PENDING with a borrowed descriptor: wait for readability without reading or closing it. _take never blocks. A task result, stream END or failed step consumes the handle; a stream item leaves it idle. _close cancels outstanding work without waiting for it. Copied stale handles do not become valid again. Dispose owned output buffers (including nested results) before reuse. String inputs are strict length-delimited UTF-8. IO_ERROR, typed failures, and returned Except values are distinct.\n`);
		if(cpp && callbackHeaders.size) files.set("README.md", files.get("README.md") + "\nPass a lambda for a retained task callback. Await on the main thread: the dispatcher watches both callback and completion descriptors. RetainedCallback<R(A)>::close() revokes future invocations. Propagated standard C++ exceptions retain their identity; TaskIOError is a terminal Lean error, and non-standard callback exceptions retire the shared runtime. Use C++ task support ABI 2 for packages that share a coroutine loop.\n");
		if(target === "c" && callbackHeaders.size) files.set("README.md", files.get("README.md") + "\nCreate a typed callback with _make(function, context, disposer, &handle). The task retains its own reference; _release drops yours, and _close also revokes future calls. Drive _poll or _take on the main thread: both service at most 16 callbacks per call. On PENDING, wait for readability on the single borrowed descriptor, then poll again. A callback may call another package or close its own task. Return OK, callback_error_set(...), INVALID, NO_MEMORY or LIMIT; CALLBACK_TRAP or an unexpected status retires the runtime. The original C error payload is returned only if that same Lean IO error escapes. Dispose it with callback_error_dispose. Do not longjmp across the API.\n");
		if(target === "c" && entries.some(e => e.taskIO)) files.set("README.md", files.get("README.md") + "\nTASK_IO_ERROR is a selected terminal Lean IO failure; IO_ERROR is a failed factory. Unselected returned Except values remain data.\n");
		if(integers) files.set("README.md", files.get("README.md") + (cpp
			? "\nNat and Int use the bundled Boost.Multiprecision cpp_int. Negative Nat arguments reject before entering Lean. Task results and typed errors own their integer values.\n"
			: "\nNat and Int use GMP mpz_t. Initialize direct integer result and error slots with mpz_init; dispose each once with mpz_clear. For a returned Except, zero-initialize the outer value and use its generated disposer; do not initialize or clear individual union members. Negative Nat inputs reject before entering Lean. GMP 6.3.0, notices and complete corresponding source are included.\n"));
		if(ledger) files.set("README.md", files.get("README.md") + (synchronous
			? "\nZero-initialize nominal resource outputs, including typed error slots. Inputs are borrowed only for the call; each returned resource owns an independent lease. Use the generated retain, same and release functions. Copying a resource struct does not create another owner.\n"
			: cpp
				? "\nNominal resources are move-only. Use .clone() for an independent lease and == for Lean object identity, including across compatible packages. Destruction or .close() releases your lease; a started task or cursor retains its own Lean reference. Worker-thread destruction queues release on the main dispatcher.\n"
				: "\nZero-initialize resource outputs (including typed error slots). An input borrows your lease for the call; a returned resource is an independent lease. Use the generated resource retain, same and release functions, not assignment to duplicate ownership. Release the input immediately after a task or cursor starts if you no longer need it.\n"));
		const records = [...files].map(([path, value]) => ({ path, bytes: Buffer.isBuffer(value) ? value : Buffer.from(value), mode: 0o644 }));
		const inventory = Object.fromEntries(records.map(f => [f.path, { bytes: f.bytes.length, sha256: sha256(f.bytes) }]));
		const component = projectContract.component, archiveRoot = `${name}-${version}-${target}`;
		const pkg = { schemaVersion: 1
			, kind: "lean-bridge-native-c-package"
			, ecosystem: target
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
			, ...(cpp ? { cppNamespace: `lean_bridge::${p}`, cppStandard: 20, cppTaskSupportAbi: 2 } : {})
			, ...integers ? { exactIntegers: cpp ? "boost-1.90.0" : "gmp-6.3.0" } : {}
			, files: inventory };
		records.push({ path: "lean-bridge-package.json", mode: 0o644, bytes: Buffer.from(canonicalJson(pkg)) });
		const data = createDeterministicTarGzFromFiles({ files: records.map(f => ({ ...f, path: `${archiveRoot}/${f.path}` })), sourceDateEpoch: 1 });
		const archive = `${archiveRoot}.tar.gz`;
		await writeFile(join(options.output, archive), data, { flag: "wx" });
		const receipt = await writePackageSetReceipt({ root: workRoot
			, component
			, source: { treeSha256: projectContract.sourceTreeSha256 }
			, profiles: [{ id: profile, bindingIrSha256, runtimeIdentity }], signal
			, packages: [{ target
				, ecosystem: target
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
