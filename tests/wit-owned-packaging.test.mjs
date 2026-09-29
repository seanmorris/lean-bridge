/**
 * Owned WIT archives installed offline after removal of all producer inputs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { packageOwnedWasi } from "../src/release/owned-wasi.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedHostCallbackReviewedIr } from "./helpers/owned-host-callback-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { checkOwnedWitInstalledDependencies } from "./helpers/wit-owned-package-loader.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const fixtures = [
	{ name: "values", project: "owned-aggregates", review: ownedAggregateReviewedIr
		, source: "owned-installed-values", success: "owned-installed", checks: 300 }
	, { name: "callbacks", project: "owned-host-callbacks"
		, review: ownedHostCallbackReviewedIr
		, source: "owned-installed-host-callbacks"
		, success: "owned-installed-callbacks", checks: 300 }
	, { name: "scalars", project: "owned-scalars"
		, review: ownedPythonScalarsReviewedIr
		, source: "owned-installed-scalars"
		, success: "owned-installed-scalars", checks: 100 }
];

for(const fixture of fixtures) for(const mode of ["ordinary", "reviewed"])
	test(`installed owned WIT ${mode} ${fixture.name} survives source removal and relocation`, {
		skip: process.env.LEAN_BRIDGE_WIT_OWNED_PACKAGE_TEST !== "1"
		, timeout: 1_200_000
	}, async t => {
		const directory = await mkdtemp(join(tmpdir(), `lean-bridge-owned-wit-${mode}-${fixture.name}-`));
		t.after(() => rm(directory, { recursive: true, force: true }));
		const project = join(directory, "source"), output = join(directory, "producer");
		const handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
		await cp(resolve(`tests/fixtures/onboarding/${fixture.project}`), project, { recursive: true });
		const config = mode === "ordinary" ? await json(join(project, "lean-bridge.exports.json")) : { schemaVersion: 1, modules: ["Owned"] };
		const settings = { name: `owned-${fixture.name}`, version: "1.2.3" };
		config.targets = { "wit-wasi": settings };
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
		if(mode === "reviewed")
		{
			const review = fixture.review();
			if(fixture.name === "scalars") review.component = { id: "owned-scalars@1.0.0", name: "owned-scalars", version: "1.0.0" };
			await saveLakeFile(project, "api.binding-ir.json", canonicalJson(review));
		}
		const prefix = fixture.name === "scalars" ? "owned_scalars_wasmtime" : "owned_aggregates_wasmtime";
		const before = await lakeInputState(project), environment = nativeFixtureEnvironment(["wit-wasi"]);
		let built;
		try
		{
			built = await buildCanonicalProject({ projectRoot: project
				, outputRoot: output, targets: ["wit-wasi"], environment
				, onProgress: event => t.diagnostic(`${mode} ${fixture.name}: ${event.message}`) });
		} catch(error)
		{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
		assert.deepEqual(await lakeInputState(project), before);
		assert.equal(built.backend, "ordinary-wit-native-owned-graph-v1");
		const witRoot = join(output, "native/owned-wit-adapter"), nativeRoot = join(output, "native/component"), runtimeRoot = join(output, "native/runtime");
		const options = { witRoot, nativeRoot, runtimeRoot, settings
			, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
			, glibcMinimumVersion: built.glibcMinimumVersion };
		const reassembled = join(directory, "reassembled");
		const rebuilt = await packageOwnedWasi({ ...options, working: reassembled });
		assert.deepEqual(rebuilt.packages, built.packages);
		assert.deepEqual(await readFile(join(reassembled, "archives", rebuilt.packages[0].archive)), await readFile(join(output, "archives", built.packages[0].archive)));
		await rm(reassembled, { recursive: true, force: true });
		const compiled = await json(join(witRoot, "native-wit-adapter.json"));
		assert.equal(compiled.dependencies.length, 5);
		assert.ok(compiled.dependencies.some(item => item.name === "libgmp.so.10"));
		if(fixture.name === "values")
		{
			const path = "include/owned_aggregates_wasmtime.h", header = await readFile(join(witRoot, path));
			const changed = Buffer.concat([header, Buffer.from("\n/* Modified after compilation. */\n")]);
			await saveLakeFile(witRoot, path, changed);
			const forged = structuredClone(compiled); forged.files[path] = { bytes: changed.length, sha256: sha256(changed) };
			forged.ownedValues.headerSha256 = sha256(changed);
			await saveLakeFile(witRoot, "native-wit-adapter.json", canonicalJson(forged));
			await assert.rejects(packageOwnedWasi({ ...options, working: join(directory, "forged") }), /compiler-authenticated/u);
			await saveLakeFile(witRoot, path, header);
			await saveLakeFile(witRoot, "native-wit-adapter.json", canonicalJson(compiled));
			await saveLakeFile(witRoot, "unexpected.txt", "unrecorded");
			await assert.rejects(packageOwnedWasi({ ...options, working: join(directory, "unrecorded") }), /unrecorded/u);
			await rm(join(witRoot, "unexpected.txt"));
		}
		const receipt = await copyPackageSetHandoff(output, handoff);
		await rm(project, { recursive: true, force: true }); await rm(output, { recursive: true, force: true });
		await assert.rejects(access(project), { code: "ENOENT" }); await assert.rejects(access(output), { code: "ENOENT" });
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const observed = await installCopiedConsumer({ profile: "wit-wasi"
			, consumer, handoff, packages: receipt.packages, environment
			, fixture: { source: async () => (await readFile(`tests/fixtures/structured-types/${fixture.source}.c`, "utf8"))
				.replaceAll("owned_aggregates", prefix).replaceAll("OWNED_AGGREGATES", prefix.toUpperCase())
				, success: fixture.success
				, wit: [/resource identity-ticket/u, /borrow<identity-ticket>/u
					, /new-ticket: func\([^;]+ -> identity-ticket;/u] } });
		assert.ok(observed.checks >= fixture.checks);
		const consumerRoot = join(consumer, "wit-wasi"), installed = join(consumerRoot, `${settings.name}-${settings.version}-wit-wasi`);
		const manifest = await json(join(installed, "lean-bridge-package.json"));
		assert.equal(manifest.kind, "lean-bridge-owned-wit-package");
		assert.doesNotMatch(await readFile(join(installed, "README.md"), "utf8"), /: undefined\n/u);
		for(const path of [`include/${prefix}.h`, "include/gmp.h"
			, "lib/libgmp.so.10", "lib/libwasmtime.so"
			, "share/lean-bridge/sources/gmp-6.3.0.tar.xz"
			, "share/lean-bridge/licenses/GMP-COPYING.LESSERv3"
			, "share/lean-bridge/licenses/Wasmtime-LICENSE"
			, "share/lean-bridge/component/binding-ir.json"])
			assert.ok(manifest.files[path], path);
		await verifyNativeFiles(installed, manifest.files);
		await rm(handoff, { recursive: true, force: true }); await assert.rejects(access(handoff), { code: "ENOENT" });
		const relocated = join(directory, "relocated-package"); await rename(installed, relocated);
		await saveLakeFile(consumerRoot, "CMakeLists.txt", `cmake_minimum_required(VERSION 3.20)
project(OwnedWitConsumer C)
find_package(${manifest.cmakePackage} 1.2.3 EXACT CONFIG REQUIRED)
add_executable(consumer consumer.c)
target_link_libraries(consumer PRIVATE ${manifest.cmakeTarget})
target_compile_options(consumer PRIVATE -Wall -Wextra -Werror -UNDEBUG)
`);
		const compileEnv = { ...copiedCleanEnvironment, PATH: join(consumerRoot, "tools") };
		await runCopied("/usr/bin/cmake", ["-S", consumerRoot, "-B", "cmake-build"
			, "-G", "Unix Makefiles", "-DCMAKE_C_COMPILER=/usr/bin/cc"
			, "-DCMAKE_MAKE_PROGRAM=/usr/bin/make"
			, `-DCMAKE_PREFIX_PATH=${relocated}`], consumerRoot, compileEnv);
		await runCopied("/usr/bin/cmake", ["--build", "cmake-build"], consumerRoot, compileEnv);
		const cmake = await runCopied(join(consumerRoot, "cmake-build/consumer"), [], consumerRoot);
		assert.equal(cmake.stderr, ""); assert.equal(cmake.stdout, `${fixture.success}:${observed.checks}\n`);
		const loader = fixture.name === "values"
			? await checkOwnedWitInstalledDependencies({ root: consumerRoot, installed: relocated, environment: compileEnv, manifest }) : null;
		let documentation = null;
		if(fixture.name === "values")
		{
			const page = await readFile("docs/consume/wit-wasi.md", "utf8");
			const source = page.split("### Packages containing resources\n")[1]?.split("```c\n")[1]?.split("```")[0];
			assert.ok(source, "Missing executable owned WIT consumer example");
			await saveLakeFile(consumerRoot, "documented.c", source);
			const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", manifest.pkgConfig], consumerRoot
				, { ...compileEnv, PKG_CONFIG_LIBDIR: join(relocated, "lib/pkgconfig"), PKG_CONFIG_PATH: "" })).stdout.trim().split(/\s+/u);
			await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "documented.c", ...flags, "-o", "documented"], consumerRoot, compileEnv);
			const example = await runCopied(join(consumerRoot, "documented"), [], consumerRoot);
			assert.equal(example.stderr, ""); assert.equal(example.stdout, "42\n");
			documentation = { sourceSha256: sha256(source), stdout: example.stdout };
		}
		await saveLakeFile(resolve("build/owned-wit-packaging"), `${mode}-${fixture.name}.json`, canonicalJson({ schemaVersion: 1
			, mode, fixture: fixture.name, checks: observed.checks
			, bindingIrSha256: built.bindingIrSha256
			, runtimeIdentity: built.nativeRuntimeIdentity
			, packages: built.packages, dependencies: compiled.dependencies
			, sourceRemoved: true, producerRemoved: true, handoffRemoved: true
			, relocated: true, deterministicReassembly: true
			, pkgConfig: true, cmake: true, network: false, loader, documentation }));
		t.diagnostic(`${mode} ${fixture.name}: ${observed.checks} independent installed checks; pkg-config and relocated CMake consumers passed`);
	});
