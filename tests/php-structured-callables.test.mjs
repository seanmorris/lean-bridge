/**
 * Installed native PHP structured callbacks on both source authoring paths.
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
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { nativeFixtureEnvironment, copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { structuredCallableArities, structuredCallableExports, structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { installedPhpCorpus } from "./helpers/type-corpus-php.mjs";
import { probePhpStructuredCallables } from "./helpers/php-structured-callable-faults.mjs";

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
const shapes = ["array", "list", "option", "result", "tuple", "record", "variant", "alias"];

test("installed native PHP structured callbacks preserve nested values, exceptions and source-free closures", { skip: process.env.LEAN_BRIDGE_PHP_STRUCTURED_CALLABLE_TEST !== "1", timeout: 1_800_000 }, async t => {
	const reports = [], expected = signatures(structuredCallableReviewedIr());
	const consumerSource = await readFile("tests/fixtures/structured-callable-consumers/php.php", "utf8");
	const publisherSource = (await readFile("docs/publish/php.md", "utf8")).match(/### Export structured callbacks\n[\s\S]*?```lean\n([\s\S]*?)\n```/u)?.[1];
	assert.ok(publisherSource);
	const environment = { ...nativeFixtureEnvironment(["php-native"])
		, LEAN_BRIDGE_PHP: process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php"
		, LEAN_BRIDGE_COMPOSER: process.env.LEAN_BRIDGE_COMPOSER ?? "/usr/bin/composer" };
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-php-structured-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-php-structured-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release");
		const incoming = join(consumer, "incoming"), handoff = join(consumer, "relocated");
		await cp("tests/fixtures/onboarding/structured-callables", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "Documentation.lean", publisherSource + "\n");
		await runCopied(join(environment.LEAN_BRIDGE_LEAN_PREFIX, "bin/lean"), ["Documentation.lean"], projectRoot, environment);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Structured"]
			, targets: { "php-native": { name: "lean-bridge-structured/api", version: "1.0.0" } }
			, ...path === "ordinary-source" ? { exports: structuredCallableExports()
				, arities: Object.fromEntries(Object.entries(structuredCallableArities).filter(([name]) => structuredCallableExports().includes(name))) } : {} }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "structured.binding-ir.json", canonicalJson(structuredCallableReviewedIr()));
		t.diagnostic(`${path}: compiling eight structured PHP callback/closure shapes`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["php-native"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.deepEqual(signatures(model.bindingIr), expected);
		const receipt = await copyPackageSetHandoff(outputRoot, incoming), pkg = receipt.packages.find(entry => entry.role === "component");
		await verifyPackageSetReceipt({ receiptPath: join(incoming, "package-set-receipt.json") });
		await rm(author, { recursive: true, force: true });
		await rename(incoming, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		t.diagnostic(`${path}: offline Composer install, then repeated relocated weak/strict callers without compilers`);
		const installation = await installedPhpCorpus({ library: { phpModule: "LeanStructured" }
			, consumer
			, handoff
			, pkg
			, environment
			, clean: copiedCleanEnvironment
			, sourcePath: path
			, fixture: { source: (mode, sourcePath) => consumerSource.replace("declare(strict_types=0);", `declare(strict_types=${mode === "strict" ? 1 : 0});`)
				.replace("const PARAMETER_PREFIX = 'arg';", `const PARAMETER_PREFIX = '${sourcePath === "reviewed-ir" ? "value" : "arg"}';`)
				, request: sourcePath => canonicalJson({ schemaVersion: 1, sourcePath, shapes })
				, removeHandoff: true } }).catch(error => {
					error.message += `: ${JSON.stringify(error.details)}`; throw error;
				});
		assert.deepEqual(installation.php.executions.map(entry => entry.mode), ["weak", "strict"]);
		for(const { mode, observation } of installation.php.executions)
		{
			assert.ok(observation.checks > 50000); assert.ok(observation.calls > 2500); assert.ok(observation.rejected > 600);
			assert.deepEqual(observation.shapes, shapes); assert.equal(observation.hostVersion, installation.php.version);
			assert.equal(Object.keys(observation.libraries).length, 4);
			const base = join(consumer, "php-native/relocated/vendor", pkg.name);
			for(const [file, hash] of Object.entries(observation.libraries))
			{
				assert.ok(file.startsWith(base + "/native/linux-x64/"));
				assert.equal(hash, installation.php.packageReceipt.files[file.slice(base.length + 1)].sha256);
			}
			t.diagnostic(`${path}/${mode}: ${observation.checks} checks, ${observation.calls} calls and ${observation.rejected} recovered rejections`);
		}
		const faults = await probePhpStructuredCallables({ consumer
			, environment
			, installed: installation
			, projection: compileCopiedPhpModel(model.bindingIr, { structuredCallables: true, lists: true, variants: true }) });
		t.diagnostic(`${path}: ${faults.faults} recovered conversion failures with exact closure and scratch cleanup`);
		reports.push({ profile: "php-native", path, installation, faults
			, signatures: expected, packages: receipt.packages
			, consumerSourceSha256: sha256(consumerSource)
			, publisherDocumentation: { sourceSha256: sha256(publisherSource), compiled: true }
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model)), receiptSha256
			, sourceRemovedBeforeInstallation: true
			, relocatedBeforeInstallation: true
			, handoffRemovedBeforeExecution: true
			, publicCallsUninstrumented: true });
		await rm(consumer, { recursive: true, force: true });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_PHP_STRUCTURED_CALLABLE_REPORT ?? "build/structured-callables/php-native.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
