/**
 * Reconstruct public observer sources and authenticate reported debugger identities for every host.
 *
 * @file
 */
import assert from "node:assert/strict";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { boostSources } from "../../src/backends/cpp/boost.mjs";
import { finContainerEdgeInterposer, finContainerEdgePublicProbe } from "./fin-container-edge-dispatch.mjs";
import { finContainerEdgeCppProbe } from "./fin-container-edge-cpp.mjs";
import { finContainerEdgePythonProbe } from "./fin-container-edge-python.mjs";
import { finContainerEdgeRustProbe } from "./fin-container-edge-rust.mjs";
import { finContainerEdgeRustInterposer } from "./fin-container-edge-rust-loader.mjs";
import { finContainerEdgeRubyProbe } from "./fin-container-edge-ruby.mjs";
import { finContainerEdgeDotnetProbe } from "./fin-container-edge-dotnet.mjs";
import { finContainerEdgeJvmProbe } from "./fin-container-edge-jvm.mjs";
import { finContainerEdgePhpProbe } from "./fin-container-edge-php.mjs";
import { finContainerEdgeWitProbe } from "./fin-container-edge-wit.mjs";
import { finContainerEdgeGdbScript } from "./fin-container-edge-gdb.mjs";
import { finContainerEdgeJvmGdbScript } from "./fin-container-edge-jvm-gdb.mjs";
import { withoutFinContainerEdgeJvmExitDiagnostics } from "./fin-container-edge-jvm-exit.mjs";

const digest = /^[a-f0-9]{64}$/u;
const positive = value => assert.ok(Number.isSafeInteger(value) && value > 0);
const absolute = path => assert.ok(typeof path === "string" && isAbsolute(path) && !path.includes("\0"));
const hashes = value => {
	assert.ok(value && Object.keys(value).length);
	for(const hash of Object.values(value)) assert.match(hash, digest);
};
const flags = (value, names) => {
	for(const name of names) assert.equal(value[name], true, name);
};
const paths = (host, symbols) => Object.fromEntries(symbols.map(symbol => [symbol, join(host.libraryDirectory, host.definitions[symbol])]));
const fields = (value, names) => {
	assert.ok(value && typeof value === "object");
	for(const name of names) assert.match(value[name], digest, name);
};
const modules = (value, names) => {
	hashes(value); assert.deepEqual(Object.keys(value).sort(), [...names].sort());
};
const environment = (value, item, names) => {
	fields(value, ["receiptSha256", "packageFileSetSha256", ...names]);
	assert.equal(value.receiptSha256, item.installedReceiptSha256);
	assert.equal(value.packageFileSetSha256, item.packageFileSetSha256);
};

const gdbRuns = (host, observation, jvm = false) => {
	const expected = { schemaVersion: 1, kind: "fin-container-edge"
		, platform: "x86_64-linux-gnu", instrument: "gdb-breakpoints"
		, componentId: host.componentId, columns: host.columns
		, libraries: Object.keys(host.libraries).sort()
		, definers: host.columns.map(symbol => host.definitions[symbol]) };
	assert.deepEqual(observation.configIdentity, expected);
	assert.equal(observation.configSha256, sha256(canonicalJson(expected)));
	assert.equal(observation.runs.length, 2);
	assert.notEqual(observation.runs[0].pid, observation.runs[1].pid);
	assert.notEqual(observation.runs[0].nonce, observation.runs[1].nonce);
	for(const run of observation.runs)
	{
		positive(run.pid); assert.match(run.nonce, /^[a-f0-9]{32}$/u);
		assert.match(run.recordSha256, digest); assert.match(run.manifestSha256, digest);
		const manifest = run.manifest;
		assert.equal(manifest.pid, run.pid); assert.equal(manifest.nonce, run.nonce);
		assert.equal(manifest.configSha256, observation.configSha256);
		assert.deepEqual(manifest.breakpoints.map(point => [point.symbol, point.library]),
			host.columns.map(symbol => [symbol, host.definitions[symbol]]));
		const bases = new Map();
		for(const point of manifest.breakpoints)
		{
			positive(point.address); assert.ok(Number.isSafeInteger(point.offset) && point.offset >= 0);
			const base = point.address - point.offset; positive(base);
			assert.equal(base % 4096, 0);
			if(bases.has(point.library)) assert.equal(bases.get(point.library), base);
			bases.set(point.library, base);
		}
		if(jvm)
		{
			absolute(run.extractionRoot);
			const script = finContainerEdgeJvmGdbScript({
				nativeDirectory: host.libraryDirectory
				, extractionRoot: run.extractionRoot, libraries: host.libraries });
			// Logging does not change acceptance. Preserve exactly the original and diagnostic versions.
			assert.ok([sha256(script), sha256(withoutFinContainerEdgeJvmExitDiagnostics(script))].includes(run.scriptSha256), "one exact JVM observer version");
			const extracted = manifest.jvmExtraction;
			assert.equal(extracted.parent, run.extractionRoot);
			assert.ok(extracted.root.startsWith(run.extractionRoot + "/"));
			assert.match(extracted.root.slice(run.extractionRoot.length), /^\/lean-bridge-jvm-[0-9]+$/u);
			assert.deepEqual(Object.keys(extracted.libraries).sort(), Object.keys(host.libraries).sort());
			assert.deepEqual(Object.keys(extracted.afterExit).sort(), Object.keys(host.libraries).sort());
			for(const [name, hash] of Object.entries(host.libraries))
			{
				const file = extracted.libraries[name]; assert.equal(file.sha256, hash);
				for(const key of ["bytes", "device", "inode"]) positive(file[key]);
				assert.deepEqual(extracted.afterExit[name], { sha256: hash, linksAfterExit: 0 });
			}
		}
	}
	if(jvm) assert.notEqual(observation.runs[0].extractionRoot, observation.runs[1].extractionRoot);
	else assert.equal(host.scriptSha256, sha256(finContainerEdgeGdbScript));
	assert.match(host.gdb, /^GNU gdb /u); assert.match(host.gdbSha256, digest);
};

/**
 * Rebuild the public instrument from the current source and its reported original package paths.
 *
 * @param item - One installed host result, already checked against the fixture and expected rows.
 * @param model - Independent expected signatures for reconstructing the probe.
 */
export const assertFinContainerEdgeHostReport = async (item, model) => {
	const host = item.dispatch.publicHost, profile = item.profile, component = model.component;
	const definitions = paths(host, host.publicSymbols);
	let source;
	if(["c", "cpp"].includes(profile))
	{
		const render = profile === "c" ? finContainerEdgePublicProbe : finContainerEdgeCppProbe;
		source = await render(model, component, definitions);
		modules(host.headerDigests, profile === "c"
			? ["include/fincontainers.h", "include/detail/fincontainers_gmp.h", "include/gmp.h"]
			: ["include/fincontainers.h", "include/fincontainers.hpp", ...Object.keys(boostSources()).filter(path => path.startsWith("include/"))]);
		if(profile === "cpp") assert.deepEqual(host.linkLibraries, [...new Set(host.publicSymbols.map(symbol => host.definitions[symbol]))]);
	}
	else if(profile === "python")
	{
		absolute(host.packageDirectory);
		assert.equal(join(host.packageDirectory, "native/linux-x64"), host.libraryDirectory);
		source = await finContainerEdgePythonProbe(model, component, { definitions, packageDirectory: host.packageDirectory });
		modules(host.moduleDigests, ["lean_fincontainers/__init__.py", "lean_fincontainers/_native.py"]);
		assert.equal(host.bytecodePolicy, "isolated-empty-prefix");
		assert.deepEqual(host.pythonEnvironment, item.pythonEnvironment);
	}
	else if(profile === "rust")
	{
		source = await finContainerEdgeRustProbe(model, component);
		assert.equal(host.instrument, "LD_PRELOAD with extracted-library byte and owning-symbol-address checks");
		absolute(host.packageDirectory);
		assert.equal(join(host.packageDirectory, "native/linux-x64"), host.libraryDirectory);
		assert.equal(host.interposerSha256, sha256(finContainerEdgeRustInterposer(model, component, {
			libraries: Object.keys(host.libraries).map(name => join(host.libraryDirectory, name))
			, definitions: paths(host, Object.keys(host.definitions)) })));
		modules(host.moduleDigests, ["Cargo.toml", "Cargo.lock", "src/lib.rs", "src/__runtime.rs", "src/assets.rs"]);
		absolute(host.dependencyRoot);
		fields(host.dependencies, ["archiveSha256", "packageLockSha256", "inventorySha256"]);
		assert.equal(host.dependencies.packageLockSha256, host.moduleDigests["Cargo.lock"]);
		assert.ok(Array.isArray(host.dependencies.packages) && host.dependencies.packages.length > 0);
		const directories = new Set();
		for(const pkg of host.dependencies.packages)
		{
			assert.match(pkg.directory, /^[A-Za-z0-9][A-Za-z0-9_.+-]*$/u);
			assert.equal(directories.has(pkg.directory), false); directories.add(pkg.directory);
			fields(pkg, ["manifestSha256", "checksum"]); positive(pkg.files);
		}
		flags(host, ["emptyCargoHome", "offline", "linkOnly", "dependenciesUnchanged", "extractionCleanupUnchanged"]);
		for(const key of ["executableSha256", "compilerSha256", "cargoSha256", "consumerLockSha256", "metadataSha256", "linkerSha256"])
			assert.match(host[key], digest);
		assert.match(host.rustcVersion, /^rustc 1\.90\.0 /u);
		assert.match(host.cargoVersion, /^cargo 1\.90\.0 /u);
	}
	else if(profile === "ruby")
	{
		absolute(host.packageDirectory);
		assert.equal(join(host.packageDirectory, "lib/lean_bridge/fincontainers/native/linux-x64"), host.libraryDirectory);
		source = await finContainerEdgeRubyProbe(model, component, { installed: host.packageDirectory });
		modules(host.moduleDigests, ["lib/lean_bridge/fincontainers.rb", "lib/lean_bridge/fincontainers/native.rb", "lib/lean_bridge/native_copied_runtime_v1.rb"]);
		flags(host, ["loadedModulesChecked"]);
		assert.match(host.ruby, /^ruby 3\.3\.[0-9]+ x86_64-linux/u); assert.match(host.rubySha256, digest);
		assert.equal(host.instrument, "GDB address breakpoints; normal deep-binding loader unchanged");
		gdbRuns(host, host);
	}
	else if(profile === "dotnet")
	{
		absolute(host.probePackageDirectory); absolute(host.packageDirectory);
		assert.notEqual(host.probePackageDirectory, host.packageDirectory);
		assert.match(host.assembly, /^[A-Za-z][A-Za-z0-9_.]*\.dll$/u);
		const root = dirname(host.probePackageDirectory);
		assert.equal(join(root, "out/runtimes/linux-x64/native"), host.libraryDirectory);
		const probe = await finContainerEdgeDotnetProbe(model, component, join(root, "out", host.assembly));
		source = probe.source;
		assert.equal(host.archiveSha256, item.packages[0].artifacts[0].sha256);
		assert.match(host.assemblySha256, digest); assert.match(host.dotnetSha256, digest);
		assert.match(host.dotnet, /^8\.0\.[0-9]+$/u);
		for(const value of [host.dotnetEnvironment, host.probeEnvironment])
			environment(value, item, ["cacheFilesSha256", "buildInputsSha256", "deployedFilesSha256", "interpreterSha256"]);
		assert.equal(host.dotnetSha256, host.dotnetEnvironment.interpreterSha256);
		assert.equal(host.dotnetSha256, host.probeEnvironment.interpreterSha256);
		assert.deepEqual(host.dotnetEnvironment, item.dotnetEnvironment);
		assert.equal(host.probeEnvironment.packageFileSetSha256, host.dotnetEnvironment.packageFileSetSha256);
		flags(host, ["sameOriginalArchive", "loadedAssemblyChecked"]);
		assert.equal(host.instrument, "GDB address breakpoints; production managed and native loaders unchanged");
		gdbRuns(host, host);
	}
	else if(["java", "kotlin"].includes(profile))
	{
		absolute(host.packageDirectory);
		const probe = await finContainerEdgeJvmProbe(model, component, profile, join(dirname(host.packageDirectory), "component.jar"));
		hashes(host.probeFiles);
		assert.equal(host.probeFilesSha256, sha256(canonicalJson(host.probeFiles)));
		for(const [path, text] of [["EdgeCounter.java", probe.counter], ["EdgeApi.java", probe.api], [profile === "java" ? "consumer.java" : "consumer.kt", probe.consumer]])
			assert.equal(host.probeFiles[path], sha256(text), path);
		assert.deepEqual(host.jvmEnvironment, item.jvmEnvironment);
		environment(host.jvmEnvironment, item, ["classpathFilesSha256", "interpreterSha256"]);
		assert.deepEqual(Object.keys(host.toolDigests).sort(), profile === "java" ? ["java", "javac"] : ["java", "javac", "kotlinc"]);
		for(const tool of Object.values(host.toolDigests))
		{ absolute(tool.path); assert.match(tool.sha256, digest); }
		assert.equal(host.toolDigests.java.sha256, host.jvmEnvironment.interpreterSha256);
		assert.equal(dirname(host.toolDigests.java.path), dirname(host.toolDigests.javac.path));
		flags(host, ["loadedClassesChecked", "nativeExtractionCheckedBeforeAndAfterExit"]);
		assert.match(host.java, /^openjdk 22\./u);
		assert.equal(host.instrument, "GDB address breakpoints over authenticated JVM-extracted libraries; production loader unchanged");
		gdbRuns(host, host, true);
	}
	else if(profile === "php-native")
	{
		absolute(host.packageDirectory);
		const options = { installed: host.packageDirectory, autoload: resolve(host.packageDirectory, "../..", "autoload.php") };
		for(const mode of host.modes)
		{
			const probe = await finContainerEdgePhpProbe(model, component, options, mode.mode);
			assert.equal(mode.probeSha256, sha256(probe)); gdbRuns(host, mode);
		}
		assert.deepEqual(host.phpEnvironment, item.phpEnvironment);
		environment(host.phpEnvironment, item, ["dependencyFilesSha256", "generatedFilesSha256", "vendorFilesSha256", "toolsSha256"]);
		modules(host.moduleDigests, ["src/Api.php", "src/Internal/Native.php", "src/Internal/Runtime.php"]);
		flags(host, ["loadedModulesChecked"]);
		assert.match(host.php, /^8\.[2-9]\.[0-9]+ cli 0 8$/u); assert.match(host.phpSha256, digest);
		assert.equal(host.instrument, "GDB address breakpoints; normal native loader unchanged");
	}
	else
	{
		assert.equal(profile, "wit-wasi");
		source = (await finContainerEdgeWitProbe(model, component, definitions)).source;
		assert.equal(host.wasmtime, "42.0.1"); assert.match(host.componentSha256, digest);
		assert.equal(host.repeatExecutions, 2);
		hashes(host.headerDigests);
		for(const path of ["include/fincontainers_wasmtime.h", "include/wasmtime.h", "include/wasmtime/component.h", "include/fincontainers.h"])
			assert.ok(Object.hasOwn(host.headerDigests, path));
		assert.deepEqual(host.linkLibraries, [...new Set(["fincontainers_wasmtime_call", "wasmtime_error_message"].map(symbol => host.definitions[symbol]))]);
		assert.deepEqual(Object.keys(host.probeFiles).sort(), ["interposer.c", "libedge.so", "public", "public.c"]);
		hashes(host.probeFiles);
		assert.equal(host.probeFilesSha256, sha256(canonicalJson(host.probeFiles)));
		assert.equal(host.probeFiles["public.c"], sha256(source));
		assert.equal(host.probeFiles["interposer.c"], host.interposerSha256);
	}
	if(source !== undefined) assert.equal(host.probeSha256, sha256(source));
	if(["c", "cpp", "python", "wit-wasi"].includes(profile))
	{
		assert.equal(host.instrument, "LD_PRELOAD with runtime defining-library checks");
		assert.equal(host.interposerSha256, sha256(finContainerEdgeInterposer(model, component, paths(host, host.columns))));
	}
};
