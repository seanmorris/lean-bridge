/**
 * Generated Ruby package sources and real source-free native loading.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { generateOwnedRubyPackage } from "../src/backends/ruby/owned-package.mjs";
import { verifiedRubyAssets } from "../src/backends/ruby/verified-assets.mjs";
import { buildNativeGmp } from "../src/build/native-gmp.mjs";
import { readVerifiedNativeRuntime } from "../src/build/native-artifacts.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("owned Ruby package sources preserve the public API and enforce private layouts", () => {
	const model = generateOwnedRubyPackage(ownedCppCompositionReviewedIr());
	assert.equal(model.contract.gmp, "libgmp-lean-bridge.so.10");
	assert.equal(model.contract.loadingPolicy, "linux-x64-deepbind-v1");
	assert.equal(model.abiHeader.match(/_Static_assert/gu).length, 208);
	const entry = model.files[`lib/${model.requirePath}.rb`];
	assert.doesNotMatch(entry, /Fiddle|Pointer|\.pack\(|\.unpack/u);
	assert.match(entry, /require_relative "owned_aggregates\/owned"/u);
	assert.match(entry, /require_relative "owned_aggregates\/native"/u);
	assert.match(model.files[`lib/${model.requirePath}/native.rb`], /Build a compiled RubyGems release/u);
	assert.equal(JSON.parse(model.files["binding-manifest.json"]).backend, "owned-ruby-v1");
	const entries = ["libtest.so", "libleanshared.so", "liblean_bridge_native.so", "libgmp-lean-bridge.so.10"].map(name => [name, "0".repeat(64)]);
	const evidence = { runtimeIdentity: "0".repeat(64), componentId: "test@1", library: "libtest.so" };
	assert.equal(verifiedRubyAssets({ ...evidence, libraries: Object.fromEntries(entries) }), verifiedRubyAssets({ ...evidence, libraries: Object.fromEntries([...entries].reverse()) }));
	for(const libraries of [{ "../escape.so": "0".repeat(64) }, { "libgmp.so.10": "0".repeat(64) }])
		assert.throws(() => verifiedRubyAssets({ runtimeIdentity: "0".repeat(64), componentId: "test@1", library: "libtest.so", libraries }), /Invalid authenticated/u);
});

for(const reviewed of [false, true]) test(`owned Ruby package sources load compiled Lean without the producer (${reviewed ? "reviewed" : "ordinary"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 900000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		fixture: "owned-cpp-composition", hostCallbacks: true
		, ...reviewed ? { reviewedIr: ownedCppCompositionReviewedIr() } : {} });
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-owned-loader-"));
	if(process.env.LEAN_BRIDGE_RUBY_DEBUG === "1") t.diagnostic(`Retaining loader diagnostic workspace: ${directory}`);
	else t.after(() => rm(directory, { recursive: true, force: true }));
	const c = generateOwnedCPackage({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, hostCallbacks: true });
	const model = generateOwnedRubyPackage(c.values.native.model.bindingIr), p = model.c.prefix;
	const privateGmp = join(compiled.directory, "private-gmp");
	await buildNativeGmp({ root: privateGmp, privateSoname: true });
	for(const [path, source] of Object.entries(c.files))
		if(!path.startsWith("src/")) await saveLakeFile(compiled.directory, path.split("/").at(-1), source);
	await saveLakeFile(compiled.directory, "ruby-abi.h", model.abiHeader);
	await saveLakeFile(compiled.directory, "public-api.c", `#define _GNU_SOURCE
#include "ruby-abi.h"
#include <dlfcn.h>
${c.source}
${model.cSource}
size_t owned_test_identities(void) { lean_bridge_native_snapshot value; lean_bridge_native_snapshot_read(&value); return value.live_identities; }
const char *owned_test_gmp_path(void) { Dl_info info; return dladdr((void *)(uintptr_t)&__gmpz_init, &info) ? info.dli_fname : ""; }
`);
	const library = `lib${p}_ruby.so`;
	await runCopied("cc", ["-std=c11", "-O2", "-g0", "-fPIC", "-shared"
		, "-Wall", "-Wextra", "-Werror", "-I", join(privateGmp, "include")
		, "-I", join(compiled.directory, "runtime/include")
		, "public-api.c", "Owned.o", "Carriers.o", "Witness.o", "Callbacks.o"
		, "-L", join(privateGmp, "lib")
		, "-L", join(compiled.directory, "runtime/lib")
		, "-Wl,--no-as-needed", "-l:libgmp-lean-bridge.so.10"
		, "-llean_bridge_native", "-lleanshared"
		, "-Wl,-rpath,$ORIGIN", "-Wl,-z,defs", "-Wl,--build-id=none"
		, `-Wl,-soname,${library}`, "-ldl", "-o", library]
	, compiled.directory, process.env).catch(error => {
		error.message += `: ${JSON.stringify(error.details)}`;
		throw error;
	});
	const { identity } = await readVerifiedNativeRuntime(join(compiled.directory, "runtime"));
	const paths = { [library]: join(compiled.directory, library)
		, "libgmp-lean-bridge.so.10": join(privateGmp, "lib/libgmp-lean-bridge.so.10")
		, "liblean_bridge_native.so": join(compiled.directory, "runtime/lib/liblean_bridge_native.so")
		, "libleanshared.so": join(compiled.directory, "runtime/lib/libleanshared.so") };
	const libraries = {};
	const packageRoot = join(directory, "package"), native = `lib/${model.requirePath}/native/linux-x64`;
	for(const [name, path] of Object.entries(paths))
	{
		const bytes = await readFile(path); libraries[name] = sha256(bytes);
		await saveLakeFile(packageRoot, `${native}/${name}`, bytes);
	}
	const evidence = { runtimeIdentity: identity, componentId: compiled.model.component.id, library, libraries };
	const packaged = generateOwnedRubyPackage(c.values.native.model.bindingIr, evidence);
	for(const [path, source] of Object.entries(packaged.files)) await saveLakeFile(packageRoot, path, source);
	const probe = await readFile("tests/fixtures/structured-types/owned-ruby-loading.rb", "utf8");
	await saveLakeFile(directory, "consumer.rb", probe);
	await rm(compiled.directory, { recursive: true, force: true });
	const command = resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby");
	const environment = { PATH: "/usr/bin:/bin", RUBYLIB: join(packageRoot, "lib") };
	const consume = async env => promisify(execFile)(command, ["--disable-gems", "consumer.rb"], {
		cwd: directory, env, timeout: 180000, maxBuffer: 8 * 1024 * 1024
	}).catch(error => {
		error.message = `Ruby loader consumer failed: ${error.stderr?.slice(0, 16000) ?? error.message}`;
		throw error;
	});
	const result = await consume(environment);
	assert.equal(result.stderr, "");
	const observation = JSON.parse(result.stdout);
	assert.equal(observation.identities, 0); assert.ok(observation.checks > 15);
	assert.equal(observation.privateGmp, true); assert.equal(observation.forkBeforeLock, true);
	const entry = ["--disable-gems", "-e", `require ${JSON.stringify(model.requirePath)}`];
	const binary = join(packageRoot, native, library), original = await readFile(binary);
	const changed = Buffer.from(original); changed[changed.length - 1] ^= 1;
	await saveLakeFile(packageRoot, `${native}/${library}`, changed);
	await assert.rejects(() => runCopied(command, entry, directory, environment), error => /differs from compiled evidence/u.test(error.details?.stderr));
	await saveLakeFile(packageRoot, `${native}/${library}`, original);
	const moved = join(directory, "retained-library.so");
	await rename(binary, moved); await symlink(moved, binary);
	await assert.rejects(() => runCopied(command, entry, directory, environment), error => /differs from compiled evidence/u.test(error.details?.stderr));
	await rm(binary); await rename(moved, binary);
	await assert.rejects(() => runCopied(command, entry, directory, { ...environment, RUBY_MN_THREADS: "1" }), error => /1:1 threads/u.test(error.details?.stderr));
	const preload = `require "fiddle"; Fiddle::Handle.new(${JSON.stringify(join(packageRoot, native, "libleanshared.so"))}, Fiddle::RTLD_NOW | Fiddle::RTLD_GLOBAL); require ${JSON.stringify(model.requirePath)}`;
	await assert.rejects(() => runCopied(command, ["--disable-gems", "-e", preload], directory, environment), error => /Unverified native library is already loaded/u.test(error.details?.stderr));
	const relocated = join(directory, "relocated"); await rename(packageRoot, relocated);
	assert.deepEqual(await consume({ ...environment, RUBYLIB: join(relocated, "lib") }), result);
	await saveLakeFile(resolve("build/owned-ruby-loading"), `${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({
		observation, compiledLean: true, installedPackage: false
		, compilerWorkspaceRemoved: true
		, relocated: true, rejectsTamperedLibrary: true, rejectsSymlinkLibrary: true
		, rejectsMnThreads: true, rejectsUnverifiedPreload: true
		, probeSha256: sha256(probe), evidence, contract: packaged.contract
		, generatedFiles: Object.fromEntries(Object.entries(packaged.files).map(([path, source]) => [path, sha256(source)]))
	}));
	t.diagnostic(JSON.stringify(observation));
});
