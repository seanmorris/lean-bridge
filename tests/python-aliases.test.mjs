/**
 * Compiler-authenticated aliases in installed, relocated Python wheels and stubs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { sourceApiIdentity } from "../src/analyze/semantic-model.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { nativeAliasReviewedIr, nativeAliasSignatures } from "./helpers/native-alias-fixture.mjs";
import { installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";

const contract = ir => ({
	declarations: ir.declarations.map(item => ({ id: item.id, parameters: item.parameters.map(p => p.type), result: item.result.type })).sort((a, b) => a.id.localeCompare(b.id))
	, types: ir.types.map(type => ({ id: type.id, name: type.name, kind: type.kind
		, representation: type.representation, mutability: type.mutability
		, typeParameters: type.typeParameters, target: type.target
		, fields: type.fields.map(({ name, type }) => ({ name, type }))
		, cases: type.cases })).sort((a, b) => a.id.localeCompare(b.id))
});

test("installed Python aliases retain named types and exact values after relocation", { skip: process.env.LEAN_BRIDGE_PYTHON_ALIAS_TEST !== "1", timeout: 900_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["python"]);
	const checker = resolve(process.env.LEAN_BRIDGE_MYPY_PYTHON ?? "build/python-alias-typecheck/bin/python");
	const version = (await runCopied(checker, ["-I", "-m", "mypy", "--version"], process.cwd())).stdout.trim();
	assert.match(version, /^mypy 1\.17\.1\b/);
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-python-alias-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-python-alias-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-aliases", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Aliases"]
			, targets: { pypi: { name: "aliases-api", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: nativeAliasSignatures.map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(nativeAliasReviewedIr()));
		t.diagnostic(`${path}: compiling named Python aliases`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["pypi"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.deepEqual(contract(model.bindingIr), contract(nativeAliasReviewedIr()));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await rm(author, { recursive: true, force: true });
		t.diagnostic(`${path}: offline wheel installation without producer files or compilers`);
		const { command, ...observation } = await installCopiedConsumer({ profile: "python"
			, consumer
			, handoff, packages: receipt.packages, environment
			, fixture: { source: () => readFile("tests/fixtures/alias-consumers/python.py", "utf8"), success: "alias-python-ok" } });
		const root = join(consumer, "python");
		await saveLakeFile(root, "typed.py", await readFile("tests/fixtures/alias-consumers/python-typed.py", "utf8"));
		await saveLakeFile(root, "invalid.py", await readFile("tests/fixtures/alias-consumers/python-invalid.py", "utf8"));
		const typecheck = async (python, cwd) => {
			const args = ["-I", "-m", "mypy", "--strict", "--no-incremental", "--cache-dir=/dev/null", "--python-executable", python];
			const result = await runCopied(checker, [...args, "typed.py"], cwd);
			assert.equal(result.stderr, ""); assert.equal(result.stdout.trim(), "Success: no issues found in 1 source file");
			await assert.rejects(() => runCopied(checker, [...args, "invalid.py"], cwd), error => {
				assert.equal(error.details.stderr, "");
				assert.match(error.details.stdout, /Found 8 errors in 1 file/);
				assert.equal(error.details.stdout.split("\n").filter(line => /^invalid\.py:\d+: error:/.test(line)).length, 8);
				assert.doesNotMatch(error.details.stdout, /import-not-found|import-untyped|no-any/);
				return true;
			});
			await runCopied(python, ["-I", "typed.py"], cwd);
		};
		await typecheck(command, root);
		const site = (await runCopied(command, ["-I", "-c", "import pathlib, lean_aliases; print(pathlib.Path(lean_aliases.__file__).parent.parent)"], root)).stdout.trim();
		assert.ok(site.startsWith(`${root}/venv/`));
		const installed = JSON.parse(await readFile(join(site, "lean_aliases/lean_bridge/package-receipt.json")));
		await verifyNativeFiles(site, installed.files);
		const relocated = join(consumer, "python-relocated");
		await rename(root, relocated);
		const movedPython = join(relocated, relative(root, command));
		const repeated = await runCopied(movedPython, ["-I", "consumer.py"], relocated);
		assert.equal(repeated.stderr, ""); assert.equal(repeated.stdout.trim(), `alias-python-ok:${observation.checks}`);
		await typecheck(movedPython, relocated);
		await verifyNativeFiles(join(relocated, relative(root, site)), installed.files);
		reports.push({ profile: "python", path
			, ...observation
			, packages: receipt.packages
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, sourceApiSha256: sourceApiIdentity(model.bindingIr).sha256
			, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
			, sourceRemovedBeforeInstallation: true
			, relocatedInstallation: true, repeatExecution: true
			, installedFilesUnchanged: true
			, installedFilesSha256: sha256(canonicalJson(installed.files))
			, nativeLibraries: Object.fromEntries(Object.entries(installed.files).filter(([path]) => /\.so(?:\.|$)/.test(path)))
			, strictTypecheck: { version, repeatedAfterRelocation: true, rejectedCalls: 8
				, sourceSha256: sha256(await readFile("tests/fixtures/alias-consumers/python-typed.py"))
				, rejectionSourceSha256: sha256(await readFile("tests/fixtures/alias-consumers/python-invalid.py")) } });
		await rm(consumer, { recursive: true, force: true });
	}
	await saveLakeFile("build/aliases", "python.json", canonicalJson({ schemaVersion: 1, reports }));
});
