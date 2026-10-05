/**
 * Original C/C++ archive installation with relocation and repeat public calls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, rename, rm, symlink } from "node:fs/promises";
import { join, relative } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { gmpIdentity } from "../../src/backends/c/gmp.mjs";
import { boostIdentity } from "../../src/backends/cpp/boost.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { nativeCollectionConsumer } from "./native-collection-consumers.mjs";

/**
 * Compile the independent host caller, then return execution after handoff removal.
 *
 * @param root0 - Original archive and isolated installation.
 * @param root0.profile - C or C++.
 * @param root0.consumer - Task-owned consumer directory.
 * @param root0.handoff - Verified package-set handoff.
 * @param root0.packages - The selected profile's package entries.
 */
export const prepareNativeCollections = async ({ profile, consumer, handoff, packages }) => {
	const pkg = packages[0]; assert.equal(packages.length, 1); assert.equal(pkg.target, profile);
	const root = join(consumer, "install"), directory = `${pkg.name}-${pkg.version}-${profile}`, installed = join(root, directory);
	const source = await nativeCollectionConsumer(profile), extension = profile === "c" ? "c" : "cpp";
	await saveLakeFile(root, `consumer.${extension}`, source);
	const archive = join(handoff, pkg.artifacts[0].path);
	assert.equal(sha256(await readFile(archive)), pkg.artifacts[0].sha256);
	await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", archive], root);
	const receipt = JSON.parse(await readFile(join(installed, "lean-bridge-package.json")));
	await verifyNativeFiles(installed, receipt.files);
	const paths = await nativeArtifactPaths(installed);
	let dependency = null;
	if(profile === "c")
	{
		dependency = JSON.parse(await readFile(join(installed, "share/lean-bridge/gmp.json")));
		for(const [key, value] of Object.entries(gmpIdentity)) assert.equal(dependency[key], value);
		assert.equal(dependency.checked, true); await verifyNativeFiles(installed, dependency.files);
		assert.equal(sha256(await readFile(join(installed, "share/lean-bridge/sources/gmp-6.3.0.tar.xz"))), gmpIdentity.sha256);
	} else
	{
		dependency = JSON.parse(await readFile(join(installed, "share/lean-bridge/boost.json")));
		for(const [key, value] of Object.entries(boostIdentity)) assert.equal(dependency[key], value);
		assert.equal(Object.keys(dependency.files).length, 198);
		await verifyNativeFiles(installed, dependency.files);
	}
	const tools = join(root, "tools"); await mkdir(tools);
	for(const name of ["as", "ld"]) await symlink(`/usr/bin/${name}`, join(tools, name));
	const compile = { ...copiedCleanEnvironment, PATH: tools, PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", receipt.pkgConfig], root, compile)).stdout.trim().split(/\s+/);
	assert.equal(flags.filter(flag => flag.startsWith("-Wl,-rpath,")).length, 1);
	if(profile === "cpp") assert.ok(flags.includes("-DBOOST_MP_STANDALONE"));
	const relativeFlags = flags.map(flag => flag.startsWith("-Wl,-rpath,") ? `-Wl,-rpath,$ORIGIN/${directory}/lib` : flag);
	await runCopied(profile === "c" ? "/usr/bin/cc" : "/usr/bin/c++", [`-std=${profile === "c" ? "c11" : "c++20"}`
		, "-Wall", "-Wextra", "-Werror", "-UNDEBUG"
		, `consumer.${extension}`, ...relativeFlags
		, "-o", "consumer"], root, compile);
	const executableSha256 = sha256(await readFile(join(root, "consumer")));
	await rm(tools, { recursive: true, force: true }); await rm(join(root, `consumer.${extension}`));
	const relocated = join(consumer, "relocated"); await rename(root, relocated);
	return async () => {
		const runs = [];
		for(let attempt = 0; attempt < 2; ++attempt)
		{
			const result = await runCopied(join(relocated, "consumer"), [], relocated);
			assert.equal(result.stderr, "");
			const lines = result.stdout.trim().split("\n"), match = /^collection-ok:(\d+):(\d+):(\d+):(\d+)$/.exec(lines.shift());
			assert.ok(match, result.stdout);
			const [checks, calls, rejected, allocationFailures] = match.slice(1).map(Number);
			assert.ok(checks > 50000 && calls > 2400 && rejected >= 10);
			assert.ok(profile === "c" ? allocationFailures === 0 : allocationFailures > 10);
			const loadedLibraries = [];
			for(const line of lines)
			{
				assert.ok(line.startsWith("library:")); const file = line.slice(8), name = relative(join(relocated, directory), file);
				assert.ok(name.startsWith("lib/") && !name.includes(".."), file);
				assert.equal(sha256(await readFile(file)), receipt.files[name].sha256);
				loadedLibraries.push({ path: name, ...receipt.files[name] });
			}
			loadedLibraries.sort((a, b) => a.path.localeCompare(b.path));
			assert.equal(loadedLibraries.length, profile === "c" ? 6 : 4);
			await verifyNativeFiles(join(relocated, directory), receipt.files);
			assert.deepEqual(await nativeArtifactPaths(join(relocated, directory)), paths);
			assert.equal(sha256(await readFile(join(relocated, "consumer"))), executableSha256);
			runs.push({ checks, calls, rejected, allocationFailures, loadedLibraries });
		}
		assert.deepEqual(runs[0], runs[1]);
		return { runs, dependency, consumerSha256: sha256(source)
			, executableSha256, installedFiles: receipt.files
			, offlineInstall: true, compilerFreeExecution: true
			, relocatedInstallation: true, publicApiOnly: true
			, installedFilesUnchanged: true, repeatExecution: true };
	};
};
