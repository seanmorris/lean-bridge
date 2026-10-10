/**
 * Synthetic report-format fixtures only. No value here represents an executed installed package.
 *
 * @file
 */
import { dirname, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { boostSources } from "../../src/backends/cpp/boost.mjs";
import { finContainerEdgeConsumer, finContainerEdgeRefinements, finContainerEdgeSource } from "./fin-container-edges.mjs";
import { finContainerEdgeChecks } from "./fin-container-edge-install.mjs";
import { finContainerTargets } from "./fin-container-install.mjs";
import { finContainerEntryInitializer } from "./fin-container-entry-dispatch.mjs";
import { finContainerEdgeColumns, finContainerEdgeEntries, finContainerEdgeSourceEntries, finContainerEdgeRawExpected, finContainerEdgeRawProbe, finContainerEdgeInterposer, finContainerEdgePublicProbe } from "./fin-container-edge-dispatch.mjs";
import { finContainerEdgeReportContracts, finContainerEdgeReportModel, finContainerEdgeReportTranscript } from "./fin-container-edge-report.mjs";
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

const hash = sha256("synthetic fixture, not execution evidence");
const hashes = names => Object.fromEntries(names.map(name => [name, hash]));
const environment = names => hashes(["receiptSha256", "packageFileSetSha256", ...names]);
const methods = values => values.map(name => `FinContainers.${name}`);
const paths = (host, names) => Object.fromEntries(names.map(name => [name, join(host.libraryDirectory, host.definitions[name])]));
const gdb = (host, serial = 0, jvm = false) => {
	const configIdentity = { schemaVersion: 1, kind: "fin-container-edge"
		, platform: "x86_64-linux-gnu", instrument: "gdb-breakpoints"
		, componentId: host.componentId, columns: host.columns
		, libraries: Object.keys(host.libraries).sort()
		, definers: host.columns.map(name => host.definitions[name]) };
	const configSha256 = sha256(canonicalJson(configIdentity));
	const runs = [1, 2].map(index => {
		const pid = 100 + serial * 10 + index, nonce = String(pid).padStart(32, "0");
		const manifest = { pid, nonce, configSha256
			, breakpoints: host.columns.map((symbol, column) => ({ symbol, library: host.definitions[symbol], offset: column * 16, address: 0x100000 + column * 16 })) };
		const run = { pid, nonce, manifest, recordSha256: hash, manifestSha256: hash };
		if(jvm)
		{
			run.extractionRoot = `/synthetic/probe/run-${pid}`;
			run.scriptSha256 = sha256(finContainerEdgeJvmGdbScript({ nativeDirectory: host.libraryDirectory, extractionRoot: run.extractionRoot, libraries: host.libraries }));
			manifest.jvmExtraction = { parent: run.extractionRoot
				, root: join(run.extractionRoot, `lean-bridge-jvm-${pid}`)
				, libraries: Object.fromEntries(Object.entries(host.libraries).map(([name, sha256]) => [name, { sha256, bytes: 32, device: 1, inode: 1 }]))
				, afterExit: Object.fromEntries(Object.entries(host.libraries).map(([name, sha256]) => [name, { sha256, linksAfterExit: 0 }])) };
		}
		return run;
	});
	return { configIdentity, configSha256, runs };
};

/**
 * Create one self-consistent mock for checker negative controls; never write it to an evidence archive.
 *
 * @param profiles - Selected host names.
 */
export const syntheticFinContainerEdgeReport = async profiles => {
	const model = finContainerEdgeReportModel(), component = model.component;
	const report = { schemaVersion: 1, profiles, reproducible: true, authorRoots: 2, reports: [], archives: {} };
	for(const profile of profiles)
	{
		const [target, coordinate] = finContainerTargets[profile];
		const artifact = { path: `packages/${target}/synthetic.zip`, sha256: hash };
		report.archives[artifact.path] = hash;
		const item = { profile, path: "ordinary-source"
			, checks: finContainerEdgeChecks[profile]
			, fixtureSha256: sha256(await finContainerEdgeSource())
			, consumerSha256: sha256(await finContainerEdgeConsumer(profile))
			, refinements: structuredClone(finContainerEdgeRefinements)
			, sourceTreeSha256: hash, modelSha256: hash
			, bindingIrSha256: hash, receiptSha256: hash
			, installedFilesSha256: hash, installedReceiptSha256: hash
			, packageFileSetSha256: hash
			, offlineInstall: true, compilerFreePath: true
			, sourceRemovedBeforeInstallation: true
			, relocatedInstallation: true, repeatExecution: true
			, installedFilesUnchanged: true, exactPackageFiles: true
			, packages: [{ role: "component", target, ...coordinate, artifacts: [artifact] }] };
		const columns = finContainerEdgeColumns(model, component);
		const definitions = Object.fromEntries([...columns, "lean_bridge_native_component_initialize", finContainerEntryInitializer(component.id)].map(name => [name, "component.so"]));
		const raw = { kind: "fin-container-edge-raw-v1"
			, caller: "Separate C raw-adapter probe; not a host-language call"
			, instrument: "LD_PRELOAD with runtime defining-library checks"
			, componentId: component.id, columns
			, observed: structuredClone(finContainerEdgeRawExpected)
			, definitions, libraries: { "component.so": hash, "runtime.so": hash }
			, libraryDirectory: "/synthetic/package/lib"
			, measuredAdapters: methods(finContainerEdgeEntries)
			, measuredSources: methods(finContainerEdgeSourceEntries)
			, sourceFunctionsNotMeasured: methods(finContainerEdgeEntries.slice(0, 4))
			, receiptSha256: hash, installedFilesSha256: hash
			, modelSha256: hash, packageFileSetSha256: hash
			, exactPackageFiles: true, missingInstrumentRefused: true
			, installedFilesUnchanged: true, runtimeDefinitionsChecked: true };
		const contract = finContainerEdgeReportContracts[profile];
		const host = { ...structuredClone(raw), kind: `fin-container-edge-public-${contract.kind}-v1`
			, caller: `The complete original-plus-edge synthetic ${profile} caller`
			, observed: true, profile, checks: item.checks
			, measuredCalls: contract.rows.length
			, observations: structuredClone(contract.rows)
			, publicSymbols: contract.symbols, repeatedColdProcess: true
			, stdoutSha256: sha256(finContainerEdgeReportTranscript(profile))
			, headerDigests: { "include/fincontainers.h": hash }
			, moduleDigests: { "synthetic.module": hash } };
		for(const symbol of contract.symbols) host.definitions[symbol] = "component.so";
		host.packageDirectory = "/synthetic/package";
		let source;
		if(profile === "python")
		{
			host.moduleDigests = hashes(["lean_fincontainers/__init__.py", "lean_fincontainers/_native.py"]);
			item.python = "3.11.16"; host.python = item.python;
			item.pythonEnvironment = { baselineSha256: hash, environmentSha256: hash, interpreterSha256: hash, python: item.python };
			host.pythonEnvironment = structuredClone(item.pythonEnvironment);
			item.pythonBytecodePolicy = "isolated-empty-prefix"; host.bytecodePolicy = "isolated-empty-prefix";
			delete item.exactPackageFiles; delete item.packageFileSetSha256;
			for(const value of [raw, host])
			{ delete value.exactPackageFiles; delete value.packageFileSetSha256; }
			host.packageDirectory = "/synthetic/site/lean_fincontainers";
			raw.libraryDirectory = host.libraryDirectory = join(host.packageDirectory, "native/linux-x64");
			source = await finContainerEdgePythonProbe(model, component, { definitions: paths(host, contract.symbols), packageDirectory: host.packageDirectory });
		}
		else if(profile === "rust")
		{
			host.moduleDigests = hashes(["Cargo.toml", "Cargo.lock", "src/lib.rs", "src/__runtime.rs", "src/assets.rs"]);
			host.dependencyRoot = "/synthetic/dependencies";
			host.dependencies = { ...hashes(["archiveSha256", "packageLockSha256", "inventorySha256"])
				, packages: [{ directory: "synthetic-1.0.0", manifestSha256: hash, checksum: hash, files: 2 }] };
			raw.libraryDirectory = host.libraryDirectory = join(host.packageDirectory, "native/linux-x64");
			source = await finContainerEdgeRustProbe(model, component);
			host.instrument = "LD_PRELOAD with extracted-library byte and owning-symbol-address checks";
			host.interposerSha256 = sha256(finContainerEdgeRustInterposer(model, component, {
				libraries: Object.keys(host.libraries).map(name => join(host.libraryDirectory, name))
				, definitions: paths(host, Object.keys(host.definitions)) }));
			for(const key of ["emptyCargoHome", "offline", "linkOnly", "dependenciesUnchanged", "extractionCleanupUnchanged"]) host[key] = true;
			for(const key of ["executableSha256", "compilerSha256", "cargoSha256", "consumerLockSha256", "metadataSha256", "linkerSha256"]) host[key] = hash;
			host.rustcVersion = "rustc 1.90.0 (synthetic)"; host.cargoVersion = "cargo 1.90.0 (synthetic)";
		}
		else if(profile === "ruby")
		{
			host.moduleDigests = hashes(["lib/lean_bridge/fincontainers.rb", "lib/lean_bridge/fincontainers/native.rb", "lib/lean_bridge/native_copied_runtime_v1.rb"]);
			raw.libraryDirectory = host.libraryDirectory = join(host.packageDirectory, "lib/lean_bridge/fincontainers/native/linux-x64");
			source = await finContainerEdgeRubyProbe(model, component, { installed: host.packageDirectory });
			host.loadedModulesChecked = true; host.ruby = "ruby 3.3.12 x86_64-linux"; host.rubySha256 = hash;
			host.instrument = "GDB address breakpoints; normal deep-binding loader unchanged";
		}
		else if(profile === "dotnet")
		{
			host.packageDirectory = "/synthetic/original/inspection"; host.probePackageDirectory = "/synthetic/probe/inspection";
			host.libraryDirectory = "/synthetic/probe/out/runtimes/linux-x64/native";
			host.assembly = "LeanBridge.Fincontainers.dll"; host.assemblySha256 = hash; host.archiveSha256 = hash;
			source = (await finContainerEdgeDotnetProbe(model, component, join(dirname(host.probePackageDirectory), "out", host.assembly))).source;
			item.dotnetEnvironment = environment(["cacheFilesSha256", "buildInputsSha256", "deployedFilesSha256", "interpreterSha256"]);
			host.dotnetEnvironment = structuredClone(item.dotnetEnvironment); host.probeEnvironment = structuredClone(item.dotnetEnvironment);
			host.dotnet = "8.0.424"; host.dotnetSha256 = hash; host.sameOriginalArchive = true; host.loadedAssemblyChecked = true;
			host.instrument = "GDB address breakpoints; production managed and native loaders unchanged";
		}
		else if(["java", "kotlin"].includes(profile))
		{
			host.packageDirectory = "/synthetic/package/jar-inspection";
			const probe = await finContainerEdgeJvmProbe(model, component, profile, join(dirname(host.packageDirectory), "component.jar"));
			host.probeFiles = Object.fromEntries([["EdgeCounter.java", probe.counter], ["EdgeApi.java", probe.api], [profile === "java" ? "consumer.java" : "consumer.kt", probe.consumer]].map(([path, source]) => [path, sha256(source)]));
			host.probeFilesSha256 = sha256(canonicalJson(host.probeFiles));
			item.jvmEnvironment = environment(["classpathFilesSha256", "interpreterSha256"]); host.jvmEnvironment = structuredClone(item.jvmEnvironment);
			host.toolDigests = Object.fromEntries((profile === "java" ? ["java", "javac"] : ["java", "javac", "kotlinc"]).map(name => [name, { path: `/synthetic/tools/${name}`, sha256: hash }]));
			host.loadedClassesChecked = true; host.nativeExtractionCheckedBeforeAndAfterExit = true; host.java = "openjdk 22.0.2 synthetic";
			host.instrument = "GDB address breakpoints over authenticated JVM-extracted libraries; production loader unchanged";
		}
		else if(profile === "php-native")
		{
			host.packageDirectory = "/synthetic/vendor/example/fincontainers";
			item.repeatStrictExecution = true; item.phpEnvironment = environment(["dependencyFilesSha256", "generatedFilesSha256", "vendorFilesSha256", "toolsSha256"]);
			host.moduleDigests = hashes(["src/Api.php", "src/Internal/Native.php", "src/Internal/Runtime.php"]);
			host.phpEnvironment = structuredClone(item.phpEnvironment); host.loadedModulesChecked = true;
			host.php = "8.2.33 cli 0 8"; host.phpSha256 = hash;
			host.instrument = "GDB address breakpoints; normal native loader unchanged";
			host.modes = [];
			for(const [serial, mode] of ["weak", "strict"].entries())
			{
				const text = await finContainerEdgePhpProbe(model, component, { installed: host.packageDirectory, autoload: resolve(host.packageDirectory, "../..", "autoload.php") }, mode);
				host.modes.push({ mode, checks: item.checks
					, measuredCalls: contract.rows.length
					, probeSha256: sha256(text), stdoutSha256: host.stdoutSha256
					, ...gdb(host, serial) });
			}
			delete host.stdoutSha256;
		}
		else if(profile === "wit-wasi")
		{
			source = (await finContainerEdgeWitProbe(model, component, paths(host, contract.symbols))).source;
			host.wasmtime = "42.0.1"; host.componentSha256 = hash; host.repeatExecutions = 2;
			for(const path of ["include/fincontainers_wasmtime.h", "include/wasmtime.h", "include/wasmtime/component.h"]) host.headerDigests[path] = hash;
			host.linkLibraries = ["component.so"];
			host.probeFiles = { "interposer.c": hash, "libedge.so": hash, public: hash, "public.c": sha256(source) };
		}
		else
		{
			host.headerDigests = hashes(profile === "c"
				? ["include/fincontainers.h", "include/detail/fincontainers_gmp.h", "include/gmp.h"]
				: ["include/fincontainers.h", "include/fincontainers.hpp", ...Object.keys(boostSources()).filter(path => path.startsWith("include/"))]);
			source = await (profile === "c" ? finContainerEdgePublicProbe : finContainerEdgeCppProbe)(model, component, paths(host, contract.symbols));
			if(profile === "cpp") host.linkLibraries = ["component.so"];
		}
		if(source !== undefined) host.probeSha256 = sha256(source);
		raw.probeSha256 = sha256(finContainerEdgeRawProbe(model, component));
		raw.interposerSha256 = sha256(finContainerEdgeInterposer(model, component, paths(raw, columns)));
		raw.stdoutSha256 = sha256(raw.observed.map(([step, status, counts]) => `${step} ${status} ${counts.join(" ")}\n`).join(""));
		if(["c", "cpp", "python", "wit-wasi"].includes(profile))
		{
			host.interposerSha256 = raw.interposerSha256;
			if(profile === "wit-wasi")
			{
				host.probeFiles["interposer.c"] = raw.interposerSha256;
				host.probeFilesSha256 = sha256(canonicalJson(host.probeFiles));
			}
		}
		if(["ruby", "dotnet", "java", "kotlin", "php-native"].includes(profile))
		{
			host.gdb = "GNU gdb synthetic"; host.gdbSha256 = hash; host.scriptSha256 = sha256(finContainerEdgeGdbScript);
			if(profile !== "php-native") Object.assign(host, gdb(host, 0, ["java", "kotlin"].includes(profile)));
		}
		item.dispatch = { kind: "fin-container-edge-dispatch-v1", rawAdapter: raw, publicHost: host };
		report.reports.push(item);
	}
	return report;
};
