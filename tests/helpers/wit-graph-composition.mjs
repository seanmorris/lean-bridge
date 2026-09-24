/**
 * Execute independently installed recursive and acyclic WIT packages together.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, readdir, rm, statfs, symlink } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { nativeRecursiveSource } from "./native-recursive-transport.mjs";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";
import { saveLakeFile, lakeInputState } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const prepare = async ({ root, environment, reviewed, recursive, diagnostic }) => {
	const name = recursive ? "recursive" : "peer", module = recursive ? "Recursive" : "Peer";
	const author = join(root, `${name}-author`), projectRoot = join(author, "project"), outputRoot = join(author, "release");
	const handoff = join(root, `${name}-handoff`), install = join(root, "consumer", name);
	const ir = recursive ? nativeRecursiveReviewedIr() : corpusReviewedIr({ id: "peer" }, [{ name: "Peer.answer", parameters: [], result: "uint32" }]);
	const source = recursive ? await nativeRecursiveSource() : "namespace Peer\ndef answer : UInt32 := 42\nend Peer\n";
	await saveLakeFile(projectRoot, `${module}.lean`, source);
	await saveLakeFile(projectRoot, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(projectRoot, "lakefile.toml", `name = "${name}"\nversion = "1.0.0"\n[[lean_lib]]\nname = "${module}"\n`);
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({
		schemaVersion: 1, modules: [module]
		, ...reviewed ? {} : { exports: ir.declarations.map(item => item.source.declaration) }
		, targets: { "wit-wasi": { name, version: "1.0.0" } } }));
	if(reviewed) await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(ir));
	const before = await lakeInputState(projectRoot);
	diagnostic(`${reviewed ? "reviewed" : "ordinary"}: building ${name} for cross-package acceptance`);
	await buildCanonicalProject({ projectRoot, outputRoot, targets: ["wit-wasi"], environment })
		.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
	assert.deepEqual(await lakeInputState(projectRoot), before);
	const handoffReceipt = await copyPackageSetHandoff(outputRoot, handoff);
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	assert.equal(handoffReceipt.packages.length, 1);
	const pkg = handoffReceipt.packages[0]; assert.equal(pkg.target, "wit-wasi");
	const archive = join(handoff, pkg.artifacts[0].path);
	assert.equal(sha256(await readFile(archive)), pkg.artifacts[0].sha256);
	await mkdir(install, { recursive: true });
	await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", archive, "-C", install], root);
	const directory = join(install, `${name}-1.0.0-wit-wasi`), receipt = await json(join(directory, "lean-bridge-package.json"));
	await verifyNativeFiles(directory, receipt.files);
	await rm(author, { recursive: true, force: true }); await rm(handoff, { recursive: true, force: true });
	return { directory, pkg, receipt, sourceSha256: sha256(source), sourceUnchanged: true };
};

/**
 * Build both source paths, remove producers and execute relocated consumers.
 *
 * @param directory - Test-owned temporary workspace.
 * @param diagnostic - Progress callback.
 */
export const checkWitGraphComposition = async (directory, diagnostic = () => {}) => {
	const environment = nativeFixtureEnvironment(["wit-wasi"]), observations = [];
	for(const reviewed of [false, true])
	{
		const space = await statfs(directory); assert.ok(Number(space.bavail) * Number(space.bsize) >= 2 * 1024 ** 3);
		const root = join(directory, reviewed ? "reviewed" : "ordinary");
		const graph = await prepare({ root, environment, reviewed, recursive: true, diagnostic });
		const peer = await prepare({ root, environment, reviewed, recursive: false, diagnostic });
		assert.equal(graph.pkg.runtimeIdentity, peer.pkg.runtimeIdentity);
		const consumer = join(root, "consumer"), tools = join(consumer, "tools"), relocated = join(root, "relocated");
		await mkdir(tools); await mkdir(relocated);
		for(const tool of ["as", "ld"]) await symlink(`/usr/bin/${tool}`, join(tools, tool));
		const compile = { ...copiedCleanEnvironment, PATH: tools };
		const source = await readFile("tests/fixtures/recursive-consumers/wit-composition.c");
		await saveLakeFile(consumer, "composition.c", source);
		await runCopied("/usr/bin/cc", [
			"-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG"
			, "-I", join(graph.directory, "include")
			, "-I", join(peer.directory, "include")
			, "composition.c", "-ldl", "-o", join(relocated, "composition")
		], consumer, compile);
		const guide = await readFile("docs/consume/wit-wasi.md", "utf8");
		const documentation = guide.match(/```c file=wit-wasi\/recursive\.c\n([^]*?)\n```/)[1] + "\n";
		await saveLakeFile(consumer, "documentation.c", documentation);
		const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", "recursive-wit"], consumer, {
			...compile, PKG_CONFIG_LIBDIR: join(graph.directory, "lib/pkgconfig")
			, PKG_CONFIG_PATH: ""
		})).stdout.trim().split(/\s+/);
		assert.equal(flags.length, 5);
		await runCopied("/usr/bin/cc", [
			"-std=c11", "-Wall", "-Wextra", "-Werror", "documentation.c"
			, ...flags.filter(flag => !flag.startsWith("-Wl,-rpath"))
			, "-Wl,-rpath,$ORIGIN/recursive/lib"
			, "-o", join(relocated, "documentation")
		], consumer, compile);
		const faultSource = await readFile("tests/fixtures/recursive-consumers/wit-result-fault.c");
		await saveLakeFile(consumer, "fault.c", faultSource);
		await runCopied("/usr/bin/cc", [
			"-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG"
			, "-fPIC", "-shared", "-DINJECT_RESULT"
			, "-I", join(graph.directory, "include"), "fault.c"
			, "-o", join(relocated, "fault.so")
		], consumer, compile);
		const packages = [];
		for(const [name, pkg] of [["recursive", graph], ["peer", peer]])
		{
			await mkdir(join(relocated, name));
			const libraries = Object.fromEntries(Object.entries(pkg.receipt.files).filter(([path]) => /^lib\/[^/]+\.so(?:\.\d+)*$/.test(path)));
			await mkdir(join(relocated, name, "lib"));
			for(const path of Object.keys(libraries)) await copyFile(join(pkg.directory, path), join(relocated, name, path));
			packages.push({ name, pkg: pkg.pkg, receipt: pkg.receipt, libraries, sourceSha256: pkg.sourceSha256 });
		}
		await rm(consumer, { recursive: true, force: true });
		assert.deepEqual(await readdir(root), ["relocated"]);
		const documented = await runCopied(join(relocated, "documentation"), [], relocated);
		assert.equal(documented.stderr, "");
		assert.equal(documented.stdout, "next(leaf(71))\n");
		const scenarios = [];
		for(const visibility of ["local", "global"]) for(const order of ["recursive-first", "peer-first"]) for(const mode of ["normal", "limit", "malformed", "unopened-peer-fork"])
		{
			const args = [mode, order, visibility, join(relocated, "recursive/lib/librecursive_wasmtime.so"), join(relocated, "peer/lib/libpeer_wasmtime.so")];
			const result = await runCopied(join(relocated, "composition"), args, relocated, ["limit", "malformed"].includes(mode)
				? { ...copiedCleanEnvironment, LD_PRELOAD: join(relocated, "fault.so"), WIT_GRAPH_FAULT: mode } : copiedCleanEnvironment);
			assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
			scenarios.push({ visibility, order, mode, observation }); diagnostic(JSON.stringify(scenarios.at(-1)));
		}
		for(const pkg of packages) await verifyNativeFiles(join(relocated, pkg.name), pkg.libraries);
		observations.push({
			reviewed, packages, scenarios, consumerSha256: sha256(source)
			, faultSourceSha256: sha256(faultSource)
			, faultLibrarySha256: sha256(await readFile(join(relocated, "fault.so")))
			, executableSha256: sha256(await readFile(join(relocated, "composition")))
			, documentation: {
				sourceSha256: sha256(documentation), stdout: documented.stdout
				, executableSha256: sha256(await readFile(join(relocated, "documentation")))
			}
			, sourceFree: true, relocated: true
		});
		await saveLakeFile("build/recursive-wit", "composition-progress.json", canonicalJson({ schemaVersion: 1, observations }));
		await rm(root, { recursive: true, force: true });
	}
	return { schemaVersion: 1, observations };
};
