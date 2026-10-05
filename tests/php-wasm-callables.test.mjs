/**
 * Real wasm32 Lean callables in relocated npm and Composer PHP consumers.
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
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { phpCallableSignatures, phpCallableArities } from "./helpers/php-callable-fixture.mjs";
import { nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { installCopiedPhpWasm } from "./helpers/copied-fixture-php-wasm.mjs";

const enabled = process.env.LEAN_BRIDGE_PHP_WASM_CALLABLE_TEST === "1";
const type = value => value.kind === "primitive" ? value.name : { callback: { parameters: value.parameters.map(type), result: type(value.result) } };

test("installed PHP-Wasm callables preserve nineteen primitives in Node and Chromium", { skip: !enabled, timeout: 1_800_000 }, async t => {
	const reports = [];
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-callable-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-callable-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/callables", projectRoot, { recursive: true });
		for(const name of ["Lifetimes", "Python", "Dotnet", "Jvm"]) await saveLakeFile(projectRoot, `Callables/${name}.lean`, await readFile(`tests/fixtures/callable-consumers/${name}.lean`, "utf8"));
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Callables", "Callables.Lifetimes", "Callables.Python", "Callables.Dotnet", "Callables.Jvm"]
			, targets: { "php-wasm": { npm: { name: "lean-bridge-callables-wasm", version: "1.0.0" }, composer: { name: "lean-bridge-callables/wasm", version: "1.0.0" } } }
			, ...(path === "ordinary-source" ? { exports: phpCallableSignatures.map(entry => entry.name), arities: phpCallableArities } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "callables.binding-ir.json", canonicalJson(callableReviewedIr(phpCallableSignatures)));
		const environment = nativeFixtureEnvironment(["php-wasm"]);
		if(environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME) environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME = environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME;
		t.diagnostic(`${path}: compiling the 63-export wasm32 callable library`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["php-wasm"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "php-wasm/component/model.json"), "utf8"));
		assert.equal(model.pointerBits, 32);
		const signatures = model.exports.map(entry => ({ name: entry.name, parameters: entry.parameters.map(parameter => type(parameter.type)), result: type(entry.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(phpCallableSignatures));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		await rm(author, { recursive: true, force: true });
		t.diagnostic(`${path}: offline installation, weak/strict callers, startup/lazy, Node/Chromium`);
		const source = (await readFile("tests/fixtures/callable-consumers/php-wasm.php", "utf8"))
			.replace("const PARAMETER_PREFIX = 'arg';", `const PARAMETER_PREFIX = '${path === "reviewed-ir" ? "value" : "arg"}';`);
		const observation = await installCopiedPhpWasm({ consumer
			, handoff
			, packages: receipt.packages
			, environment
			, fixture: { source: async () => source, success: "php-wasm-callables-ok"
				, phpInvalid: "try { LeanCallables\\call_uint32(1, fn($value) => $value); throw new Exception('Coerced uint32'); } catch (TypeError $error) {}"
				, phpBailout: "LeanCallables\\call_string('stop', fn($value) => exit(0)); throw new Exception('Exit returned');"
				, phpRecovery: "for ($i = 0; $i < 70; $i++) { if ((string) reenter(12) !== '42') throw new Exception('Bailout left a live Lean frame'); }" } });
		assert.equal(observation.executions.length, 12);
		assert.ok(observation.executions.every(execution => execution.bailoutRecovery));
		assert.ok(observation.checks > 50000);
		reports.push({ path
			, profile: "php-wasm"
			, signatures
			, ...observation
			, packages: receipt.packages
			, receiptSha256
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, sourceRemovedBeforeInstallation: true });
		await rm(consumer, { recursive: true, force: true });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_PHP_WASM_CALLABLE_REPORT ?? "build/callables/php-wasm.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
