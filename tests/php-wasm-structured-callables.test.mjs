/**
 * Source-free installed wasm32 structured callbacks in Node and Chromium.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { installCopiedPhpWasm } from "./helpers/copied-fixture-php-wasm.mjs";
import { structuredCallableArities, structuredCallableExports, structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { phpWasmStructuredCallableConsumer } from "./helpers/php-wasm-structured-callable-fixture.mjs";

const signatures = ir => {
	const type = ref => {
		if(ref.kind === "primitive") return ref;
		if(ref.kind === "apply") return { constructor: ref.constructor, arguments: ref.arguments.map(type) };
		const definition = ir.types.find(item => item.id === ref.id); assert.ok(definition, ref.id);
		if(definition.kind === "alias") return type(definition.target);
		if(definition.kind === "record") return { record: definition.fields.map(field => ({ name: field.name, type: type(field.type) })) };
		if(definition.kind === "variant") return { variant: definition.cases.map(branch => ({ name: branch.name, fields: branch.fields.map(field => ({ name: field.name, type: type(field.type) })) })) };
		assert.equal(definition.kind, "callback");
		return { callback: { parameters: definition.callable.parameters.map(site), result: site(definition.callable.result) } };
	};
	const site = value => ({ type: type(value.type), ownership: value.ownership, lifetime: value.lifetime });
	return ir.declarations.map(declaration => ({ id: declaration.id, parameters: declaration.parameters.map(site), result: site(declaration.result) })).sort((a, b) => a.id.localeCompare(b.id));
};

test("installed PHP-Wasm structured callbacks preserve eight copied shapes in every loading arrangement", { skip: process.env.LEAN_BRIDGE_PHP_WASM_STRUCTURED_CALLABLE_TEST !== "1", timeout: 1_800_000 }, async t => {
	const reports = [], expected = signatures(structuredCallableReviewedIr());
	const documentation = (await readFile("docs/php.md", "utf8")).match(/### Structured callback values\n[\s\S]*?```php\n([\s\S]*?)\n```/u)?.[1];
	const publisher = (await readFile("docs/publish/php.md", "utf8")).match(/### Export structured callbacks\n[\s\S]*?```lean\n([\s\S]*?)\n```/u)?.[1];
	assert.ok(documentation && publisher);
	const environment = nativeFixtureEnvironment(["php-wasm"]);
	if(environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME) environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME = environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME;
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-structured-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-structured-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release");
		const incoming = join(consumer, "incoming"), handoff = join(consumer, "relocated");
		await cp("tests/fixtures/onboarding/structured-callables", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "Documentation.lean", publisher + "\n");
		await runCopied(join(environment.LEAN_BRIDGE_LEAN_PREFIX, "bin/lean"), ["Documentation.lean"], projectRoot, environment);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Structured"]
			, targets: { "php-wasm": { npm: { name: "lean-bridge-structured-wasm", version: "1.0.0" }, composer: { name: "lean-bridge-structured/wasm", version: "1.0.0" } } }
			, ...path === "ordinary-source" ? { exports: structuredCallableExports()
				, arities: Object.fromEntries(Object.entries(structuredCallableArities).filter(([name]) => structuredCallableExports().includes(name))) } : {} }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "structured.binding-ir.json", canonicalJson(structuredCallableReviewedIr()));
		t.diagnostic(`${path}: compiling eight structured wasm32 callback/closure shapes`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["php-wasm"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "php-wasm/component/model.json"), "utf8"));
		assert.equal(model.pointerBits, 32); assert.deepEqual(signatures(model.bindingIr), expected);
		const readme = await readFile(join(outputRoot, "packages/php-wasm/component/package/README.md"), "utf8");
		assert.match(readme, /one to sixteen arguments and a result using primitives, arrays, Lists/u);
		assert.doesNotMatch(readme, /List callback payloads remain unsupported|compound callables and async reject/u);
		const receipt = await copyPackageSetHandoff(outputRoot, incoming);
		await verifyPackageSetReceipt({ receiptPath: join(incoming, "package-set-receipt.json") });
		await rm(author, { recursive: true, force: true });
		await rename(incoming, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		const source = await phpWasmStructuredCallableConsumer(path);
		t.diagnostic(`${path}: offline npm/Composer install, weak/strict callers, startup/lazy, Node/Chromium`);
		const observation = await installCopiedPhpWasm({ consumer, handoff
			, packages: receipt.packages, environment
			, fixture: { source: async () => source
				, success: "php-wasm-structured-callables-ok"
				, removeHandoff: true, attestDeployment: true
				, phpDocumentation: documentation
				, phpDocumentationOutput: "copied\nSome None\n"
				, phpInvalid: "try { LeanStructured\\call_array(['invalid'], fn($value) => $value); throw new Exception('Invalid array accepted'); } catch (TypeError $error) {}"
				, phpBailout: "LeanStructured\\call_array([new LeanStructured\\Some('owned at bailout')], fn($value) => exit(0)); throw new Exception('Exit returned');"
				, phpRecovery: "for ($i = 0; $i < 70; $i++) { same(reenter(12, $record), $record); }" } });
		assert.equal(observation.executions.length, 12);
		assert.ok(observation.executions.every(execution => execution.bailoutRecovery && execution.checks > 100000));
		assert.equal(observation.unchangedDeployment, true);
		assert.equal(observation.handoffRemovedBeforeExecution, true);
		assert.equal(observation.documentationExecutions, 12);
		reports.push({ path, profile: "php-wasm", signatures: expected
			, ...observation
			, packages: receipt.packages, receiptSha256
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, publisherDocumentation: { sourceSha256: sha256(publisher), compiled: true }
			, readmeSha256: sha256(readme)
			, sourceRemovedBeforeInstallation: true
			, handoffRelocatedBeforeInstallation: true });
		await rm(consumer, { recursive: true, force: true });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_PHP_WASM_STRUCTURED_CALLABLE_REPORT ?? "build/structured-callables/php-wasm.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
