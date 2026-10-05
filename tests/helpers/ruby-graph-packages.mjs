/**
 * Original recursive gems, source-free consumers, shared loading and retirement.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, rename, rm, symlink } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { packageOrdinaryRuby } from "../../src/release/native-rubygems.mjs";
import { ordinaryRubyEvidence } from "../../src/build/native-ruby-artifacts.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { compileCopiedRubyGraphPackageModel } from "../../src/backends/ruby/copied-graph-package.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { nativeRecursiveSource } from "./native-recursive-transport.mjs";
import { saveLakeFile, lakeInputState } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const digest = async path => sha256(await readFile(path));

const build = async ({ author, handoff, environment, reviewed, name = "recursive", diagnostic }) => {
	const projectRoot = join(author, "project"), outputRoot = join(author, "release");
	const primary = name === "recursive", names = name === "graph_names";
	const module = primary ? "Recursive" : names ? "Names" : "Peer";
	const ir = primary ? nativeRecursiveReviewedIr() : null;
	const source = primary ? await nativeRecursiveSource() : names ? `namespace Names
inductive GraphScope where
  | leaf (value : UInt32)
  | next (value : GraphScope)
structure GraphInvalidNative where
  payload : GraphScope
def echo (value : GraphInvalidNative) : GraphInvalidNative := value
def next (value : GraphScope) : GraphScope := value
end Names
` : "namespace Peer\ndef answer : UInt32 := 42\nend Peer\n";
	await saveLakeFile(projectRoot, `${module}.lean`, source);
	await saveLakeFile(projectRoot, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(projectRoot, "lakefile.toml", `name = "${name}"\nversion = "1.0.0"\n[[lean_lib]]\nname = "${module}"\n`);
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({
		schemaVersion: 1, modules: [module]
		, ...primary && reviewed ? {} : { exports: primary ? ir.declarations.map(item => item.source.declaration) : names ? ["Names.echo", "Names.next"] : ["Peer.answer"] }
		, targets: { rubygems: { name: `${name.replaceAll("_", "-")}-api`, version: "1.0.0" } } }));
	if(primary && reviewed) await saveLakeFile(projectRoot, "recursive.binding-ir.json", canonicalJson(ir));
	const before = await lakeInputState(projectRoot);
	diagnostic(`${reviewed ? "reviewed" : "ordinary"}: building ${name} Ruby-only release`);
	const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["rubygems"], environment })
		.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
	assert.deepEqual(await lakeInputState(projectRoot), before);
	const packages = await copyPackageSetHandoff(outputRoot, handoff);
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	assert.equal(packages.packages.length, 1); assert.equal(packages.packages[0].target, "rubygems");
	const nativeRoot = join(outputRoot, "native/component"), runtimeRoot = join(outputRoot, "native/runtime");
	const adapterRoot = join(outputRoot, "native/c-binding"), model = await json(join(nativeRoot, "model.json"));
	const component = await json(join(nativeRoot, "native-component.json")), adapter = await json(join(adapterRoot, "native-c-adapter.json"));
	if(!primary) return { handoff, package: packages.packages[0], module: name, sourceSha256: sha256(source) };
	assert.equal(model.schemaVersion, reviewed ? 5 : 4); assert.equal(model.exports.length, 18);
	assert.equal(adapter.gmp, undefined); assert.equal(adapter.files["include/recursive.h"], undefined);
	assert.ok(Object.keys(adapter.files).every(path => !/gmp|boost/.test(path)));
	assert.ok(adapter.files["src/ruby-graph-clear.c"]);
	const options = { working: join(author, "repackaged")
		, nativeRoot
		, runtimeRoot
		, adapterRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX, environment
		, settings: { name: "recursive-api", version: "1.0.0" }
		, glibcMinimumVersion: environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38" };
	assert.deepEqual((await packageOrdinaryRuby(options)).packages, built.packages);
	await rm(options.working, { recursive: true, force: true });
	for(const copiedGraph of [undefined, { schemaVersion: 1, layoutSha256: "0".repeat(64) }, { ...adapter.copiedGraph, extra: true }])
	{
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson({ ...adapter, copiedGraph }));
		await assert.rejects(() => ordinaryRubyEvidence({ nativeRoot, runtimeRoot, adapterRoot }), /Ruby C adapter differs/);
	}
	await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
	for(const path of ["src/native.c", "include/detail/recursive-graph.h", "include/detail/recursive-graph-types.h", "src/ruby-graph-clear.c"])
	{
		const original = await readFile(join(adapterRoot, path), "utf8"), changed = `${original}\n/* re-signed source drift */\n`;
		await saveLakeFile(adapterRoot, path, changed);
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson({ ...adapter, files: { ...adapter.files
			, [path]: { bytes: Buffer.byteLength(changed), sha256: sha256(changed) } } }));
		await assert.rejects(() => packageOrdinaryRuby(options), /Generated Ruby graph adapter source differs/);
		await saveLakeFile(adapterRoot, path, original);
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
	}
	const generated = compileCopiedRubyGraphPackageModel(model.bindingIr);
	return { handoff, package: packages.packages[0], module: name
		, indices: Object.fromEntries(generated.functions.map((fn, index) => [fn.publicName, index]))
		, exports: 18
		, bindingIrSha256: built.bindingIrSha256
		, binarySha256: component.nativeLibrary.sha256
		, layoutSha256: adapter.copiedGraph.layoutSha256
		, modelSha256: sha256(canonicalJson(model))
		, adapterSha256: sha256(canonicalJson(adapter))
		, deterministicReassembly: true
		, checkedSourceUnchanged: true
		, rubyOnly: true
		, rejectsGraphReceiptDrift: 3
		, rejectsRegeneratedSourceDrift: 4 };
};

const install = async ({ consumer, releases, environment, diagnostic }) => {
	await mkdir(consumer);
	const original = join(consumer, "gems"), relocated = join(consumer, "relocated-gems");
	const command = environment.LEAN_BRIDGE_RUBY, packages = [];
	let env = { ...copiedCleanEnvironment, GEM_HOME: original, GEM_PATH: original };
	for(const release of releases)
	{
		const pkg = release.package, archive = join(release.handoff, pkg.artifacts[0].path);
		assert.equal(await digest(archive), pkg.artifacts[0].sha256);
		await runCopied(command, [environment.LEAN_BRIDGE_GEM, "install", "--norc", archive, "--local", "--install-dir", original, "--no-document"], consumer, env);
		const installed = (await runCopied(command, ["-e", `print Gem::Specification.find_by_name(${JSON.stringify(pkg.name)}, "1.0.0").full_gem_path`], consumer, env)).stdout;
		assert.ok(installed.startsWith(`${original}/gems/`));
		const bytes = await readFile(join(installed, "lean-bridge/package-receipt.json")), receipt = JSON.parse(bytes);
		await verifyNativeFiles(installed, receipt.files);
		packages.push({ module: release.module
			, installed: join(relocated, relative(original, installed))
			, receipt
			, receiptSha256: sha256(bytes)
			, paths: await nativeArtifactPaths(installed) });
	}
	const sources = {};
	for(const [name, fixture] of [["public", "installed"], ["composition", "composition"], ["faults", "installed-faults"]])
	{
		sources[`${name}.rb`] = await readFile(`tests/fixtures/structured-types/recursive-ruby-${fixture}.rb`, "utf8");
		await saveLakeFile(consumer, `${name}.rb`, sources[`${name}.rb`]);
	}
	const guide = (await readFile("docs/consume/ruby.md", "utf8")).split("### Recursive values\n")[1].split("\n### ")[0];
	sources["documentation.rb"] = guide.match(/```ruby\n([^]*?)\n```/)[1] + "\n";
	await saveLakeFile(consumer, "documentation.rb", sources["documentation.rb"]);
	await rename(original, relocated); await rm(join(relocated, "cache"), { recursive: true, force: true });
	for(const release of releases) await rm(release.handoff, { recursive: true, force: true });
	env = { ...copiedCleanEnvironment, GEM_HOME: relocated, GEM_PATH: relocated };
	const execute = async (file, args = []) => {
		const result = await runCopied(command, [file, ...args], consumer, env);
		assert.equal(result.stderr, ""); return JSON.parse(result.stdout);
	};
	diagnostic("Original installed gems: public values, threads, shared loading, held-lock fork and retirement");
	const first = await execute("public.rb");
	assert.ok(first.checks > 150); assert.ok(first.rejected > 60); assert.equal(first.threadedCalls, 256);
	const documented = await runCopied(command, ["documentation.rb"], consumer, env);
	assert.equal(documented.stderr, ""); assert.equal(documented.stdout, "7\n");
	const faultRun = await runCopied(command, ["faults.rb", JSON.stringify(releases[0].indices)], consumer, env);
	assert.equal(faultRun.stderr, "");
	const [publicAgain, faults] = faultRun.stdout.trim().split("\n").map(line => JSON.parse(line));
	assert.deepEqual(publicAgain, first); assert.ok(faults.checkpoints > 100);
	assert.equal(faults.exactlyOnceCleanup, true); assert.equal(faults.asynchronousInterruptions, 2);
	const composition = [];
	for(const order of ["recursive-first", "acyclic-first"]) for(const mode of ["raw", "during"])
		composition.push(await execute("composition.rb", [order, mode, JSON.stringify(releases[0].indices)]));
	const [primary] = packages, library = join(primary.installed, "lib/lean_bridge/recursive/native/linux-x64/librecursive.so");
	const originalBytes = await readFile(library), corrupt = Buffer.from(originalBytes); corrupt[corrupt.length - 1] ^= 1;
	await saveLakeFile(primary.installed, relative(primary.installed, library), corrupt);
	const importArgs = ["-e", 'require "lean_bridge/recursive"'];
	await assert.rejects(() => runCopied(command, importArgs, consumer, env), error => /differs from compiled evidence/.test(error.details?.stderr));
	await saveLakeFile(primary.installed, relative(primary.installed, library), originalBytes);
	await rename(library, join(consumer, "retained-library.so")); await symlink(join(consumer, "retained-library.so"), library);
	await assert.rejects(() => runCopied(command, importArgs, consumer, env), error => /differs from compiled evidence/.test(error.details?.stderr));
	await rm(library); await rename(join(consumer, "retained-library.so"), library);
	await assert.rejects(() => runCopied(command, importArgs, consumer, { ...env, RUBY_MN_THREADS: "1" }), error => /require Ruby 1:1 threads/.test(error.details?.stderr));
	for(const pkg of packages) await rename(join(pkg.installed, "lean-bridge"), join(consumer, `${pkg.module}-metadata`));
	assert.deepEqual(await execute("public.rb"), first);
	assert.deepEqual(await runCopied(command, ["documentation.rb"], consumer, env), documented);
	for(const pkg of packages) await rename(join(consumer, `${pkg.module}-metadata`), join(pkg.installed, "lean-bridge"));
	for(const pkg of packages)
	{
		await verifyNativeFiles(pkg.installed, pkg.receipt.files);
		assert.equal(await digest(join(pkg.installed, "lean-bridge/package-receipt.json")), pkg.receiptSha256);
		assert.deepEqual(await nativeArtifactPaths(pkg.installed), pkg.paths);
	}
	return { public: first, composition, faults
		, documentation: { sourceSha256: sha256(sources["documentation.rb"]), stdout: documented.stdout }
		, installedPackages: packages.map(pkg => ({ module: pkg.module, receiptSha256: pkg.receiptSha256, files: pkg.receipt.files }))
		, sourceHashes: Object.fromEntries(Object.entries(sources).map(([file, source]) => [file, sha256(source)]))
		, offlineInstall: true
		, compilerFreeExecution: true
		, relocatedInstallation: true
		, authorSourcesRemoved: true
		, handoffRemoved: true, gemCacheRemoved: true, buildMetadataNotRequired: true
		, rejectsTamperedAssets: true
		, rejectsSymlinkAssets: true
		, rejectsManyToManyThreads: true
		, installedFilesUnchanged: true };
};

/**
 * Exercise ordinary and independently reviewed contracts from original gems.
 *
 * @param directory - Owned temporary workspace.
 * @param diagnostic - Progress callback for the test log.
 */
export const checkInstalledRubyGraphs = async (directory, diagnostic) => {
	const environment = { ...nativeFixtureEnvironment(["ruby"])
		, LEAN_BRIDGE_RUBY: resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby")
		, LEAN_BRIDGE_GEM: resolve(process.env.LEAN_BRIDGE_GEM ?? ".toolchains/ruby33/bin/gem") };
	const observations = [];
	for(const reviewed of [false, true])
	{
		const root = join(directory, reviewed ? "reviewed" : "ordinary"), author = join(root, "author");
		const releases = [];
		for(const name of ["recursive", "recursive_peer", "graph_names"])
			releases.push(await build({ author: join(author, name), handoff: join(root, `${name}-handoff`), environment, reviewed, name, diagnostic }));
		assert.ok(releases.every(release => release.package.runtimeIdentity === releases[0].package.runtimeIdentity));
		await rm(author, { recursive: true, force: true });
		const installed = await install({ consumer: join(root, "consumer"), releases, environment, diagnostic });
		const { handoff, indices, ...primary } = releases[0]; void handoff; void indices;
		observations.push({ reviewed, ...primary, peers: releases.slice(1).map(({ handoff, ...peer }) => { void handoff; return peer; }), installed });
		await rm(root, { recursive: true, force: true });
	}
	return { schemaVersion: 1, installedPackage: true, observations };
};
