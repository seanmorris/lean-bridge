/**
 * Installed wasm32 Lean compounds in offline npm and Composer deployments.
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
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { compoundReviewedIr, compoundSignatures } from "./helpers/compound-fixture.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { installedPhpWasmCorpus } from "./helpers/type-corpus-php-wasm-install.mjs";
import { phpWasmCompoundSettings, phpWasmCompoundConsumer, phpWasmCompoundRequest } from "./helpers/php-wasm-compound-fixture.mjs";

const enabled = process.env.LEAN_BRIDGE_PHP_WASM_COMPOUND_TEST === "1";
const type = value => value.kind === "primitive" ? value.name
	: ["array", "option"].includes(value.kind) ? { [value.kind]: type(value.element) }
		: ["result", "tuple"].includes(value.kind) ? { [value.kind]: value.arguments.map(type) }
			: { record: value.name, fields: Object.fromEntries(value.fields.map(field => [field.name, type(field.type)])) };

test("installed PHP-Wasm compounds preserve copied values in Node and Chromium", { skip: !enabled, timeout: 1_800_000 }, async t => {
	const reports = [];
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-compound-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-compound-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/npm-compounds", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Compounds"], targets: { "php-wasm": phpWasmCompoundSettings }
			, ...(path === "ordinary-source" ? { exports: compoundSignatures.map(entry => entry.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(compoundReviewedIr()));
		const environment = nativeFixtureEnvironment(["php-wasm"]);
		if(environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME) environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME = environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME;
		t.diagnostic(`${path}: compiling the 64-export wasm32 compound library`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["php-wasm"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "php-wasm/component/model.json")));
		assert.equal(model.pointerBits, 32);
		const signatures = model.exports.map(entry => ({ name: entry.name, parameters: entry.parameters.map(parameter => type(parameter.type)), result: type(entry.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(compoundSignatures));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		const packageSet = JSON.parse(await readFile(join(outputRoot, "packages/php-wasm/php-wasm-package-set.json")));
		await rm(author, { recursive: true, force: true });
		const installed = await installedPhpWasmCorpus({ t
			, library: { id: "compounds" }
			, consumer, handoff, receipt, packageSet, environment
			, clean: { ...copiedCleanEnvironment
				, LEAN_BRIDGE_PHP_SOURCE: "/unavailable/php"
				, LEAN_BRIDGE_PHP_EMSDK: "/unavailable/compiler"
				, LEAN_BRIDGE_PHP_COPIED_RUNTIME: "/unavailable/runtime" }
			, sourcePath: path
			, fixture: { settings: phpWasmCompoundSettings
				, source: phpWasmCompoundConsumer
				, request: phpWasmCompoundRequest, removeHandoff: true } });
		assert.equal(installed.phpWasm.executions.length, 12);
		for(const execution of installed.phpWasm.executions)
		{
			assert.ok(execution.observation.checks > 40000); assert.equal(execution.observation.word_bits, 32);
			assert.equal(execution.observation.primitives.length, 19);
			assert.equal(execution.phases.at(-1).libraries.length, 2);
			const initial = execution.loading === "lazy" ? 0 : 2;
			assert.ok(execution.phases.slice(0, -1).every(phase => phase.libraries.length === initial));
		}
		reports.push({ path, profile: "php-wasm", signatures
			, ...installed
			, packages: receipt.packages, receiptSha256
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, sourceRemovedBeforeInstallation: true
			, handoffRemovedBeforeExecution: true });
		await rm(consumer, { recursive: true, force: true });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_PHP_WASM_COMPOUND_REPORT ?? "build/compounds/php-wasm.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
