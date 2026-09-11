/**
 * Installed ordinary-project Perl coverage, including fail-closed installation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { chmod, copyFile, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { buildNativeComponent, buildNativeSharedRuntime } from "../src/build/native-component.mjs";
import { stageCpanPackage, archiveCpanPackage } from "../src/release/cpan-package.mjs";
import { compileCpanXsVariant } from "../src/build/perl-xs.mjs";
import { installCpanArchive } from "../scripts/test-perl-package-consumer.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { sha256 } from "../src/capsule/node.mjs";
import { benchmarkPerl } from "../scripts/benchmark-perl.mjs";
import { traceCpanInstall } from "../src/release/cpan-install-trace.mjs";

const enabled = process.env.LEAN_BRIDGE_PERL_NATIVE_TEST === "1";
const root = process.cwd();
const leanPrefix = process.env.LEAN_BRIDGE_LEAN_PREFIX ?? join(root, ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const perl = process.env.LEAN_BRIDGE_TEST_PERL ?? "/usr/bin/perl";
const floor = process.env.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR ?? "2.38";
const run = (command, args, cwd, env = process.env) => processBuildRunner.capture({ command, args, cwd, env });
const errorText = error => `${error.message}\n${JSON.stringify(error.details ?? {})}`;

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
    await compileCpanXsVariant({ packageRoot: runtimePackage, perl });
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
			, ["admitted", /depends on sorry/, []]
			, ["dependent", /dependent or implicit/, []]
			, ["polymorphic", /generic export/, []]
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
