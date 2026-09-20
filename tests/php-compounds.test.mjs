/**
 * Installed native PHP compounds under weak and strict callers on both paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { compoundReviewedIr, compoundSignatures } from "./helpers/compound-fixture.mjs";
import { phpCompoundConsumer, phpCompoundRequest } from "./helpers/php-compound-fixture.mjs";
import { nativeFixtureEnvironment, copiedCleanEnvironment } from "./helpers/copied-fixture-install.mjs";
import { installedPhpCorpus } from "./helpers/type-corpus-php.mjs";
import { probePhpCompounds } from "./helpers/php-compound-probe.mjs";

const enabled = process.env.LEAN_BRIDGE_PHP_COMPOUND_TEST === "1";
const type = value => value.kind === "primitive" ? value.name : ["array", "option"].includes(value.kind)
	? { [value.kind]: type(value.element) } : ["result", "tuple"].includes(value.kind)
		? { [value.kind]: value.arguments.map(type) } : { record: value.name, fields: Object.fromEntries(value.fields.map(field => [field.name, type(field.type)])) };

test("installed native PHP compounds preserve copied values on both source paths", { skip: !enabled, timeout: 1_800_000 }, async t => {
	const reports = [];
	const environment = { ...nativeFixtureEnvironment(["php-native"]), LEAN_BRIDGE_PHP: process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php", LEAN_BRIDGE_COMPOSER: process.env.LEAN_BRIDGE_COMPOSER ?? "/usr/bin/composer" };
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-php-compound-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-php-compound-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/npm-compounds", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Compounds"]
			, targets: { "php-native": { name: "lean-bridge-compounds/api", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: compoundSignatures.map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(compoundReviewedIr()));
		t.diagnostic(`${path}: compiling the 64-export native PHP compound library`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["php-native"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		const signatures = model.exports.map(item => ({ name: item.name, parameters: item.parameters.map(parameter => type(parameter.type)), result: type(item.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(compoundSignatures));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff), pkg = receipt.packages.find(item => item.role === "component");
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		await rm(author, { recursive: true, force: true });
		t.diagnostic(`${path}: installing offline, removing the handoff and repeating relocated weak/strict consumers`);
		const installed = await installedPhpCorpus({ library: { phpModule: "LeanCompounds" }
			, consumer, handoff, pkg, environment
			, clean: copiedCleanEnvironment, sourcePath: path
			, fixture: { source: phpCompoundConsumer, request: phpCompoundRequest, removeHandoff: true } }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		for(const execution of installed.php.executions)
		{
			assert.ok(execution.observation.checks > 30000);
			assert.equal(execution.observation.primitives.length, 19);
			for(const [file, hash] of Object.entries(execution.observation.native_libraries)) assert.equal(hash, installed.php.packageReceipt.files[file].sha256);
			t.diagnostic(`${path}/${execution.mode}: ${execution.observation.checks} public assertions passed`);
		}
		const faults = await probePhpCompounds({ consumer, environment, installed, projection: compileCopiedPhpModel(model.bindingIr) });
		t.diagnostic(`${path}: ${faults.failures} injected failures, cleanup and unchanged deployment passed`);
		reports.push({ profile: "php-native", path, signatures, ...installed, faults
			, packages: receipt.packages, receiptSha256
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, sourceRemovedBeforeInstallation: true
			, handoffRemovedBeforeExecution: true });
		await rm(consumer, { recursive: true, force: true });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_PHP_COMPOUND_REPORT ?? "build/compounds/php-native.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
