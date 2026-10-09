/**
 * Installed acceptance for the additive native Fin container cases across all ten non-Perl hosts.
 * Actual executions and the separate measured-dispatch supplement remain required under VO #1454.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, runCopied } from "./copied-fixture-install.mjs";
import { finContainerEnvironment, finContainerTargets } from "./fin-container-install.mjs";
import { finContainerEdgeConsumer, finContainerEdgeRefinements, finContainerEdgeSource } from "./fin-container-edges.mjs";
import { observeFinContainerEdgeRaw } from "./fin-container-edge-observer.mjs";
import { observeFinContainerEdgePublic } from "./fin-container-edge-public-observer.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { prepareRustCorpusDependencies } from "./type-corpus-rust.mjs";

/** Original accepted counts plus the new fragment, including its exact-count assertion. */
export const finContainerEdgeChecks = Object.freeze({
	c: 2041 + 12073
	, cpp: 2039 + 12060
	, python: 2029 + 12066
	, rust: 2027 + 12051
	, ruby: 2025 + 12069
	, dotnet: 2026 + 12063
	, java: 2026 + 12063
	, kotlin: 2025 + 12063
	, "php-native": 2026 + 12063
	, "wit-wasi": 2033 + 12033 });

/** Read exactly one receipt directly from the gem's original data member, without extracting a substitute. */
export const finContainerEdgeGemReceipt = String.raw`require "rubygems"
require "rubygems/package"
require "zlib"
require "stringio"
payloads = []
Gem::Package::TarReader.new(File.open(ARGV.fetch(0), "rb")) do |tar|
  tar.each { |entry| payloads << entry.read if entry.full_name == "data.tar.gz" && entry.file? }
end
abort "Expected one gem data member" unless payloads.length == 1
receipts = []
Zlib::GzipReader.wrap(StringIO.new(payloads.fetch(0))) do |gzip|
  Gem::Package::TarReader.new(gzip) do |tar|
    tar.each { |entry| receipts << entry.read if entry.full_name == "lean-bridge/package-receipt.json" && entry.file? }
  end
end
abort "Expected one gem receipt" unless receipts.length == 1
print receipts.fetch(0)
`;

/**
 * Reject missing/unknown/duplicate explicit profiles. Undefined disables the installed gate.
 *
 * @param value - Explicit comma-separated native hosts.
 */
export const finContainerEdgeSelection = value => {
	if(value === undefined) return [];
	assert.equal(typeof value, "string");
	const profiles = value.split(",").sort();
	assert.ok(profiles.every(profile => Object.hasOwn(finContainerEdgeChecks, profile)), "Unknown, empty or unimplemented Fin edge installed profile");
	assert.equal(new Set(profiles).size, profiles.length, "Duplicate Fin edge profile");
	return profiles;
};

/**
 * Enable additional raw measurements only on an explicit installed selection. Typos must not silently
 * turn an expected measurement into a passing uninstrumented run.
 *
 * @param value - Optional LEAN_BRIDGE_FIN_CONTAINER_EDGE_DISPATCH setting.
 * @param profiles - Explicit installed profiles.
 */
export const finContainerEdgeDispatchEnabled = (value, profiles) => {
	if(value === undefined) return false;
	assert.equal(value, "1", "Fin edge dispatch accepts only the explicit value 1");
	assert.ok(profiles.length > 0, "Fin edge dispatch requires an installed profile selection");
	return true;
};

/**
 * Refuse every existing entry, including a broken symlink, before building.
 *
 * @param path - Destination that must not already exist.
 */
export const requireNewFinContainerEdgeReport = async path => {
	assert.match(basename(path), /^edges-[a-z0-9-]+\.json$/u, "Use an edges-*.json report name");
	try
	{ await lstat(path); }
	catch(error)
	{ if(error.code === "ENOENT") return; throw error; }
	throw new Error(`Fin container edge report already exists: ${path}`);
};

/**
 * Append a new report exclusively; never replace an earlier attempt.
 *
 * @param path - New report path.
 * @param report - Completed acceptance observation.
 */
export const writeFinContainerEdgeReport = async (path, report) => {
	await requireNewFinContainerEdgeReport(path);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, canonicalJson(report), { flag: "wx" });
};

/**
 * Compile the installed public C/C++/Wasmtime consumer with an origin-relative runtime search path.
 * Check the actual ELF metadata, not just the compiler arguments, before moving the tree.
 *
 * @param options - Installed package and consumer paths.
 * @param options.profile - C, C++ or WIT/WASI.
 * @param options.root - Consumer directory containing the restricted assembler/linker tools.
 * @param options.directory - Single package directory beneath root.
 * @param options.pkgConfig - Receipt-pinned pkg-config name.
 */
export const prepareFinContainerEdgeExecutable = async ({ profile, root, directory, pkgConfig }) => {
	assert.ok(["c", "cpp", "wit-wasi"].includes(profile));
	assert.match(directory, /^[A-Za-z0-9][A-Za-z0-9._-]*$/u);
	const installed = join(root, directory), command = join(root, "consumer");
	const compile = { ...copiedCleanEnvironment, PATH: join(root, "tools"), PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", pkgConfig], root, compile)).stdout.trim().split(/\s+/u);
	assert.equal(flags.filter(flag => flag.startsWith("-Wl,-rpath,")).length, 1, "expected the installed package runtime search path");
	const runtimeSearchPath = `$ORIGIN/${directory}/lib`;
	const relativeFlags = flags.map(flag => flag.startsWith("-Wl,-rpath,") ? `-Wl,-rpath,${runtimeSearchPath}` : flag);
	await runCopied(profile === "cpp" ? "/usr/bin/c++" : "/usr/bin/cc"
		, [`-std=${profile === "cpp" ? "c++20" : "c11"}`, "-Wall", "-Wextra", "-Werror", "-UNDEBUG", `consumer.${profile === "cpp" ? "cpp" : "c"}`, ...relativeFlags, "-o", command]
		, root, compile);
	const dynamic = await runCopied("/usr/bin/readelf", ["--dynamic", command], root);
	const actualPaths = [...dynamic.stdout.matchAll(/\((?:RUNPATH|RPATH)\)[^\n]*\[([^\]]*)\]/gu)].map(match => match[1]);
	assert.deepEqual(actualPaths, [runtimeSearchPath], "ELF runtime path must be relative to the executable, with no old-root fallback");
	return { executableSha256: sha256(await readFile(command)), runtimeSearchPath };
};

/**
 * Verify the installed files against the receipt bytes from the original archive, move the complete
 * consumer tree, rerun the identical public consumer and verify the same file identities afterward.
 *
 * @param options - Verified archive handoff and installed consumer execution.
 * @param options.profile - An implemented installed profile.
 * @param options.consumer - Parent of the installed host directory.
 * @param options.handoff - Archive handoff directory.
 * @param options.packages - Selected verified package-set entries.
 * @param options.command - Absolute installed consumer command.
 * @param options.measureDispatch - Opt in to raw adapter observation and, for C/C++, the complete public consumer.
 * @param options.expectedModelSha256 - Producer model digest, required for raw observations.
 * @param options.leanPrefix - Matching Lean headers for the test-only raw probe.
 */
export const repeatFinContainerEdges = async ({ profile, consumer, handoff, packages, command, measureDispatch = false, expectedModelSha256, leanPrefix }) => {
	assert.equal(typeof measureDispatch, "boolean");
	const root = join(consumer, profile), pkg = packages.find(item => item.role === "component");
	assert.ok(pkg);
	const jvm = ["java", "kotlin"].includes(profile);
	const artifact = jvm ? pkg.artifacts.find(item => item.path.endsWith(".jar")) : pkg.artifacts[0];
	assert.ok(artifact);
	const archive = join(handoff, artifact.path);
	assert.equal(sha256(await readFile(archive)), artifact.sha256);
	let installed, receiptPath, archiveBytes, args, python;
	const deployed = {};
	if(profile === "python")
	{
		const identity = await runCopied(command, ["-I", "-c", "import json, pathlib, sys, lean_fincontainers; print(json.dumps({'site':str(pathlib.Path(lean_fincontainers.__file__).parent.parent),'version':sys.version.split()[0]}))"], root);
		const parsed = JSON.parse(identity.stdout);
		installed = parsed.site;
		assert.ok(installed.startsWith(`${root}/venv/`));
		python = parsed.version;
		receiptPath = "lean_fincontainers/lean_bridge/package-receipt.json";
		archiveBytes = (await runCopied("/usr/bin/unzip", ["-p", archive, receiptPath], root)).stdout;
		args = ["-I", "consumer.py"];
	}
	else if(profile === "ruby")
	{
		const gems = join(root, "gems");
		const identity = await runCopied(command, ["-e", "print Gem::Specification.find_by_name(ARGV.fetch(0), ARGV.fetch(1)).full_gem_path", pkg.name, pkg.version], root
			, { ...copiedCleanEnvironment, GEM_HOME: gems, GEM_PATH: gems });
		installed = identity.stdout;
		assert.ok(installed.startsWith(`${gems}/gems/`));
		receiptPath = "lean-bridge/package-receipt.json";
		archiveBytes = (await runCopied(command, ["--disable-gems", "-e", finContainerEdgeGemReceipt, archive], root)).stdout;
		args = ["consumer.rb"];
	}
	else if(profile === "rust")
	{
		const directory = `${pkg.name}-${pkg.version}`;
		installed = join(root, directory);
		receiptPath = "lean-bridge/package-receipt.json";
		archiveBytes = (await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xOf", archive, `${directory}/${receiptPath}`], root)).stdout;
		args = [];
	}
	else if(profile === "dotnet")
	{
		installed = join(root, "packages", pkg.name.toLowerCase(), pkg.version);
		receiptPath = "lean-bridge/package-receipt.json";
		archiveBytes = (await runCopied("/usr/bin/unzip", ["-p", archive, receiptPath], root)).stdout;
		args = ["out/Consumer.dll"];
		deployed[args[0]] = sha256(await readFile(join(root, args[0])));
	}
	else if(profile === "php-native")
	{
		installed = join(root, "vendor", pkg.name);
		receiptPath = "lean-bridge/package-receipt.json";
		archiveBytes = (await runCopied("/usr/bin/unzip", ["-p", archive, receiptPath], root)).stdout;
		args = ["-n", "-d", "extension=ffi", "-d", "ffi.enable=1", "consumer.php"];
		for(const path of ["consumer.php", "strict.php"]) deployed[path] = sha256(await readFile(join(root, path)));
	}
	else if(jvm)
	{
		// Verify the exact JAR that the caller loads, then inspect its receipt-pinned members.
		assert.equal(sha256(await readFile(join(root, "component.jar"))), artifact.sha256);
		installed = join(root, "jar-inspection");
		await runCopied("/usr/bin/unzip", ["-q", join(root, "component.jar"), "-d", installed], root);
		receiptPath = "META-INF/lean-bridge/package-receipt.json";
		archiveBytes = (await runCopied("/usr/bin/unzip", ["-p", archive, receiptPath], root)).stdout;
		args = ["--enable-native-access=ALL-UNNAMED", "-cp", profile === "java" ? "component.jar:." : "component.jar:consumer.jar", profile === "java" ? "Consumer" : "ConsumerKt"];
		for(const path of ["component.jar", profile === "java" ? "Consumer.class" : "consumer.jar"])
			deployed[path] = sha256(await readFile(join(root, path)));
	}
	else
	{
		assert.ok(["c", "cpp", "wit-wasi"].includes(profile));
		const directory = `${pkg.name}-${pkg.version}-${profile}`;
		installed = join(root, directory);
		receiptPath = "lean-bridge-package.json";
		archiveBytes = (await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xOf", archive, `${directory}/${receiptPath}`], root)).stdout;
		args = [];
	}
	assert.equal(await readFile(join(installed, receiptPath), "utf8"), archiveBytes, "installed receipt equals original archive member");
	const receipt = JSON.parse(archiveBytes);
	assert.equal(receipt.name, pkg.name);
	assert.equal(receipt.version, pkg.version);
	await verifyNativeFiles(installed, receipt.files);
	if(profile === "dotnet")
	{
		// The application loads the copied assembly and native libraries, not the NuGet cache originals.
		for(const [path, file] of Object.entries(receipt.files))
		{
			const target = path.startsWith("lib/net8.0/") && path.endsWith(".dll") ? `out/${basename(path)}`
				: path.startsWith("runtimes/linux-x64/native/") ? `out/${path}` : null;
			if(target === null) continue;
			const bytes = await readFile(join(root, target));
			assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256);
			deployed[target] = file.sha256;
		}
		assert.ok(Object.keys(deployed).some(path => path.endsWith(".so")));
		assert.ok(Object.keys(deployed).some(path => path.endsWith(".dll") && path !== "out/Consumer.dll"));
	}
	const executable = ["c", "cpp", "wit-wasi"].includes(profile)
		? await prepareFinContainerEdgeExecutable({ profile, root, directory: basename(installed), pkgConfig: profile === "wit-wasi" ? `${pkg.name}-wit` : receipt.pkgConfig })
		: profile === "rust" ? { executableSha256: sha256(await readFile(command)) } : null;
	if(executable?.runtimeSearchPath)
	{
		assert.equal(command, join(root, "consumer"));
		const before = await runCopied(command, args, root, copiedCleanEnvironment);
		assert.equal(before.stderr, "");
		assert.equal(before.stdout, `fin-container-ok:${finContainerEdgeChecks[profile]}\n`);
		assert.equal(sha256(await readFile(command)), executable.executableSha256);
	}
	const moved = `${root}-relocated`;
	const externalCommand = ["ruby", "dotnet", "java", "kotlin", "php-native"].includes(profile);
	assert.ok(externalCommand ? command.startsWith("/") : command.startsWith(`${root}/`));
	await rename(root, moved);
	await assert.rejects(access(root), { code: "ENOENT" });
	const movedCommand = externalCommand ? command : join(moved, relative(root, command));
	const environment = profile === "ruby"
		? { ...copiedCleanEnvironment, GEM_HOME: join(moved, "gems"), GEM_PATH: join(moved, "gems") }
		: profile === "dotnet" ? { ...copiedCleanEnvironment, DOTNET_ROOT: dirname(command), DOTNET_CLI_HOME: join(moved, "dotnet-home"), DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1" } : copiedCleanEnvironment;
	const repeated = await runCopied(movedCommand, args, moved, environment);
	assert.equal(repeated.stderr, "");
	assert.equal(repeated.stdout, `fin-container-ok:${finContainerEdgeChecks[profile]}\n`);
	if(profile === "php-native")
	{
		const strict = await runCopied(movedCommand, [...args.slice(0, -1), "strict.php"], moved, environment);
		assert.equal(strict.stderr, "");
		assert.equal(strict.stdout, repeated.stdout);
	}
	const movedInstall = join(moved, relative(root, installed));
	assert.equal(await readFile(join(movedInstall, receiptPath), "utf8"), archiveBytes);
	await verifyNativeFiles(movedInstall, receipt.files);
	if(executable) assert.equal(sha256(await readFile(movedCommand)), executable.executableSha256);
	for(const [path, digest] of Object.entries(deployed)) assert.equal(sha256(await readFile(join(moved, path))), digest);
	const rawAdapter = measureDispatch ? await observeFinContainerEdgeRaw({
		installed: movedInstall, receiptPath, receiptBytes: archiveBytes
		, expectedModelSha256, leanPrefix
		, probeRoot: join(consumer, `${profile}-edge-raw`) }) : null;
	const publicHost = measureDispatch && ["c", "cpp"].includes(profile) ? await observeFinContainerEdgePublic({
		installed: movedInstall, receiptPath, receiptBytes: archiveBytes
		, expectedModelSha256, profile
		, probeRoot: join(consumer, `${profile}-edge-public`) }) : null;
	return { relocatedInstallation: true
		, repeatExecution: true
		, installedFilesUnchanged: true
		, installedFilesSha256: sha256(canonicalJson(receipt.files))
		, installedReceiptSha256: sha256(archiveBytes)
		, ...executable
		, ...(Object.keys(deployed).length ? { deployedFiles: deployed } : {})
		, ...(profile === "php-native" ? { repeatStrictExecution: true } : {})
		, ...(rawAdapter ? { rawAdapterDispatch: rawAdapter } : {})
		, ...(publicHost ? { publicHostDispatch: publicHost } : {})
		, ...(python ? { python } : {}) };
};

/**
 * Build from two independent roots and execute ordinary-source prepared packages after author deletion.
 *
 * @param t - Test context owning temporary cleanup.
 * @param profiles - Explicit supported development slice.
 * @param reportPath - Fresh separated report path, validated before any compilation.
 * @param options - Explicit optional acceptance measurements.
 * @param options.measureDispatch - Measure raw C adapters of each installed package after its move.
 */
export const checkInstalledFinContainerEdges = async (t, profiles, reportPath, { measureDispatch = false } = {}) => {
	assert.equal(typeof measureDispatch, "boolean");
	assert.deepEqual(finContainerEdgeSelection(profiles.join(",")), profiles);
	await requireNewFinContainerEdgeReport(reportPath);
	const environment = finContainerEnvironment(profiles), reports = [], archives = [], authors = [];
	const targets = Object.fromEntries(profiles.map(profile => finContainerTargets[profile]));
	const source = await finContainerEdgeSource();
	for(const attempt of [0, 1])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edges-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edges-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		assert.ok(!authors.includes(author) && relative(author, consumer).startsWith("..")); authors.push(author);
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-fin-containers", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "FinContainers.lean", source);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["FinContainers"], targets }));
		t.diagnostic(`edge build ${attempt + 1}/2: ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: Object.keys(targets), environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const modelBytes = await readFile(join(outputRoot, "native/component/model.json"));
		const model = JSON.parse(modelBytes);
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, item.refinements ?? null])), finContainerEdgeRefinements);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		const dependencies = attempt === 0 && profiles.includes("rust")
			? await prepareRustCorpusDependencies({ rustRoot: join(outputRoot, "native/rust"), directory: author, handoff: join(consumer, "dependencies"), environment }) : undefined;
		await rm(author, { recursive: true, force: true });
		await assert.rejects(access(author), { code: "ENOENT" });
		if(attempt === 1) continue;
		for(const profile of profiles)
		{
			const packages = receipt.packages.filter(pkg => pkg.target === finContainerTargets[profile][0]);
			const consumerSource = await finContainerEdgeConsumer(profile);
			const { command, ...observation } = await installCopiedConsumer({ profile
				, consumer, handoff, packages, environment, dependencies
				, fixture: {
					source: () => consumerSource
					, success: "fin-container-ok"
					, expectedChecks: finContainerEdgeChecks[profile]
					, wit: [
						"mirror-all", "count-none", "sum-huge", "or-default"
						, "present", "flatten", "label", "wrap-all", "empty-array"
						, "empty-list", "empty-option", "optional-digits"
					].map(name => new RegExp(`${name}: func\\(`, "u")) } });
			const { rawAdapterDispatch, publicHostDispatch, ...repeated } = await repeatFinContainerEdges({
				profile, consumer, handoff, packages, command, measureDispatch
				, expectedModelSha256: sha256(modelBytes)
				, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX });
			reports.push({ profile
				, path: "ordinary-source"
				, ...observation
				, ...repeated
				, packages
				, sourceRemovedBeforeInstallation: true
				, fixtureSha256: sha256(source)
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, modelSha256: sha256(modelBytes)
				, bindingIrSha256: built.bindingIrSha256
				, receiptSha256
				, refinements: finContainerEdgeRefinements
				, dispatch: rawAdapterDispatch ? { kind: "fin-container-edge-dispatch-v1"
					, publicHost: publicHostDispatch ?? { observed: false, reason: "The separate C raw caller does not measure this host's public calls." }
					, rawAdapter: rawAdapterDispatch }
					: { observed: false, reason: "This supplement measures public behavior. Expanded source/adapter counters remain a separate required gate." } });
		}
	}
	assert.equal(new Set(authors).size, 2); assert.deepEqual(archives[1], archives[0]);
	const report = { schemaVersion: 1, profiles, reports, archives: archives[0], reproducible: true, authorRoots: 2 };
	await writeFinContainerEdgeReport(resolve(reportPath), report);
	return report;
};
