/**
 * Original recursive Python wheels, offline consumers, relocation and failures.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, rename, rm, symlink } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { packageOrdinaryPython } from "../../src/release/native-pypi.mjs";
import { ordinaryPythonEvidence } from "../../src/build/native-python-artifacts.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { generateCopiedPythonGraphConversions } from "../../src/backends/python/copied-graph-conversions.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { nativeRecursiveSource } from "./native-recursive-transport.mjs";
import { saveLakeFile, lakeInputState } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { installPythonWheel } from "./python-wheel-install.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const digest = async path => sha256(await readFile(path));
const fixtures = "tests/fixtures/structured-types";

const prepare = async ({ author, handoff, environment, reviewed, diagnostic }) => {
	const projectRoot = join(author, "project"), outputRoot = join(author, "release");
	const ir = nativeRecursiveReviewedIr();
	await saveLakeFile(projectRoot, "Recursive.lean", await nativeRecursiveSource());
	await saveLakeFile(projectRoot, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(projectRoot, "lakefile.toml", 'name = "recursive"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Recursive"\n');
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({
		schemaVersion: 1, modules: ["Recursive"]
		, ...reviewed ? {} : { exports: ir.declarations.map(item => item.source.declaration) }
		, targets: { pypi: { name: "recursive-api", version: "1.0.0" } } }));
	if(reviewed) await saveLakeFile(projectRoot, "recursive.binding-ir.json", canonicalJson(ir));
	const before = await lakeInputState(projectRoot);
	diagnostic(`${reviewed ? "reviewed" : "ordinary"}: building Python-only recursive release`);
	const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["pypi"], environment })
		.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
	assert.deepEqual(await lakeInputState(projectRoot), before);
	const receipt = await copyPackageSetHandoff(outputRoot, handoff);
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	assert.equal(receipt.packages.length, 1); assert.equal(receipt.packages[0].target, "pypi");
	const nativeRoot = join(outputRoot, "native/component"), runtimeRoot = join(outputRoot, "native/runtime");
	const adapterRoot = join(outputRoot, "native/c-binding");
	const model = await json(join(nativeRoot, "model.json")), component = await json(join(nativeRoot, "native-component.json"));
	const adapter = await json(join(adapterRoot, "native-c-adapter.json"));
	assert.equal(model.schemaVersion, reviewed ? 5 : 4); assert.equal(model.exports.length, 18);
	assert.equal(adapter.gmp, undefined);
	assert.ok(Object.keys(adapter.files).every(path => !/gmp|boost/.test(path)));
	assert.equal(adapter.files["include/recursive.h"], undefined);
	const releaseOptions = { working: join(author, "repackaged")
		, nativeRoot, runtimeRoot, adapterRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX, environment
		, settings: { name: "recursive-api", version: "1.0.0" }
		, glibcMinimumVersion: environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38" };
	const repeated = await packageOrdinaryPython(releaseOptions);
	assert.deepEqual(repeated.packages, built.packages);
	await rm(releaseOptions.working, { recursive: true, force: true });
	for(const copiedGraph of [undefined, { schemaVersion: 1, layoutSha256: "0".repeat(64) }, { ...adapter.copiedGraph, extra: true }])
	{
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson({ ...adapter, copiedGraph }));
		await assert.rejects(() => ordinaryPythonEvidence({ nativeRoot, runtimeRoot, adapterRoot }), /Python C adapter differs/);
	}
	await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
	for(const path of ["src/native.c", "include/detail/recursive-graph.h", "include/detail/recursive-graph-types.h"])
	{
		const original = await readFile(join(adapterRoot, path), "utf8"), changed = `${original}\n/* re-signed source drift */\n`;
		await saveLakeFile(adapterRoot, path, changed);
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson({ ...adapter, files: { ...adapter.files
			, [path]: { bytes: Buffer.byteLength(changed), sha256: sha256(changed) } } }));
		await assert.rejects(() => packageOrdinaryPython(releaseOptions), /Generated Python graph adapter source differs/);
		await saveLakeFile(adapterRoot, path, original);
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
	}
	const generated = generateCopiedPythonGraphConversions(model.bindingIr), raw = new Map(generated.rawTypes.map(type => [type.id, type.name]));
	const layout = Object.fromEntries(generated.layout.roots.map((root, index) => [root.name.slice("recursive_".length), { index, raw: raw.get(root.result) }]));
	return { pkg: receipt.packages[0], layout
		, provenance: {
			exports: model.exports.length, bindingIrSha256: built.bindingIrSha256
			, binarySha256: component.nativeLibrary.sha256
			, layoutSha256: adapter.copiedGraph.layoutSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, adapterSha256: sha256(canonicalJson(adapter))
			, deterministicReassembly: true, checkedSourceUnchanged: true, pypiOnly: true
			, rejectsGraphReceiptDrift: 3, rejectsRegeneratedSourceDrift: 3 } };
};

const preparePeer = async ({ author, handoff, environment, names }) => {
	const projectRoot = join(author, "project"), outputRoot = join(author, "release");
	const module = names ? "Names" : "Peer", name = names ? "graph_names" : "recursive_peer";
	const source = names ? `namespace Names
inductive scope where
  | finish (value : UInt32)
  | next (value : scope)
structure value where
  next : Option scope
structure next where
  tree : value
def echo (native : next) : next := native
end Names
` : "namespace Peer\ndef answer : UInt32 := 42\nend Peer\n";
	await saveLakeFile(projectRoot, `${module}.lean`, source);
	await saveLakeFile(projectRoot, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(projectRoot, "lakefile.toml", `name = "${name}"\nversion = "1.0.0"\n[[lean_lib]]\nname = "${module}"\n`);
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({
		schemaVersion: 1, modules: [module]
		, exports: [`${module}.${names ? "echo" : "answer"}`]
		, targets: { pypi: { name: name.replaceAll("_", "-"), version: "1.0.0" } } }));
	await buildCanonicalProject({ projectRoot, outputRoot, targets: ["pypi"], environment })
		.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
	const receipt = await copyPackageSetHandoff(outputRoot, handoff);
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	return { handoff, pkg: receipt.packages[0], module: `lean_${name}`, sourceSha256: sha256(source) };
};

const checkTypes = async ({ checker, command, root }) => {
	const check = file => runCopied(checker, ["-I", "-c"
		, 'import resource, runpy, sys; resource.setrlimit(resource.RLIMIT_AS, (1024**3, 1024**3)); sys.argv = ["mypy", *sys.argv[1:]]; runpy.run_module("mypy", run_name="__main__")'
		, "--strict", "--no-incremental", "--cache-dir=/dev/null"
		, "--python-executable", command, file], root);
	const result = await check("typed.py");
	assert.equal(result.stderr, ""); assert.equal(result.stdout.trim(), "Success: no issues found in 1 source file");
	await assert.rejects(() => check("invalid.py"), error => {
		assert.equal(error.details.stderr, ""); assert.match(error.details.stdout, /Found 12 errors in 1 file/);
		assert.equal(error.details.stdout.split("\n").filter(line => /^invalid\.py:\d+: error:/.test(line)).length, 12);
		assert.doesNotMatch(error.details.stdout, /import-not-found|import-untyped|no-any/); return true;
	});
	await runCopied(command, ["-I", "-B", "typed.py"], root);
	return { rejectedCalls: 12, executed: true, memoryLimitMiB: 1024 };
};

const install = async ({ consumer, handoff, pkg, layout, peers, interpreters, checker, diagnostic }) => {
	const archive = join(handoff, pkg.artifacts[0].path);
	assert.equal(await digest(archive), pkg.artifacts[0].sha256);
	const sources = {};
	for(const [name, file] of [["public", "recursive-installed"], ["typed", "recursive-installed-typed"], ["invalid", "recursive-installed-invalid"], ["faults", "recursive-installed-faults"], ["composition", "recursive-python-composition"]])
		sources[`${name}.py`] = await readFile(`${fixtures}/${file}.py`, "utf8");
	const checks = await readFile(`${fixtures}/recursive-python-checks.py`, "utf8");
	assert.equal(checks.split("import graph as lb").length, 2);
	sources["graph_checks.py"] = checks.replace("import graph as lb", "from lean_recursive import _native as lb");
	const guide = (await readFile("docs/consume/python.md", "utf8")).split("### Recursive values\n")[1].split("\n### ")[0];
	sources["documentation.py"] = guide.match(/```python\n([^]*?)\n```/)[1] + "\n";
	const staged = [];
	for(const [name, python, typingVersion] of [["3.11-minimum", interpreters[0], "4.6.0"], ["3.11-current", interpreters[0], "4.16.0"], ["3.12-standard", interpreters[1], "4.16.0"]])
	{
		const root = join(consumer, name), installation = await installPythonWheel({ root, archive, python, typingVersion });
		assert.ok(installation.python.startsWith(name.slice(0, 4) + "."));
		assert.equal(installation.requires.length, 1);
		assert.equal(installation.dependency?.version ?? null, name === "3.12-standard" ? null : typingVersion);
		for(const peer of peers)
		{
			assert.equal(peer.pkg.runtimeIdentity, pkg.runtimeIdentity);
			const peerArchive = join(peer.handoff, peer.pkg.artifacts[0].path);
			assert.equal(await digest(peerArchive), peer.pkg.artifacts[0].sha256);
			await runCopied(installation.command, ["-I", "-m", "pip", "--isolated", "install", "--no-index", "--no-deps", "--no-cache-dir", "--no-compile", peerArchive], root);
		}
		const site = (await runCopied(installation.command, ["-I", "-B", "-c", 'import sysconfig; print(sysconfig.get_paths()["purelib"])'], root)).stdout.trim();
		assert.ok(site.startsWith(`${root}/venv/`));
		const packages = [];
		for(const module of ["lean_recursive", ...peers.map(peer => peer.module)])
		{
			const bytes = await readFile(join(site, `${module}/lean_bridge/package-receipt.json`)), receipt = JSON.parse(bytes);
			await verifyNativeFiles(site, receipt.files);
			packages.push({ module, receipt, receiptSha256: sha256(bytes), paths: await nativeArtifactPaths(join(site, module)) });
		}
		for(const [file, source] of Object.entries(sources)) await saveLakeFile(root, file, source);
		// Isolated Python omits cwd from sys.path. Keep fault helpers in their own
		// installed probe module, separate from all original package inventories.
		await saveLakeFile(site, "graph_checks.py", sources["graph_checks.py"]);
		const relocated = join(consumer, `${name}-relocated`); await rename(root, relocated);
		staged.push({ name, root: relocated, installation, packages
			, command: join(relocated, relative(root, installation.command))
			, site: join(relocated, relative(root, site)) });
	}
	await rm(handoff, { recursive: true, force: true });
	for(const peer of peers) await rm(peer.handoff, { recursive: true, force: true });
	const reports = [];
	for(const { name, root, installation, packages, command, site } of staged)
	{
		diagnostic(`${name}: original installed wheel, typed calls, failure cleanup and shared runtime`);
		const execute = async (file, args = []) => {
			const result = await runCopied(command, ["-I", "-B", file, ...args], root);
			assert.equal(result.stderr, ""); return JSON.parse(result.stdout);
		};
		const first = await execute("public.py");
		assert.ok(first.checks > 200 && first.rejected > 60); assert.equal(first.functions, 18);
		const typing = await checkTypes({ checker, command, root });
		const documented = await runCopied(command, ["-I", "-B", "documentation.py"], root);
		assert.equal(documented.stderr, ""); assert.equal(documented.stdout, "Depth: 2\n");
		const faults = await execute("faults.py", [JSON.stringify(layout)]);
		assert.ok(faults.checkpoints > 100); assert.equal(faults.exactlyOnceCleanup, true);
		const composition = [];
		for(const mode of ["raw", "during"])
			composition.push(await execute("composition.py", [JSON.stringify(layout), mode]));
		const nativeFile = "lean_recursive/native/linux-x64/librecursive.so", library = join(site, nativeFile);
		const original = await readFile(library), corrupt = Buffer.from(original); corrupt[corrupt.length - 1] ^= 1;
		await saveLakeFile(site, nativeFile, corrupt);
		await assert.rejects(() => runCopied(command, ["-I", "-B", "-c", "import lean_recursive"], root), error => /differs from compiled evidence/.test(error.details?.stderr));
		await saveLakeFile(site, nativeFile, original);
		await rename(library, join(root, "retained-library.so"));
		await symlink(join(root, "retained-library.so"), library);
		await assert.rejects(() => runCopied(command, ["-I", "-B", "-c", "import lean_recursive"], root), error => /not a regular file/.test(error.details?.stderr));
		await rm(library); await rename(join(root, "retained-library.so"), library);
		for(const { module } of packages) await rename(join(site, `${module}/lean_bridge`), join(root, `${module}-metadata`));
		assert.deepEqual(await execute("public.py"), first);
		assert.deepEqual(await runCopied(command, ["-I", "-B", "documentation.py"], root), documented);
		for(const { module } of packages) await rename(join(root, `${module}-metadata`), join(site, `${module}/lean_bridge`));
		for(const { module, receipt, receiptSha256, paths } of packages)
		{
			await verifyNativeFiles(site, receipt.files);
			assert.equal(await digest(join(site, `${module}/lean_bridge/package-receipt.json`)), receiptSha256);
			assert.deepEqual(await nativeArtifactPaths(join(site, module)), paths);
		}
		const { command: previousCommand, ...runtime } = installation; void previousCommand;
		reports.push({ name, ...runtime, public: first, typing, faults, composition
			, documentation: { sourceSha256: sha256(sources["documentation.py"]), stdout: documented.stdout }
			, installedPackages: packages.map(({ module, receipt, receiptSha256 }) => ({ module, receiptSha256, files: receipt.files }))
			, sourceHashes: Object.fromEntries(Object.entries(sources).map(([file, source]) => [file, sha256(source)]))
			, offlineInstall: true, compilerFreeExecution: true
			, relocatedInstallation: true, authorSourcesRemoved: true
			, handoffRemoved: true, buildMetadataNotRequired: true
			, rejectsTamperedAssets: true, rejectsSymlinkAssets: true
			, installedFilesUnchanged: true });
		await rm(root, { recursive: true, force: true });
	}
	return reports;
};

/**
 * Build both source paths and exercise the original wheels on supported runtimes.
 *
 * @param directory - Fresh test-owned root.
 * @param diagnostic - Progress callback.
 */
export const checkInstalledPythonGraphs = async (directory, diagnostic = () => {}) => {
	const interpreters = JSON.parse(process.env.LEAN_BRIDGE_COLLECTION_PYTHONS ?? JSON.stringify([resolve(".toolchains/python311/bin/python3.11"), resolve(".toolchains/python312/bin/python3.12")]));
	assert.equal(interpreters.length, 2);
	const checker = resolve(process.env.LEAN_BRIDGE_COLLECTION_MYPY_PYTHON ?? "build/python-collection-typecheck/bin/python");
	const checkerVersion = (await runCopied(checker, ["-I", "-m", "mypy", "--version"], directory)).stdout.trim();
	assert.match(checkerVersion, /^mypy 2\.3\.1\b/);
	const environment = { ...nativeFixtureEnvironment(["python"]), LEAN_BRIDGE_PYTHON: interpreters[0] };
	const observations = [];
	for(const reviewed of [false, true])
	{
		const root = join(directory, reviewed ? "reviewed" : "ordinary");
		const author = join(root, "author"), consumer = join(root, "consumer"), handoff = join(consumer, "handoff");
		const prepared = await prepare({ author, handoff, environment, reviewed, diagnostic });
		await rm(author, { recursive: true, force: true });
		const peers = [];
		for(const names of [false, true])
		{
			const peerAuthor = join(root, names ? "names-author" : "peer-author"), peerHandoff = join(consumer, names ? "names-handoff" : "peer-handoff");
			peers.push(await preparePeer({ author: peerAuthor, handoff: peerHandoff, environment, names }));
			await rm(peerAuthor, { recursive: true, force: true });
		}
		const installations = await install({ consumer, handoff, ...prepared, peers, interpreters, checker, diagnostic });
		observations.push({ reviewed, ...prepared.provenance, package: prepared.pkg
			, peers: peers.map(({ pkg, module, sourceSha256 }) => ({ package: pkg, module, sourceSha256 }))
			, installations });
		await rm(root, { recursive: true, force: true });
	}
	return { schemaVersion: 1, installedPackage: true, checkerVersion, observations };
};
