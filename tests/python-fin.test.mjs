/**
 * Checked top-level Fin sites in installed, relocated Python wheels.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileCopiedPythonModel } from "../src/backends/python/copied-model.mjs";
import { renderCopiedPythonPackage } from "../src/backends/python/copied-values.mjs";
import { pythonFinRefinements, pythonFinSummary } from "../src/backends/python/refinements.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { supportsNativeRefinementTargets } from "../src/build/native-project.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { corpusReviewedIr } from "./helpers/type-corpus-reviewed-ir.mjs";
import { nativeFinDispatchColumns, nativeFinDispatchInterposer } from "./helpers/native-fin-consumers.mjs";
import { pythonFinConsumer, pythonFinDispatchExpected, pythonFinDispatchProbe } from "./helpers/python-fin-consumers.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";

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

const finIr = () => {
	const ir = corpusReviewedIr({ id: "fins" }, [
		{ name: "Fins.label", parameters: ["nat", "nat", "string"], result: "string" }
		, { name: "Fins.mirror", parameters: ["nat"], result: "nat" }
		, { name: "Fins.plain", parameters: ["nat"], result: "nat" }]);
	const declaration = name => ir.declarations.find(item => item.id === `lean:Fins.${name}`);
	declaration("label").source.extensions["lean-lang.org/refinements"] = { parameters: [null, { kind: "fin", bound: "4" }, null], result: null };
	declaration("mirror").source.extensions["lean-lang.org/refinements"] = { parameters: [{ kind: "fin", bound: huge }], result: { kind: "fin", bound: huge } };
	return { ir, declaration };
};

test("Python wheels are checked Fin consumers beside C and C++", () => {
	for(const targets of [["pypi"], ["c", "pypi"], ["cpp", "pypi"], ["c", "cpp", "pypi"]])
		assert.equal(supportsNativeRefinementTargets(targets), true, targets.join(","));
	for(const target of ["cpan", "cargo", "rubygems", "nuget", "maven", "php-native", "wit-wasi"])
		assert.equal(supportsNativeRefinementTargets(["pypi", target]), false, target);
});

test("generated Python bound docs come only from checked refinement metadata", () => {
	const { ir, declaration } = finIr();
	const files = renderCopiedPythonPackage(compileCopiedPythonModel(ir));
	for(const path of ["lean_fins/__init__.py", "lean_fins/__init__.pyi"])
	{
		const source = files[path];
		assert.match(source, /def label\(value0: int, value1: int, value2: str\) -> str:\n {4}"""Checked Lean Fin bounds: value1 < 4\."""\n/, path);
		assert.match(source, new RegExp(`def mirror\\(value0: int\\) -> int:\\n {4}"""Checked Lean Fin bounds: value0 < ${huge}; result < ${huge}\\."""\\n`), path);
		// An unrefined Nat keeps no bound; nothing is inferred from the erased transport type.
		assert.match(source, /def plain\(value0: int\) -> int:\n {4}(?:return|\.\.\.)/, path);
	}
	assert.match(files["README.md"], /Lean Fin n parameters and results are exact Python int values below n\./);
	assert.match(files["README.md"], /raises LeanBridgeError with status 1/);
	assert.match(files["README.md"], /\n- lean_fins\.label: value1 < 4\n/);
	assert.match(files["README.md"], new RegExp(`\\n- lean_fins\\.mirror: value0 < ${huge}; result < ${huge}\\n`));
	assert.doesNotMatch(files["README.md"], /lean_fins\.plain: value/);
	// Packages without refined declarations keep their previous README.
	const plain = corpusReviewedIr({ id: "plain" }, [{ name: "Plain.echo", parameters: ["nat"], result: "nat" }]);
	assert.doesNotMatch(renderCopiedPythonPackage(compileCopiedPythonModel(plain))["README.md"], /Fin/);
	assert.equal(pythonFinSummary(declaration("plain"), ["value0"]), null);
	// Malformed or non-scalar metadata fails instead of disappearing from the docs.
	const label = declaration("label"), fin = bound => ({ kind: "fin", bound });
	const malformed = [
		null
		, []
		, { parameters: [] }
		, { parameters: [null, null, null] }
		, { parameters: [null, null], result: null }
		, { parameters: [null, fin("04"), null], result: null }
		, { parameters: [null, { ...fin("4"), extra: true }, null], result: null }
		, { parameters: [null, { kind: "subtype", constructor: "Fins.check" }, null], result: null }
		, { parameters: [fin("4"), null, null], result: fin("4") }
	];
	for(const value of malformed)
	{
		const changed = { ...label, source: { ...label.source, extensions: { ...label.source.extensions, "lean-lang.org/refinements": value } } };
		assert.throws(() => pythonFinRefinements(changed), TypeError, JSON.stringify(value));
	}
});

/**
 * Count real dispatch inside the installed Python process with the C acceptance interposer.
 *
 * @param root - Consumer root holding the venv.
 * @param python - Venv interpreter.
 */
const observeDispatch = async (root, python) => {
	await saveLakeFile(root, "interposer.c", nativeFinDispatchInterposer());
	await saveLakeFile(root, "probe.py", pythonFinDispatchProbe());
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-shared", "-fPIC", "interposer.c", "-o", "libdispatch.so"], root
		, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" });
	const run = await runCopied(python, ["-I", "probe.py"], root, { ...copiedCleanEnvironment, LD_PRELOAD: join(root, "libdispatch.so") });
	assert.equal(run.stderr, "");
	const observed = run.stdout.trim().split("\n").map(line => {
		const [step, status, ...counts] = line.split(" ");
		return [step, status, counts.map(Number)];
	});
	assert.deepEqual(observed, pythonFinDispatchExpected);
	return { columns: nativeFinDispatchColumns, observed, interposer: "LD_PRELOAD"
		, positiveControl: "valid public and raw calls increment source and adapter counts"
		, probeSha256: sha256(pythonFinDispatchProbe()) };
};

const sharedLibraries = files => Object.fromEntries(Object.entries(files)
	.filter(([path]) => /\.so(?:\.|$)/.test(path)).map(([path, file]) => [basename(path), file.sha256 ?? file]));

test("relocated source-free Python wheels check Fin bounds through public and raw adapters", { skip: process.env.LEAN_BRIDGE_PYTHON_FIN_TEST !== "1", timeout: 2_400_000 }, async t => {
	const interpreters = JSON.parse(process.env.LEAN_BRIDGE_COLLECTION_PYTHONS
		?? JSON.stringify([resolve(".toolchains/python311/bin/python3.11"), resolve(".toolchains/python312/bin/python3.12")]));
	assert.equal(interpreters.length, 2);
	const environment = { ...nativeFixtureEnvironment(["c", "python"]), LEAN_BRIDGE_PYTHON: interpreters[0] };
	const reports = [], archives = [];
	for(const attempt of [0, 1])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-python-fin-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-python-fin-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-fin", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["NativeFin"]
			, targets: { c: { name: "native-fin", version: "1.0.0" }, pypi: { name: "native-fin", version: "1.0.0" } } }));
		t.diagnostic(`build ${attempt}: compiling the shared C library and Python wheel`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c", "pypi"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, bounds(item.refinements)])), expectedBounds);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		await rm(author, { recursive: true, force: true });
		if(attempt === 1) break;
		// The C archive and the wheel from this build must bundle the same checked native library.
		const cPackage = receipt.packages.find(pkg => pkg.target === "c" && pkg.role === "component");
		const extracted = join(consumer, "c-extract");
		await saveLakeFile(extracted, ".keep", "");
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, cPackage.artifacts[0].path)], extracted);
		const cInstalled = join(extracted, `${cPackage.name}-${cPackage.version}-c`);
		const cReceipt = JSON.parse(await readFile(join(cInstalled, "lean-bridge-package.json"), "utf8"));
		await verifyNativeFiles(cInstalled, cReceipt.files);
		const cLibraries = sharedLibraries(cReceipt.files);
		const packages = receipt.packages.filter(pkg => pkg.target === "pypi");
		for(const [index, python] of interpreters.entries())
		{
			const version = (await runCopied(python, ["-I", "-c", "import sys; print('%d.%d' % sys.version_info[:2])"], consumer)).stdout.trim();
			assert.equal(version, ["3.11", "3.12"][index]);
			t.diagnostic(`Python ${version}: offline wheel installation without producer files or compilers`);
			const installRoot = join(consumer, `python-${version}`);
			const { command, ...observation } = await installCopiedConsumer({ profile: "python"
				, consumer: installRoot, handoff, packages
				, environment: { ...environment, LEAN_BRIDGE_PYTHON: python }
				, fixture: { source: pythonFinConsumer, success: "python-fin-ok" } });
			const root = join(installRoot, "python");
			const site = (await runCopied(command, ["-I", "-c", "import pathlib, lean_native_fin; print(pathlib.Path(lean_native_fin.__file__).parent.parent)"], root)).stdout.trim();
			assert.ok(site.startsWith(`${root}/venv/`));
			const installed = JSON.parse(await readFile(join(site, "lean_native_fin/lean_bridge/package-receipt.json"), "utf8"));
			await verifyNativeFiles(site, installed.files);
			const wheelLibraries = sharedLibraries(installed.files);
			const shared = Object.keys(wheelLibraries).filter(name => Object.hasOwn(cLibraries, name)).sort();
			assert.ok(shared.includes("libnative_fin.so"), JSON.stringify({ wheel: wheelLibraries, c: cLibraries }));
			for(const name of shared) assert.equal(wheelLibraries[name], cLibraries[name], name);
			const docs = await readFile(join(site, "lean_native_fin/__init__.pyi"), "utf8");
			assert.match(docs, /def mirror\(value: int\) -> int:\n {4}"""Checked Lean Fin bounds: value < 10; result < 10\."""/);
			assert.match(docs, new RegExp(`def succ_huge\\(value: int\\) -> int:\\n {4}"""Checked Lean Fin bounds: value < ${huge}; result < ${huge}\\."""`));
			assert.match(docs, /def label\(base: int, offset: int, name: str\) -> str:\n {4}"""Checked Lean Fin bounds: offset < 4\."""/);
			const dispatch = await observeDispatch(root, command);
			const relocated = join(installRoot, "python-relocated");
			await rename(root, relocated);
			const movedPython = join(relocated, relative(root, command));
			const repeated = await runCopied(movedPython, ["-I", "consumer.py"], relocated);
			assert.equal(repeated.stderr, ""); assert.equal(repeated.stdout.trim(), `python-fin-ok:${observation.checks}`);
			await verifyNativeFiles(join(relocated, relative(root, site)), installed.files);
			reports.push({ profile: "python", python: version, path: "ordinary-source"
				, ...observation
				, dispatch
				, packages
				, sharedNativeLibraries: Object.fromEntries(shared.map(name => [name, wheelLibraries[name]]))
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, modelSha256: sha256(canonicalJson(model))
				, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
				, sourceRemovedBeforeInstallation: true
				, relocatedInstallation: true, repeatExecution: true
				, installedFilesUnchanged: true
				, installedFilesSha256: sha256(canonicalJson(installed.files)) });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	// Two clean authoring roots must produce byte-identical C and Python archives.
	assert.deepEqual(archives[1], archives[0]);
	assert.ok(Object.keys(archives[0]).some(path => path.endsWith(".whl")));
	await saveLakeFile("build/native-fin", "python.json", canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
});
