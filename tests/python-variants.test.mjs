/**
 * Named variants through original Python wheels after offline installation.
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
import { cVariantReviewedIr, cVariantSignatures } from "./helpers/c-variant-fixture.mjs";
import { checkNativeVariantFaults } from "./helpers/native-variant-faults.mjs";
import { installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";

const shape = ir => ({
	declarations: ir.declarations.map(item => ({ id: item.id, parameters: item.parameters.map(p => p.type), result: item.result.type })).sort((a, b) => a.id.localeCompare(b.id))
	, types: ir.types.map(type => ({ id: type.id, name: type.name, kind: type.kind
		, fields: type.fields.map(({ name, type }) => ({ name, type }))
		, cases: type.cases.map(branch => ({ name: branch.name, fields: branch.fields.map(({ name, type }) => ({ name, type })) })) })).sort((a, b) => a.id.localeCompare(b.id))
});

test("installed Python variants preserve named constructors, strict stubs and cleanup", { skip: process.env.LEAN_BRIDGE_PYTHON_VARIANT_TEST !== "1", timeout: 900_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["python"]);
	const checker = resolve(process.env.LEAN_BRIDGE_MYPY_PYTHON ?? "build/python-alias-typecheck/bin/python");
	const version = (await runCopied(checker, ["-I", "-m", "mypy", "--version"], process.cwd())).stdout.trim();
	assert.match(version, /^mypy 1\.17\.1\b/);
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-python-variant-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-python-variant-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-variants", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "Variants/Extra.lean", await readFile("tests/fixtures/variant-consumers/Extra.lean", "utf8"));
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Variants", "Variants.Extra"]
			, targets: { pypi: { name: "variants-api", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: cVariantSignatures().map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(cVariantReviewedIr()));
		t.diagnostic(`${path}: compiling Python variants`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["pypi"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.deepEqual(shape(model.bindingIr), shape(cVariantReviewedIr()));
		const faultChecks = await checkNativeVariantFaults(outputRoot, join(author, "faults"), environment);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await rm(author, { recursive: true, force: true });
		const { command, ...observation } = await installCopiedConsumer({ profile: "python"
			, consumer, handoff, packages: receipt.packages, environment
			, fixture: { source: () => readFile("tests/fixtures/variant-consumers/python.py", "utf8"), parseResult: JSON.parse } });
		const root = join(consumer, "python");
		for(const name of ["typed", "invalid", "probe"])
			await saveLakeFile(root, `${name}.py`, await readFile(`tests/fixtures/variant-consumers/python-${name}.py`, "utf8"));
		const site = (await runCopied(command, ["-I", "-c", "import pathlib, lean_variants; print(pathlib.Path(lean_variants.__file__).parent.parent)"], root)).stdout.trim();
		assert.ok(site.startsWith(`${root}/venv/`));
		const installed = JSON.parse(await readFile(join(site, "lean_variants/lean_bridge/package-receipt.json")));
		await verifyNativeFiles(site, installed.files);
		await rm(handoff, { recursive: true, force: true });
		const relocated = join(consumer, "python-relocated"); await rename(root, relocated);
		const movedPython = join(relocated, relative(root, command)), movedSite = join(relocated, relative(root, site));
		const runs = [observation.result], probes = [];
		for(let attempt = 0; attempt < 2; ++attempt)
		{
			const executed = await runCopied(movedPython, ["-I", "consumer.py"], relocated);
			assert.equal(executed.stderr, ""); runs.push(JSON.parse(executed.stdout));
			const args = ["-I", "-m", "mypy", "--strict", "--no-incremental", "--cache-dir=/dev/null", "--python-executable", movedPython];
			const checked = await runCopied(checker, [...args, "typed.py"], relocated);
			assert.equal(checked.stderr, ""); assert.equal(checked.stdout.trim(), "Success: no issues found in 1 source file");
			await assert.rejects(() => runCopied(checker, [...args, "invalid.py"], relocated), error => {
				assert.equal(error.details.stderr, "");
				assert.match(error.details.stdout, /Found 8 errors in 1 file/);
				assert.equal(error.details.stdout.split("\n").filter(line => /^invalid\.py:\d+: error:/.test(line)).length, 8);
				assert.doesNotMatch(error.details.stdout, /import-not-found|import-untyped|no-any/);
				return true;
			});
			await runCopied(movedPython, ["-I", "typed.py"], relocated);
			const probed = await runCopied(movedPython, ["-I", "probe.py"], relocated);
			assert.equal(probed.stderr, ""); probes.push(JSON.parse(probed.stdout));
			await verifyNativeFiles(movedSite, installed.files);
		}
		for(const run of runs)
		{
			assert.deepEqual(run, runs[0]); assert.ok(run.checks > 10000 && run.calls > 1000 && run.rejected >= 60);
			assert.equal(run.loadedLibraries.length, 4);
			for(const { path, ...identity } of run.loadedLibraries) assert.deepEqual(identity, installed.files[path]);
		}
		assert.deepEqual(probes[0], probes[1]); assert.ok(probes[0].allocationFailures > 10 && probes[0].conversionFailures > 50);
		reports.push({ profile: "python", path, runs, probes, faultChecks
			, packages: receipt.packages, installedFiles: installed.files
			, consumerSha256: observation.consumerSha256
			, probeSha256: sha256(await readFile("tests/fixtures/variant-consumers/python-probe.py"))
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, sourceApiSha256: sourceApiIdentity(model.bindingIr).sha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256: sha256(canonicalJson(receipt))
			, offlineInstall: true, compilerFreePath: true, relocatedInstallation: true
			, sourceRemovedBeforeInstallation: true
			, handoffRemovedBeforeExecution: true
			, installedFilesUnchanged: true, repeatExecution: true
			, strictTypecheck: { version, repeatedAfterRelocation: true, rejectedCalls: 8
				, sourceSha256: sha256(await readFile("tests/fixtures/variant-consumers/python-typed.py"))
				, rejectionSourceSha256: sha256(await readFile("tests/fixtures/variant-consumers/python-invalid.py")) } });
		t.diagnostic(`${path}: ${runs[0].checks} public assertions, ${probes[0].conversionFailures} result-conversion failures recovered`);
		await rm(consumer, { recursive: true, force: true });
	}
	await saveLakeFile("build/variants", "python.json", canonicalJson({ schemaVersion: 1, reports }));
});
