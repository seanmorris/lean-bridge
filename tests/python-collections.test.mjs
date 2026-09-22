/**
 * Original Python collection wheels on ordinary-source and independently reviewed paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { sourceApiIdentity } from "../src/analyze/semantic-model.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { compileCopiedPythonModel } from "../src/backends/python/copied-model.mjs";
import { collectionReviewedIr, collectionSignatures, writeCollectionProject } from "./helpers/collection-fixture.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { installPythonCollections } from "./helpers/python-collection-install.mjs";
import { installPythonWheel } from "./helpers/python-wheel-install.mjs";

const type = value => value.kind === "primitive" ? value.name : value.kind === "array"
	? { array: type(value.element) } : { record: value.name, fields: Object.fromEntries(value.fields.map(field => [field.name, type(field.type)])) };

test("installed Python arrays and records preserve values and bounded annotations on both source paths", { skip: process.env.LEAN_BRIDGE_PYTHON_COLLECTION_TEST !== "1", timeout: 900_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["python"]);
	const interpreters = JSON.parse(process.env.LEAN_BRIDGE_COLLECTION_PYTHONS ?? JSON.stringify([resolve(".toolchains/python311/bin/python3.11"), resolve(".toolchains/python312/bin/python3.12")]));
	assert.equal(interpreters.length, 2);
	environment.LEAN_BRIDGE_PYTHON ??= interpreters[0];
	const checker = resolve(process.env.LEAN_BRIDGE_COLLECTION_MYPY_PYTHON ?? "build/python-collection-typecheck/bin/python");
	const checkerVersion = (await runCopied(checker, ["-I", "-m", "mypy", "--version"], process.cwd())).stdout.trim();
	assert.match(checkerVersion, /^mypy 2\.3\.1\b/);
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-python-collection-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-python-collection-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await writeCollectionProject(projectRoot);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Collections"]
			, targets: { pypi: { name: "collections-api", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: collectionSignatures.map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(collectionReviewedIr()));
		t.diagnostic(`${path}: compiling Python collections`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["pypi"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		const signatures = model.exports.map(item => ({ name: item.name, parameters: item.parameters.map(parameter => type(parameter.type)), result: type(item.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(collectionSignatures));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await rm(author, { recursive: true, force: true });
		t.diagnostic(`${path}: offline installation on 3.11 with minimum/current backport and 3.12 without it`);
		const installations = await installPythonCollections({ consumer, handoff, packages: receipt.packages, interpreters, checker, projection: compileCopiedPythonModel(model.bindingIr) });
		t.diagnostic(`${path}: ${installations[0].public.checks} assertions per runtime; all original installed files unchanged`);
		reports.push({
			profile: "python"
			, path
			, signatures
			, packages: receipt.packages
			, installations
			, checkerVersion
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, sourceApiSha256: sourceApiIdentity(model.bindingIr).sha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256: sha256(canonicalJson(receipt))
			, sourceRemovedBeforeInstallation: true
		});
		await rm(consumer, { recursive: true, force: true });
	}
	assert.deepEqual(reports[0].installations[0].public.loadedLibraries, reports[1].installations[0].public.loadedLibraries);
	await saveLakeFile("build/collections", "python.json", canonicalJson({ schemaVersion: 1, reports }));
});

test("Python publisher and consumer collection examples execute from a relocated original wheel", { skip: process.env.LEAN_BRIDGE_PYTHON_COLLECTION_TEST !== "1", timeout: 300_000 }, async t => {
	const publisher = await readFile("docs/publish/pypi.md", "utf8"), consumerDocs = await readFile("docs/consume/python.md", "utf8");
	const lean = publisher.match(/## Export arrays and records\n[\s\S]*?```lean\n([\s\S]*?)\n```/)?.[1];
	const pythonSource = consumerDocs.match(/### Arrays and records\n[\s\S]*?```python\n([\s\S]*?)\n```/)?.[1];
	assert.ok(lean && pythonSource, "Both documentation examples must remain executable");
	const author = await mkdtemp(join(tmpdir(), "lean-bridge-python-docs-author-"));
	const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-python-docs-consumer-"));
	t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
	const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
	await saveLakeFile(projectRoot, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(projectRoot, "lakefile.toml", 'name = "parcels"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Parcels"\n');
	await saveLakeFile(projectRoot, "Parcels.lean", lean + "\n");
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Parcels"], exports: ["Parcels.reverse"], targets: { pypi: { name: "parcels-api", version: "1.0.0" } } }));
	const environment = nativeFixtureEnvironment(["python"]);
	environment.LEAN_BRIDGE_PYTHON ??= resolve(".toolchains/python311/bin/python3.11");
	const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["pypi"], environment });
	const receipt = await copyPackageSetHandoff(outputRoot, handoff);
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	await rm(author, { recursive: true, force: true });
	assert.equal(receipt.packages.length, 1);
	const artifact = receipt.packages[0].artifacts[0], archive = join(handoff, artifact.path);
	assert.equal(sha256(await readFile(archive)), artifact.sha256);
	const root = join(consumer, "install");
	const { command, ...installation } = await installPythonWheel({ root, archive, python: environment.LEAN_BRIDGE_PYTHON });
	assert.deepEqual(installation.requires, []);
	assert.equal(installation.dependency, null);
	const site = (await runCopied(command, ["-I", "-B", "-c", 'import sysconfig; print(sysconfig.get_paths()["purelib"])'], root)).stdout.trim();
	assert.ok(site.startsWith(`${root}/venv/`));
	const receiptPath = "lean_parcels/lean_bridge/package-receipt.json";
	const installedReceipt = await readFile(join(site, receiptPath)), inventory = JSON.parse(installedReceipt).files;
	await verifyNativeFiles(site, inventory);
	const paths = await nativeArtifactPaths(join(site, "lean_parcels"));
	await saveLakeFile(root, "arrays-records.py", pythonSource);
	await rm(handoff, { recursive: true, force: true });
	const relocated = join(consumer, "deployed"); await rename(root, relocated);
	const interpreter = join(relocated, relative(root, command)), relocatedSite = join(relocated, relative(root, site));
	for(let i = 0; i < 2; ++i)
	{
		const result = await runCopied(interpreter, ["-I", "-B", "arrays-records.py"], relocated);
		assert.equal(result.stderr, ""); assert.equal(result.stdout, "Seeds: 7, 2\n");
	}
	await verifyNativeFiles(relocatedSite, inventory);
	assert.deepEqual(await readFile(join(relocatedSite, receiptPath)), installedReceipt);
	assert.deepEqual(await nativeArtifactPaths(join(relocatedSite, "lean_parcels")), paths);
	await saveLakeFile("build/collections", "python-docs.json", canonicalJson({ schemaVersion: 1
		, packages: receipt.packages
		, installation
		, bindingIrSha256: built.bindingIrSha256
		, sourceHashes: { lean: sha256(lean), python: sha256(pythonSource) }
		, installedFiles: inventory
		, installedReceiptSha256: sha256(installedReceipt)
		, expectedOutput: "Seeds: 7, 2\n"
		, sourceRemovedBeforeInstallation: true
		, relocatedInstallation: true
		, producerHandoffRemoved: true
		, compilerFreeExecution: true
		, repeatExecution: true
		, installedFilesUnchanged: true }));
});
