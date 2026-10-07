/**
 * Checked top-level Fin sites in installed, relocated Rust crates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { chmod, cp, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileCopiedRustModel } from "../src/backends/rust/copied-model.mjs";
import { renderCopiedRustPackage } from "../src/backends/rust/copied-values.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { supportsNativeRefinementTargets } from "../src/build/native-project.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { corpusReviewedIr } from "./helpers/type-corpus-reviewed-ir.mjs";
import { reviewedScalarHostIr } from "./helpers/reviewed-scalar-host-fixture.mjs";
import { captureRustCompiler, prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";
import { nativeFinDispatchColumns, nativeFinSymbol } from "./helpers/native-fin-consumers.mjs";
import { nativeFinCountInterposer } from "./helpers/native-fin-count-interposer.mjs";
import { rustFinConsumer, rustFinDispatchExpected, rustFinDispatchProbe, rustFinInvalid } from "./helpers/rust-fin-consumers.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";

const huge = "1180591620717411303424";
const expectedBounds = {
	"NativeFin.impossible": [["0"], null]
	, "NativeFin.only": [["1"], null]
	, "NativeFin.mirror": [["10"], "10"]
	, "NativeFin.twice": [["300"], null]
	, "NativeFin.succHuge": [[huge], huge]
	, "NativeFin.wrap": [[null], "7"]
	, "NativeFin.label": [[null, "4", null], null]
};
const bounds = refinements => refinements ? [refinements.parameters.map(item => item?.bound ?? null), refinements.result?.bound ?? null] : null;
const linker = `#!/bin/sh
for arg do
  case "$arg" in -c|-S|-E|-x*|-fsyntax-only|*.c|*.C|*.cc|*.cpp|*.cxx|*.s|*.S|@*) exit 65;; esac
done
exec /usr/bin/cc "$@"
`;
const digest = async path => sha256(await readFile(path));
const sharedLibraries = files => Object.fromEntries(Object.entries(files)
	.filter(([path]) => /\.so(?:\.|$)/.test(path)).map(([path, file]) => [basename(path), file.sha256 ?? file]));

test("Rust crates are checked Fin consumers beside C, C++ and Python", () => {
	for(const targets of [["cargo"], ["c", "cargo"], ["pypi", "cargo"], ["c", "cpp", "pypi", "cargo"]])
		assert.equal(supportsNativeRefinementTargets(targets), true, targets.join(","));
	assert.equal(supportsNativeRefinementTargets(["cargo", "cpan"]), true);
});

test("generated Rust bound docs come only from checked refinement metadata", () => {
	const ir = corpusReviewedIr({ id: "fins" }, [
		{ name: "Fins.label", parameters: ["nat", "nat", "string"], result: "string" }
		, { name: "Fins.mirror", parameters: ["nat"], result: "nat" }
		, { name: "Fins.plain", parameters: ["nat"], result: "nat" }]);
	const declaration = name => ir.declarations.find(item => item.id === `lean:Fins.${name}`);
	declaration("label").source.extensions["lean-lang.org/refinements"] = { parameters: [null, { kind: "fin", bound: "4" }, null], result: null };
	declaration("mirror").source.extensions["lean-lang.org/refinements"] = { parameters: [{ kind: "fin", bound: huge }], result: { kind: "fin", bound: huge } };
	const zero = "0".repeat(64);
	const evidence = { library: "libfins.so", libraries: { "libfins.so": zero, "libleanshared.so": zero, "liblean_bridge_native.so": zero } };
	const files = renderCopiedRustPackage(compileCopiedRustModel(ir), evidence, { name: "fins-api", version: "1.0.0" });
	const source = files["src/lib.rs"];
	assert.match(source, /\/\/\/ Lean export: lean:Fins\.label\.\n\/\/\/\n\/\/\/ Checked Lean Fin bounds: value1 < 4\.\npub fn label\(/);
	assert.match(source, new RegExp(`/// Checked Lean Fin bounds: value0 < ${huge}; result < ${huge}\\.\\npub fn mirror\\(`));
	// An unrefined Nat keeps no bound; nothing is inferred from the erased transport type.
	assert.match(source, /\/\/\/ Lean export: lean:Fins\.plain\.\npub fn plain\(/);
	assert.match(files["README.md"], /Lean Fin n parameters and results use BigUint values below n\./);
	assert.match(files["README.md"], /Err\(Error::Native \{ code: 1, \.\. \}\)/);
	assert.match(files["README.md"], /\n- fins_api::label: value1 < 4\n/);
	assert.doesNotMatch(files["README.md"], /fins_api::plain/);
	const plain = corpusReviewedIr({ id: "plain" }, [{ name: "Plain.echo", parameters: ["nat"], result: "nat" }]);
	assert.doesNotMatch(renderCopiedRustPackage(compileCopiedRustModel(plain), evidence, { name: "plain-api", version: "1.0.0" })["README.md"], /Lean Fin/);
	// A top-level Subtype documents its checked constructor; one inside a container is refused.
	declaration("plain").source.extensions["lean-lang.org/refinements"] = { parameters: [{ kind: "subtype", constructor: "Fins.check" }], result: null };
	const checked = renderCopiedRustPackage(compileCopiedRustModel(ir), evidence, { name: "fins-api", version: "1.0.0" });
	assert.match(checked["README.md"], /value0 checked by Fins\.check|arg0 checked by Fins\.check/);
	assert.match(checked["README.md"], /Lean Subtype parameters cross as their base value\./);
	declaration("plain").source.extensions["lean-lang.org/refinements"] = { parameters: [{ kind: "array", arguments: [{ kind: "subtype", constructor: "Fins.check" }] }], result: null };
	assert.throws(() => renderCopiedRustPackage(compileCopiedRustModel(ir), evidence, { name: "fins-api", version: "1.0.0" }), TypeError);
});

/**
 * Install one crate offline through a link-only toolchain and exercise it.
 *
 * @param options - Verified handoff, vendored dependencies and selected tools.
 * @param options.consumer - Private test-owned root.
 * @param options.handoff - Verified archive handoff.
 * @param options.packages - Receipt entries for the Cargo target.
 * @param options.dependencies - Independently checksummed vendored dependencies.
 * @param options.environment - Absolute Cargo and Rust compiler paths.
 */
const installRustFin = async ({ consumer, handoff, packages, dependencies, environment }) => {
	const root = join(consumer, "rust"), tools = join(root, "tools"), pkg = packages.find(item => item.role === "component");
	await mkdir(tools, { recursive: true });
	await symlink("/usr/bin/ld", join(tools, "ld"));
	await saveLakeFile(tools, "link-only", linker); await chmod(join(tools, "link-only"), 0o755);
	const cargoHome = join(root, "cargo-home"); await mkdir(cargoHome);
	const env = { ...copiedCleanEnvironment
		, PATH: tools, RUSTC: environment.LEAN_BRIDGE_RUSTC
		, CARGO_HOME: cargoHome, CARGO_NET_OFFLINE: "true"
		, CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER: join(tools, "link-only") };
	const cargo = environment.LEAN_BRIDGE_CARGO;
	const dependencyArchive = join(consumer, "dependencies", dependencies.archive);
	assert.equal(await digest(dependencyArchive), dependencies.sha256);
	for(const archive of [join(handoff, pkg.artifacts[0].path), dependencyArchive])
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", archive], root);
	const installed = join(root, `${pkg.name}-${pkg.version}`);
	const receipt = JSON.parse(await readFile(join(installed, "lean-bridge/package-receipt.json"), "utf8"));
	await verifyNativeFiles(installed, receipt.files);
	const lib = await readFile(join(installed, "src/lib.rs"), "utf8");
	assert.match(lib, /\/\/\/ Checked Lean Fin bounds: arg0 < 10; result < 10\.\npub fn mirror\(arg0: &BigUint\) -> Result<BigUint, Error>/);
	assert.match(lib, /\/\/\/ Checked Lean Fin bounds: arg1 < 4\.\npub fn label\(arg0: &BigUint, arg1: &BigUint, arg2: &str\) -> Result<String, Error>/);
	await saveLakeFile(root, ".cargo/config.toml", '[source.crates-io]\nreplace-with = "prepared"\n[source.prepared]\ndirectory = "dependencies"\n');
	await saveLakeFile(root, "Cargo.toml", `[package]\nname="fin-consumer"\nversion="0.0.0"\nedition="2021"\n[dependencies]\n${pkg.name}={path="${pkg.name}-${pkg.version}"}\n[[bin]]\nname="consumer"\npath="src/main.rs"\n[profile.dev]\ndebug=0\nincremental=false\n`);
	await saveLakeFile(root, "src/main.rs", rustFinConsumer());
	await saveLakeFile(root, "src/bin/probe.rs", rustFinDispatchProbe());
	await runCopied(cargo, ["generate-lockfile", "--offline"], root, env);
	await runCopied(cargo, ["rustc", "--offline", "--locked", "--bin", "consumer", "--", "-Dwarnings"], root, env);
	await runCopied(cargo, ["rustc", "--offline", "--locked", "--bin", "probe", "--", "-Dwarnings"], root, env);
	const executable = join(root, "target/debug/consumer");
	const result = await runCopied(executable, [], root);
	assert.equal(result.stderr, ""); assert.match(result.stdout, /^rust-fin-ok:\d+\n$/);
	const checks = Number(result.stdout.trim().split(":")[1]); assert.ok(checks > 2000);
	// Signed and machine-word inputs never reach the native boundary: they do not compile.
	const rejected = [];
	for(const { name, statement, code } of rustFinInvalid)
	{
		const source = `use native_fin as api; fn main() { ${statement} }\n`;
		await saveLakeFile(root, `src/bin/${name}.rs`, source);
		const failure = await captureRustCompiler(cargo, ["check", "--offline", "--locked", "--bin", name, "--message-format=json"], root, env);
		assert.equal(failure.code, 101, failure.stderr);
		const diagnostics = failure.stdout.trim().split("\n").map(line => JSON.parse(line)).filter(item => item.reason === "compiler-message" && item.message.level === "error");
		assert.ok(diagnostics.length > 0);
		assert.ok(diagnostics.every(item => item.message.code?.code === code && item.message.spans.some(span => span.is_primary && span.file_name === `src/bin/${name}.rs`)), failure.stdout);
		rejected.push({ name, code, sourceSha256: sha256(source), diagnostics: diagnostics.length });
		await rm(join(root, `src/bin/${name}.rs`));
	}
	// The exported adapters and Lean sources are dynamic, interposable symbols.
	const nativeDirectory = Object.keys(receipt.files).find(path => /\.so$/.test(path)).split("/").slice(0, -1).join("/");
	const exported = [];
	for(const name of await readdir(join(installed, nativeDirectory)))
	{
		if(!/\.so$/.test(name)) continue;
		const symbols = (await runCopied("/usr/bin/nm", ["-D", "--defined-only", join(installed, nativeDirectory, name)], root, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" })).stdout;
		if(symbols.includes(nativeFinSymbol("NativeFin.mirror"))) exported.push(name);
	}
	assert.equal(exported.length, 1);
	await saveLakeFile(root, "interposer.c", nativeFinCountInterposer());
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-shared", "-fPIC", "interposer.c", "-o", "libdispatch.so"], root
		, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" });
	const probe = await runCopied(join(root, "target/debug/probe"), [], root, { ...copiedCleanEnvironment, LD_PRELOAD: join(root, "libdispatch.so") });
	assert.equal(probe.stderr, "");
	const observed = probe.stdout.trim().split("\n").map(line => {
		const [step, status, ...counts] = line.split(" ");
		return [step, status, counts.map(Number)];
	});
	assert.deepEqual(observed, rustFinDispatchExpected);
	const moved = join(consumer, "relocated-consumer");
	await rename(executable, moved);
	await rm(root, { recursive: true, force: true });
	const repeated = await runCopied(moved, [], consumer, { ...copiedCleanEnvironment, CARGO_HOME: "/unavailable", RUSTC: "/unavailable" });
	assert.equal(repeated.stderr, ""); assert.equal(repeated.stdout, result.stdout);
	return { checks, consumerSha256: sha256(rustFinConsumer())
		, offlineInstall: true, compilerFreePath: true
		, emptyCargoHome: true, linkOnly: true
		, relocatedExecutable: true, installedSourcesRemoved: true
		, repeatExecution: true
		, installedFilesSha256: sha256(canonicalJson(receipt.files))
		, nativeLibraries: sharedLibraries(receipt.files)
		, dynamicAdapterLibrary: exported[0]
		, dispatch: {
			columns: nativeFinDispatchColumns, observed, interposer: "LD_PRELOAD"
			, positiveControl: "valid public and raw calls increment adapter and source"
			, probeSha256: sha256(rustFinDispatchProbe())
		}
		, rejected, dependencies, executableSha256: await digest(moved) };
};

const checkInstalledRustFin = async (t, reviewed = false) => {
	const environment = nativeFixtureEnvironment(["c", "rust"]), reports = [], archives = [];
	for(const attempt of [0, 1])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-rust-fin-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-rust-fin-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-fin", projectRoot, { recursive: true });
		const reviewedSource = reviewed ? canonicalJson(reviewedScalarHostIr()) : null;
		if(reviewed) await saveLakeFile(projectRoot, "api.binding-ir.json", reviewedSource);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["NativeFin"]
			, targets: { c: { name: "native-fin", version: "1.0.0" }, cargo: { name: "native-fin", version: "1.0.0" } } }));
		t.diagnostic(`build ${attempt}: compiling the shared C library and Rust crate`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c", "cargo"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, bounds(item.refinements)])), expectedBounds);
		if(reviewed)
		{
			assert.equal(model.sourceIdentity.reviewedBindingIr.source, reviewedSource);
			assert.equal(model.sourceIdentity.reviewedBindingIr.sourceSha256, sha256(reviewedSource));
		}
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		const dependencies = attempt === 0
			? await prepareRustCorpusDependencies({ rustRoot: join(outputRoot, "native/rust"), directory: author, handoff: join(consumer, "dependencies"), environment })
			: null;
		await rm(author, { recursive: true, force: true });
		if(attempt === 1) break;
		// The C archive and the crate from this build must bundle the same checked native library.
		const cPackage = receipt.packages.find(pkg => pkg.target === "c" && pkg.role === "component");
		const extracted = join(consumer, "c-extract");
		await saveLakeFile(extracted, ".keep", "");
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, cPackage.artifacts[0].path)], extracted);
		const cInstalled = join(extracted, `${cPackage.name}-${cPackage.version}-c`);
		const cReceipt = JSON.parse(await readFile(join(cInstalled, "lean-bridge-package.json"), "utf8"));
		await verifyNativeFiles(cInstalled, cReceipt.files);
		const cLibraries = sharedLibraries(cReceipt.files);
		t.diagnostic("offline crate installation without producer files or Lean/C compilers");
		const packages = receipt.packages.filter(pkg => pkg.target === "cargo");
		const observation = await installRustFin({ consumer, handoff, packages, dependencies, environment });
		const shared = Object.keys(observation.nativeLibraries).filter(name => Object.hasOwn(cLibraries, name)).sort();
		assert.ok(shared.includes("libnative_fin.so"), JSON.stringify({ crate: observation.nativeLibraries, c: cLibraries }));
		for(const name of shared) assert.equal(observation.nativeLibraries[name], cLibraries[name], name);
		reports.push({ profile: "rust"
			, path: reviewed ? "reviewed-ir" : "ordinary-source"
			, ...observation
			, packages
			, sharedNativeLibraries: Object.fromEntries(shared.map(name => [name, cLibraries[name]]))
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
			, ...(reviewed ? { reviewedSourceSha256: model.sourceIdentity.reviewedBindingIr.sourceSha256 } : {})
			, sourceRemovedBeforeInstallation: true });
		await rm(consumer, { recursive: true, force: true });
	}
	// Two clean authoring roots must produce byte-identical C and Cargo archives.
	assert.deepEqual(archives[1], archives[0]);
	await saveLakeFile("build/native-fin", reviewed ? "rust-reviewed.json" : "rust.json", canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
};

test("relocated source-free Rust crates check Fin bounds through public and raw adapters", { skip: process.env.LEAN_BRIDGE_RUST_FIN_TEST !== "1", timeout: 2_400_000 }, t => checkInstalledRustFin(t));

test("independently reviewed Rust crates check scalar Fin through installed public and raw adapters", { skip: process.env.LEAN_BRIDGE_RUST_FIN_TEST !== "1", timeout: 2_400_000 }, t => checkInstalledRustFin(t, true));
