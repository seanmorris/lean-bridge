/**
 * Installed ordinary-project Perl coverage, including fail-closed installation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { chmod, copyFile, cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { buildNativeComponent, buildNativeSharedRuntime } from "../src/build/native-component.mjs";
import { buildNativeProject } from "../src/build/native-project.mjs";
import { readExportConfiguration } from "../src/analyze/export-configuration.mjs";
import { stageCpanPackage, archiveCpanPackage } from "../src/release/cpan-package.mjs";
import { compileCpanXsVariant } from "../src/build/perl-xs.mjs";
import { installCpanArchive } from "../scripts/test-perl-package-consumer.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { benchmarkPerl } from "../scripts/benchmark-perl.mjs";
import { traceCpanInstall } from "../src/release/cpan-install-trace.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_PERL_NATIVE_TEST === "1";
const root = process.cwd();
const leanPrefix = process.env.LEAN_BRIDGE_LEAN_PREFIX ?? join(root, ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const perl = process.env.LEAN_BRIDGE_TEST_PERL ?? "/usr/bin/perl";
const floor = process.env.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR ?? "2.38";
const run = (command, args, cwd, env = process.env) => processBuildRunner.capture({ command, args, cwd, env });
const errorText = error => `${error.message}\n${JSON.stringify(error.details ?? {})}`;

const metadataProject = async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-native-metadata-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const projectRoot = join(working, "project");
	await saveLakeFile(projectRoot, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(projectRoot, "lakefile.toml", 'name = "sample"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Sample"\n');
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Sample"], exports: ["Sample.increment"] }));
	await saveLakeFile(projectRoot, "Sample.lean", `namespace Sample
abbrev Word := UInt32
abbrev Unary := Word → Word
/-- 🙂 Keep the native alias. -/
def increment : Unary := fun value => value + 1
theorem increment_spec (value : Word) : increment value = value + 1 := rfl
namespace Shadow
def increment (value : Word) : Word := value
theorem increment_spec (value : Word) : increment value = value := rfl
end Shadow
private def secret : Word := 7
def unsupportedHelper : Array (Word → Word) := #[]
end Sample
`);
	for(const path of await readdir(projectRoot)) await chmod(join(projectRoot, path), 0o444);
	return { working, projectRoot, runtimeRoot: join(working, "runtime"), leanPrefix };
};

test("native shared metadata preserves checked aliases, docs and proof relationships across relocation", { skip: !enabled, timeout: 180_000 }, async t => {
	const context = await metadataProject(t), before = await lakeInputState(context.projectRoot);
	await buildNativeSharedRuntime({ outputRoot: context.runtimeRoot, leanPrefix });
	const outputRoot = join(context.working, "native");
	const first = await buildNativeComponent({ ...context, outputRoot });
	const metadata = JSON.parse(await readFile(join(outputRoot, "metadata.json"), "utf8"));
	await assertJsonSchema("elaborated-export-metadata", metadata);
	assert.equal(metadata.profile, "native-library-v1");
	const declarations = metadata.modules[0].declarations;
	const item = declarations.find(item => item.identity === "Sample.increment");
	assert.match(item.documentation, /🙂 Keep the native alias/);
	assert.equal(item.source.startLine, 4);
	assert.deepEqual(item.theoremReferences, ["Sample.increment_spec"]);
	assert.equal(item.projection.parameters[0].type.abi.cType, "uint32_t");
	assert.deepEqual(first.model.bindingIr.declarations[0].source.extensions["lean-lang.org/theorem-references"], ["Sample.increment_spec"]);
	assert.deepEqual(first.model.bindingIr.declarations[0].assurance, []);
	assert.equal(declarations.find(item => item.identity === "Sample.unsupportedHelper").projection.reason, "unsupported-native-type");
	assert.ok(declarations.some(item => item.visibility === "private"));
	assert.deepEqual(metadata.diagnostics, []);
	const relocated = join(context.working, "relocated");
	await cp(context.projectRoot, relocated, { recursive: true });
	const second = await buildNativeComponent({ ...context, projectRoot: relocated, outputRoot: join(context.working, "second") });
	assert.deepEqual(second.receipt, first.receipt);
	assert.deepEqual(second.model, first.model);
	assert.deepEqual(await lakeInputState(context.projectRoot), before);
	const forged = structuredClone(metadata);
	forged.modules[0].declarations.find(item => item.identity === "Sample.increment").documentation = "Unrelated metadata";
	await writeFile(join(outputRoot, "metadata.json"), canonicalJson(forged));
	const receipt = structuredClone(first.receipt);
	receipt.metadataSha256 = sha256(canonicalJson(forged));
	await writeFile(join(outputRoot, "native-component.json"), canonicalJson(receipt));
	const artifacts = JSON.parse(await readFile(join(outputRoot, "artifacts.json"), "utf8"));
	for(const path of ["metadata.json", "native-component.json"])
	{
		const bytes = await readFile(join(outputRoot, path));
		artifacts.files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
	}
	await writeFile(join(outputRoot, "artifacts.json"), canonicalJson(artifacts));
	await assert.rejects(() => stageCpanPackage({ ...context, componentRoot: outputRoot, outputRoot: join(context.working, "package") }), /model differs from shared compiler metadata/);
});

test("native extraction rejects forged reports, interface drift and ABI disagreement without releasing output", { skip: !enabled, timeout: 300_000 }, async t => {
	const context = await metadataProject(t), before = await lakeInputState(context.projectRoot);
	await buildNativeSharedRuntime({ outputRoot: context.runtimeRoot, leanPrefix });
	for(const mode of ["failure", "json", "identity", "source", "sidecar", "late-sidecar", "abi", "cancel"])
		await t.test(mode, async () => {
			let staging, invoked = false, linked = false;
			const cancellation = new AbortController();
			const runner = { capture: async request => {
				if(request.args[0] === "-shared") linked = true;
				if(request.args.includes("--metadata"))
				{
					invoked = true; staging = dirname(request.args.at(-1));
					if(mode === "failure") throw new Error("Extractor execution failed");
					if(mode === "json") return { stdout: "{incomplete", stderr: "", code: 0 };
					if(mode === "cancel")
					{
						cancellation.abort(new Error("Cancelled native extraction"));
						throw cancellation.signal.reason;
					}
					const result = await processBuildRunner.capture(request), metadata = JSON.parse(result.stdout);
					if(mode === "identity") metadata.modules[0].interfaceSha256 = "0".repeat(64);
					if(mode === "source") await writeFile(join(staging, "source/Sample.lean"), "-- altered after extraction\n");
					if(mode === "sidecar") await writeFile(join(staging, "olean/Sample.olean.server"), "changed metadata");
					if(mode === "abi")
					{
						const item = metadata.modules[0].declarations.find(item => item.identity === "Sample.increment");
						item.projection.result.abi = { cType: "uint64_t", box: "lean_box_uint64", unbox: "lean_unbox_uint64", heap: false };
					}
					return { ...result, stdout: canonicalJson(metadata) };
				}
				const result = await processBuildRunner.capture(request);
				if(mode === "late-sidecar" && request.args.includes(join(staging ?? "", "c/adapter.c")))
					await writeFile(join(staging, "olean/Sample.olean.private"), "changed after adapter compilation");
				return result;
			} };
			const outputRoot = join(context.working, mode);
			await assert.rejects(() => buildNativeComponent({ ...context, outputRoot, runner, signal: cancellation.signal }), error => {
				if(mode === "cancel") return /Cancelled native extraction/.test(errorText(error));
				if(mode === "abi") return /conflicting types/.test(errorText(error));
				const code = ["failure", "json"].includes(mode) ? "lean-metadata-extractor-failed"
					: mode === "identity" ? "invalid-elaborated-metadata" : "native-elaboration-drift";
				return error.code === code;
			}, mode);
			assert.equal(invoked, true);
			assert.equal(linked, false);
			await assert.rejects(() => lstat(staging), { code: "ENOENT" });
			await assert.rejects(() => lstat(outputRoot), { code: "ENOENT" });
			assert.deepEqual(await lakeInputState(context.projectRoot), before);
		});
});

test("Perl CBuilder receives development headers without Nix build-role variables", { skip: !enabled }, async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-perl-headers-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const include = join(working, "development headers");
	await mkdir(include);
	await writeFile(join(include, "lean_bridge_header_probe.h"), "#define LEAN_BRIDGE_HEADER_VALUE 7\n");
	await writeFile(join(working, "probe.c"), "#include <lean_bridge_header_probe.h>\nint probe(void) { return LEAN_BRIDGE_HEADER_VALUE; }\n");
	const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("NIX_") && !["CPATH", "C_INCLUDE_PATH", "CPLUS_INCLUDE_PATH", "OBJC_INCLUDE_PATH"].includes(key)));
	const args = ["-MExtUtils::CBuilder", "-e", 'ExtUtils::CBuilder->new(quiet => 0)->compile(source => "probe.c", object_file => "probe.o");'];
	await assert.rejects(() => run(perl, args, working, environment), error => /lean_bridge_header_probe\.h/.test(errorText(error)));
	await run(perl, args, working, { ...environment, C_INCLUDE_PATH: include });
	assert.ok((await readFile(join(working, "probe.o"))).length > 0);
});

test("shared configuration drives a compiled and installed native package", { skip: !enabled, timeout: 600_000 }, async t => {
	await mkdir("build", { recursive: true });
	const working = await mkdtemp(join(root, "build/.shared-native-test-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const projectRoot = join(root, "tests/fixtures/export-selection");
	const before = await readExportConfiguration(projectRoot);
	const output = join(working, "release");
	let result;
	try
	{
		result = await buildNativeProject({
			projectRoot, outputRoot: output, targets: ["cpan"]
			, environment: { ...process.env
				, LEAN_BRIDGE_LEAN_PREFIX: leanPrefix
				, LEAN_BRIDGE_PERLS: JSON.stringify([perl]) } });
	} catch(error)
	{
		throw new Error(errorText(error), { cause: error });
	}
	assert.equal(result.configurationSha256, before.sha256);
	assert.equal(result.packages[1].archive, "LeanBridge-Selected-0.007.tar.gz");
	const manifest = JSON.parse(await readFile(join(output, "packages/component/lean-bridge-package.json"), "utf8"));
	assert.equal(manifest.module, "LeanBridge::Selected");
	assert.equal(manifest.version, "0.007");
	const model = JSON.parse(await readFile(join(output, "native/component/model.json"), "utf8"));
	assert.deepEqual(model.exports.map(item => item.name), ["First.bump"]);
	const prefix = join(working, "installed");
	for(const entry of result.packages)
		await installCpanArchive({ archive: join(output, "archives", entry.archive)
			, workingRoot: working, prefix, perl, mode: "prebuilt-only" });
	const consumer = await run(perl, ["-MLeanBridge::Selected", "-e", "print LeanBridge::Selected::bump(41)"], working,
		{ ...process.env, PERL5LIB: join(prefix, "lib/perl5") });
	assert.equal(consumer.stdout, "42");
	assert.deepEqual(await readExportConfiguration(projectRoot), before);
});

test("Perl installs ordinary Lean packages through prebuilt and XS-only paths", { skip: !enabled, timeout: 600_000 }, async t => {
  await mkdir("build", { recursive: true });
  const working = await mkdtemp(join(root, "build/.perl-native-test-"));
  const runtimeRoot = join(working, "runtime"), nativeRoot = join(working, "native"), packages = join(working, "packages");
  const prefix = join(working, "installed"), fallback = join(working, "fallback");
  const env = { ...process.env, PERL5LIB: join(prefix, "lib/perl5") };
  try
{
    await buildNativeSharedRuntime({ outputRoot: runtimeRoot, leanPrefix });
    const built = await buildNativeComponent({ projectRoot: join(root, "tests/fixtures/perl/ordinary")
    , outputRoot: nativeRoot
      , runtimeRoot, leanPrefix, resources: ["Workshop.Counter"]
      , arities: { "Workshop.makeAdder": 1, "Workshop.keepCallback": 1, "Workshop.newRunner": 1 } });
    assert.equal(built.model.exports.length, 50);
    const runtimePackage = join(packages, "runtime"), componentPackage = join(packages, "component");
    await stageCpanPackage({ outputRoot: runtimePackage, runtimeRoot, leanPrefix, glibcMinimumVersion: floor });
    const runtimeVariant = await compileCpanXsVariant({ packageRoot: runtimePackage, perl });
    const runtimeXsReceipt = JSON.parse(await readFile(join(runtimePackage, "prebuilt", runtimeVariant.abiKey, "receipt.json"), "utf8"));
    assert.equal(runtimeXsReceipt.commands.find(command => command.includes("-c")).filter(flag => /^-g/.test(flag)).at(-1), "-g0");
    const runtimeArchive = await archiveCpanPackage({ packageRoot: runtimePackage, outputRoot: join(working, "archives") });
    const noCompiler = join(working, "no-compiler"); await mkdir(noCompiler);
    for(const name of ["cc", "c++", "gcc", "g++", "clang", "clang++", "x86_64-linux-gnu-gcc", "lean", "lake", "node"])
{
      await copyFile(join(root, "tests/fixtures/perl/deny-tool.sh"), join(noCompiler, name)); await chmod(join(noCompiler, name), 0o755);
}
    const prebuiltEnv = { ...env, PATH: `${noCompiler}:${process.env.PATH}` };
    await installCpanArchive({ archive: runtimeArchive.path, workingRoot: working, prefix, perl, mode: "prebuilt-only", environment: prebuiltEnv });
    await stageCpanPackage({ outputRoot: componentPackage, runtimeRoot, componentRoot: nativeRoot, leanPrefix, version: "0.002", glibcMinimumVersion: floor });
    const metadata = JSON.parse(await readFile(join(componentPackage, "META.json"), "utf8"));
    assert.equal(metadata.prereqs.runtime.requires["LeanBridge::Runtime"], "0.001", "component releases do not advance the shared runtime version");
    await compileCpanXsVariant({ packageRoot: componentPackage, perl, environment: env });
    const archive = await archiveCpanPackage({ packageRoot: componentPackage, outputRoot: join(working, "archives") });
    await installCpanArchive({ archive: archive.path, workingRoot: working, prefix, perl, mode: "prebuilt-only", environment: prebuiltEnv });
    const otherProject = join(working, "other-source");
    await cp(join(root, "tests/fixtures/perl/other"), otherProject, { recursive: true });
    await copyFile(join(root, "tests/fixtures/perl/ordinary/Workshop.lean"), join(otherProject, "Workshop.lean"));
    const otherNative = join(working, "other-native"), otherPackage = join(packages, "other");
    await buildNativeComponent({ projectRoot: otherProject
    , outputRoot: otherNative
    , runtimeRoot
    , leanPrefix
      , modules: ["Other"], resources: ["Workshop.Counter"] });
    await stageCpanPackage({ outputRoot: otherPackage, runtimeRoot, componentRoot: otherNative, leanPrefix, glibcMinimumVersion: floor });
    await compileCpanXsVariant({ packageRoot: otherPackage, perl, environment: env });
    const otherArchive = await archiveCpanPackage({ packageRoot: otherPackage, outputRoot: join(working, "archives") });
    await installCpanArchive({ archive: otherArchive.path, workingRoot: working, prefix, perl, mode: "prebuilt-only", environment: prebuiltEnv });
    prebuiltEnv.LEAN_BRIDGE_PERL_OTHER = "1";
		const consumer = await run(perl, [join(root, "tests/fixtures/perl/consumer.t")], working, prebuiltEnv);
    assert.match(consumer.stdout, /1\.\.\d+\s*$/); assert.doesNotMatch(consumer.stdout, /^not ok/m);
		t.diagnostic(consumer.stdout.trim().split("\n").at(-1));
    const example = await run(perl, [join(root, "tests/fixtures/documentation/consumers/perl/consumer.pl")], working, prebuiltEnv);
    assert.equal(example.stdout, "42\n42\n42\n41\n", "documented prepared consumer executes unchanged");
    const noLean = join(working, "no-lean"); await mkdir(noLean);
    for(const name of ["lean", "lake", "node"])
{
      await copyFile(join(root, "tests/fixtures/perl/deny-tool.sh"), join(noLean, name)); await chmod(join(noLean, name), 0o755);
}
    const fallbackEnv = { ...env, PATH: `${noLean}:${process.env.PATH}`, PERL5LIB: `${join(fallback, "lib/perl5")}:${env.PERL5LIB}` };
    await installCpanArchive({ archive: runtimeArchive.path, workingRoot: working, prefix: fallback, perl, mode: "build-xs", environment: fallbackEnv });
    await installCpanArchive({ archive: archive.path, workingRoot: working, prefix: fallback, perl, mode: "build-xs", environment: fallbackEnv });
    const rebuilt = await run(perl, [join(root, "tests/fixtures/perl/consumer.t")], working, fallbackEnv);
    assert.doesNotMatch(rebuilt.stdout, /^not ok/m);
    const abi = await run(perl, ["-MConfig", "-e", "print $Config{archname}"], working);
    const installedRoot = join(fallback, "lib/perl5", abi.stdout);
    const installReceipt = JSON.parse(await readFile(join(installedRoot, "LeanBridge/Workshop/install-receipt.json"), "utf8"));
		assert.equal(installReceipt.operation, "generated-xs-only");
    assert.equal((await traceCpanInstall({ packageRoot: componentPackage, installRoot: installedRoot })).nativePayloadUnchanged, true);
    assert.ok(installReceipt.commands.length >= 2);
    assert.equal(installReceipt.commands.find(command => command.includes("-c")).filter(flag => /^-g/.test(flag)).at(-1), "-g0");
    assert.equal(sha256(await readFile(join(installedRoot, "LeanBridge/Workshop/native", built.receipt.library))), built.receipt.nativeLibrary.sha256);
    const autoPackage = join(packages, "auto-component");
    await cp(componentPackage, autoPackage, { recursive: true });
    const autoManifest = JSON.parse(await readFile(join(autoPackage, "lean-bridge-package.json"), "utf8"));
    autoManifest.prebuilt = [];
    await writeFile(join(autoPackage, "lean-bridge-package.json"), JSON.stringify(autoManifest));
    const autoArchive = await archiveCpanPackage({ packageRoot: autoPackage, outputRoot: join(working, "auto-archives") });
    await installCpanArchive({ archive: autoArchive.path, workingRoot: working, prefix: fallback, perl, mode: "auto", environment: fallbackEnv });
    assert.equal((await run(perl, ["-MLeanBridge::Workshop", "-e", "print LeanBridge::Workshop::add(19,23)"], working, fallbackEnv)).stdout, "42");
    const repeat = await archiveCpanPackage({ packageRoot: componentPackage, outputRoot: join(working, "repeat") });
    assert.equal(repeat.receipt.sha256, archive.receipt.sha256);
    const independent = await buildNativeComponent({ projectRoot: join(root, "tests/fixtures/perl/ordinary")
    , outputRoot: join(working, "independent-native")
      , runtimeRoot, leanPrefix, resources: ["Workshop.Counter"]
      , arities: { "Workshop.makeAdder": 1, "Workshop.keepCallback": 1, "Workshop.newRunner": 1 } });
    assert.deepEqual(independent.receipt, built.receipt, "independent native build has identical checked outputs");
    // The loader must reject conflicting module identities before loading ELF code.
    await assert.rejects(run(perl, ["-MLeanBridge::Workshop"
    , "-MLeanBridge::Runtime"
    , "-e"
      , 'LeanBridge::Runtime::_load_component($INC{"LeanBridge/Workshop.pm"}, "unused.so", "unused", LeanBridge::Runtime::_identity(), { Workshop => "different" })'], working, env),
    error => /Conflicting compiled Lean module/.test(errorText(error)));

    for(const [label, mutate, mode, pattern, testEnv] of [
      ["missing-prebuilt", manifest => { manifest.prebuilt = []; }, "prebuilt-only", /No compatible prebuilt/, env]
      , ["missing-compiler", manifest => { manifest.prebuilt = []; }, "auto", /compiler unavailable/, prebuiltEnv]
      , ["invalid-mode", () => {}, "unknown", /must be auto/, env]
      , ["incompatible-platform", manifest => { manifest.glibcMinimumVersion = "2.999"; }, "auto", /requires glibc/, env]
      , ["incompatible-abi", manifest => { manifest.prebuilt[0].abiKey = "0".repeat(64); }, "prebuilt-only", /No compatible prebuilt/, env]
      , ["incompatible-runtime", manifest => { manifest.runtimeIdentity = "0".repeat(64); }, "auto", /Incompatible shared Lean runtime/, env]
    ]) {
      const directory = join(working, label); await cp(componentPackage, directory, { recursive: true });
      const manifest = JSON.parse(await readFile(join(directory, "lean-bridge-package.json"), "utf8"));
      mutate(manifest); await writeFile(join(directory, "lean-bridge-package.json"), JSON.stringify(manifest));
      await assert.rejects(run(perl, ["Makefile.PL"], directory, { ...testEnv, LEAN_BRIDGE_PERL_INSTALL_MODE: mode }), error => pattern.test(errorText(error)), label);
    }
    const corrupt = join(working, "corrupt"); await cp(componentPackage, corrupt, { recursive: true });
    const corruptManifest = JSON.parse(await readFile(join(corrupt, "lean-bridge-package.json"), "utf8"));
    await writeFile(join(corrupt, corruptManifest.prebuilt[0].path), "corrupt");
    await assert.rejects(run(perl, ["Makefile.PL"], corrupt, env), error => /Corrupt package artifact/.test(errorText(error)));
		assert.ok(!(await readdir(corrupt)).includes("_xs-build"), "corruption must not trigger fallback");
    if(process.env.LEAN_BRIDGE_PERL_BENCHMARK_DIR)
{
      const report = await benchmarkPerl({ nativeRoot, runtimeRoot, prefix, perl, leanPrefix, outputRoot: process.env.LEAN_BRIDGE_PERL_BENCHMARK_DIR });
      assert.equal(report.nativeLibrarySha256, built.receipt.nativeLibrary.sha256);
      for(const item of Object.values(report.cases)) assert.ok(Number.isFinite(item.relativeCost) && item.relativeCost > 0);
      await writeFile(join(process.env.LEAN_BRIDGE_PERL_BENCHMARK_DIR, "acceptance.json"), JSON.stringify({
        schemaVersion: 1
        , perl
        , glibcMinimumVersion: floor
        , nativeLibrarySha256: built.receipt.nativeLibrary.sha256
        , packages: [runtimeArchive.receipt, archive.receipt, otherArchive.receipt]
      }, null, 2) + "\n");
}
} catch(error)
{
    t.diagnostic(errorText(error));
    throw error;
} finally
{
    if(process.env.LEAN_BRIDGE_KEEP_PERL_TEST === "1") t.diagnostic(`Perl test artifacts: ${working}`);
    else await rm(working, { recursive: true, force: true });
}
});

test("fresh Lean metadata rejects unsupported or unreviewed exports before releasing native output", { skip: !enabled, timeout: 180_000 }, async () => {
	const working = await mkdtemp(join(root, "build/.perl-rejection-test-"));
	try
	{
		const runtimeRoot = join(working, "runtime");
		await buildNativeSharedRuntime({ outputRoot: runtimeRoot, leanPrefix });
		for(const [name, pattern, resources] of [
			["loop", /partial/, []]
			, ["viaLoop", /partial/, []]
			, ["admitted", /admitted-implementation/, []]
			, ["dependent", /dependent or implicit/, []]
			, ["polymorphic", /specialization-required/, []]
			, ["viaForeign", /foreign implementation contract/, []]
			, ["echoTiny", /no stable heap identity/, ["Rejections.Tiny"]]
		]) {
			await assert.rejects(buildNativeComponent({
				projectRoot: join(root, "tests/fixtures/perl/rejected")
				, outputRoot: join(working, name)
				, runtimeRoot
				, leanPrefix
				, modules: ["Rejections"]
				, exports: [`Rejections.${name}`]
				, resources
			}), error => pattern.test(errorText(error)), name);
			assert.ok(!(await readdir(working)).includes(name), `${name}: no rejected release remains`);
		}
	} finally
	{
		await rm(working, { recursive: true, force: true });
	}
});
