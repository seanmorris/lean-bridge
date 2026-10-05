/**
 * Compile separate public C and WIT translation units from one prepared release.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, readdir, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { saveLakeFile, lakeInputState } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";

/**
 * Execute both source paths without producers, headers or compiler access.
 *
 * @param directory - Test-owned temporary workspace.
 * @param diagnostic - Progress callback.
 */
export const checkWitMixedPackages = async (directory, diagnostic = () => {}) => {
	const environment = nativeFixtureEnvironment(["c", "wit-wasi"]), observations = [];
	for(const reviewed of [false, true])
	{
		const root = join(directory, reviewed ? "reviewed" : "ordinary"), author = join(root, "author");
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(root, "handoff");
		const consumer = join(root, "consumer"), relocated = join(root, "relocated"), tools = join(consumer, "tools");
		const ir = nativeRecursiveReviewedIr();
		ir.types = ir.types.filter(item => item.name === "Spine");
		ir.declarations = ir.declarations.filter(item => item.name === "grow");
		const source = "namespace Recursive\ninductive Spine where\n  | next (value : Spine)\n  | leaf (value : UInt32)\ndef grow (value : Spine) : Spine := .next value\nend Recursive\n";
		await saveLakeFile(projectRoot, "Recursive.lean", source);
		await saveLakeFile(projectRoot, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
		await saveLakeFile(projectRoot, "lakefile.toml", 'name = "recursive"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Recursive"\n');
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({
			schemaVersion: 1, modules: ["Recursive"]
			, ...reviewed ? {} : { exports: ["Recursive.grow"] }
			, targets: { "wit-wasi": { name: "recursive", version: "1.0.0" } }
		}));
		if(reviewed) await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(ir));
		const before = await lakeInputState(projectRoot);
		diagnostic(`${reviewed ? "reviewed" : "ordinary"}: building one C/WIT release`);
		await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c", "wit-wasi"], environment })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		assert.deepEqual(await lakeInputState(projectRoot), before);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		assert.deepEqual(receipt.packages.map(item => item.target).sort(), ["c", "wit-wasi"]);
		await rm(author, { recursive: true, force: true });
		await mkdir(tools, { recursive: true }); await mkdir(join(relocated, "lib"), { recursive: true });
		for(const name of ["as", "ld"]) await symlink(`/usr/bin/${name}`, join(tools, name));
		const compile = { ...copiedCleanEnvironment, PATH: tools }, packages = [], sources = {};
		const libraries = {}, linkFlags = [];
		for(const pkg of receipt.packages)
		{
			const archive = join(handoff, pkg.artifacts[0].path);
			assert.equal(sha256(await readFile(archive)), pkg.artifacts[0].sha256);
			await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", archive, "-C", consumer], root);
			const installed = join(consumer, `${pkg.name}-${pkg.version}-${pkg.target}`);
			const manifest = JSON.parse(await readFile(join(installed, "lean-bridge-package.json")));
			await verifyNativeFiles(installed, manifest.files);
			const name = pkg.target === "c" ? "native" : "host";
			const fixture = await readFile(`tests/fixtures/recursive-consumers/wit-mixed-${name}.c`);
			sources[name] = sha256(fixture); await saveLakeFile(consumer, `${name}.c`, fixture);
			const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", pkg.target === "c" ? manifest.pkgConfig : "recursive-wit"], consumer, {
				...compile, PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig")
				, PKG_CONFIG_PATH: ""
			})).stdout.trim().split(/\s+/);
			await runCopied("/usr/bin/cc", [
				"-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG"
				, ...flags.filter(flag => flag.startsWith("-I"))
				, "-c", `${name}.c`, "-o", `${name}.o`
			], consumer, compile);
			linkFlags.push(...flags.filter(flag => flag.startsWith("-L") || flag.startsWith("-l")));
			for(const [path, identity] of Object.entries(manifest.files).filter(([path]) => /^lib\/[^/]+\.so(?:\.\d+)*$/.test(path)))
			{
				if(libraries[path]) assert.deepEqual(identity, libraries[path], path);
				else
				{
					libraries[path] = identity; await copyFile(join(installed, path), join(relocated, path));
				}
			}
			packages.push({ package: pkg, manifest });
		}
		assert.equal(packages[0].manifest.runtimeIdentity, packages[1].manifest.runtimeIdentity);
		assert.equal(packages[0].manifest.bindingIrSha256, packages[1].manifest.bindingIrSha256);
		await runCopied("/usr/bin/cc", [
			"native.o", "host.o", ...linkFlags, "-ldl", "-Wl,-rpath,$ORIGIN/lib"
			, "-o", join(relocated, "consumer")
		], consumer, compile);
		await rm(consumer, { recursive: true, force: true }); await rm(handoff, { recursive: true, force: true });
		assert.deepEqual(await readdir(root), ["relocated"]);
		const scenarios = [];
		for(const order of ["native-first", "wit-first"])
		{
			const result = await runCopied(join(relocated, "consumer"), [order], relocated);
			assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
			assert.deepEqual(observation, { mixedPublicApis: true, sharedRetirement: true, ownedCleanup: true });
			scenarios.push({ order, observation });
		}
		await verifyNativeFiles(relocated, libraries);
		observations.push({
			reviewed, sourceSha256: sha256(source), sources, packages, libraries
			, scenarios, sourceFree: true, relocated: true
			, executableSha256: sha256(await readFile(join(relocated, "consumer")))
		});
		await rm(root, { recursive: true, force: true });
	}
	return { schemaVersion: 1, observations };
};
