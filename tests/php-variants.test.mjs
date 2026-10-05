/**
 * Original native Composer variants from Lean source and independent reviewed IR.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { sourceApiIdentity } from "../src/analyze/semantic-model.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { phpVariantReviewedIr, phpVariantSignatures } from "./helpers/php-variant-fixture.mjs";
import { nativeFixtureEnvironment, copiedCleanEnvironment } from "./helpers/copied-fixture-install.mjs";
import { installedPhpCorpus } from "./helpers/type-corpus-php.mjs";
import { probePhpVariants } from "./helpers/php-variant-probe.mjs";
import { checkNativeVariantFaults } from "./helpers/native-variant-faults.mjs";

const contract = ir => ({
	declarations: ir.declarations.map(item => ({ id: item.id, parameters: item.parameters.map(p => p.type), result: item.result.type })).sort((a, b) => a.id.localeCompare(b.id))
	, types: ir.types.map(type => ({ id: type.id, name: type.name, kind: type.kind
		, fields: type.fields.map(({ name, type }) => ({ name, type }))
		, cases: type.cases.map(branch => ({ name: branch.name, fields: branch.fields.map(({ name, type }) => ({ name, type })) })) })).sort((a, b) => a.id.localeCompare(b.id))
});

test("installed native PHP variants preserve named constructors for weak and strict callers", { skip: process.env.LEAN_BRIDGE_PHP_VARIANT_TEST !== "1", timeout: 900_000 }, async t => {
	const reports = [], environment = { ...nativeFixtureEnvironment(["php-native"])
		, LEAN_BRIDGE_PHP: process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php"
		, LEAN_BRIDGE_COMPOSER: process.env.LEAN_BRIDGE_COMPOSER ?? "/usr/bin/composer" };
	const source = await readFile("tests/fixtures/variant-consumers/php.php", "utf8");
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-php-variant-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-php-variant-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-variants", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "Variants/Extra.lean", await readFile("tests/fixtures/variant-consumers/Extra.lean", "utf8"));
		await cp("tests/fixtures/variant-consumers/PhpVariants.lean", join(projectRoot, "PhpVariants.lean"));
		await saveLakeFile(projectRoot, "lakefile.toml", `${await readFile(join(projectRoot, "lakefile.toml"), "utf8")}\n[[lean_lib]]\nname = "PhpVariants"\n`);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Variants", "Variants.Extra", "PhpVariants"]
			, targets: { "php-native": { name: "lean-bridge-variants/api", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: phpVariantSignatures.map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(phpVariantReviewedIr()));
		t.diagnostic(`${path}: compiling fourteen variant exports with the explicit PHP echo wrapper`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["php-native"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.deepEqual(contract(model.bindingIr), contract(phpVariantReviewedIr()));
		const nativeProbe = await readFile("tests/fixtures/variant-consumers/native-probe.c", "utf8");
		const nativeFaults = await checkNativeVariantFaults(outputRoot, join(author, "faults"), environment, {
			consumerSource: "#define variants_echo variants_echo_signal\n" + nativeProbe
		});
		nativeFaults.baseConsumerSha256 = sha256(nativeProbe);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff), pkg = receipt.packages.find(item => item.role === "component");
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		await rm(author, { recursive: true, force: true });
		const installed = await installedPhpCorpus({ library: { phpModule: "LeanVariants" }
			, consumer, handoff, pkg, environment
			, clean: copiedCleanEnvironment, sourcePath: path
			, fixture: { source: mode => source.replace("declare(strict_types=0);", `declare(strict_types=${mode === "strict" ? 1 : 0});`)
				.replace("const PARAMETER_PREFIX = 'arg';", `const PARAMETER_PREFIX = '${path === "reviewed-ir" ? "value" : "arg"}';`)
				, request: () => canonicalJson({
					signatures: phpVariantSignatures, types: phpVariantReviewedIr().types
				})
				, removeHandoff: true }
		}).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		for(const execution of installed.php.executions)
		{
			assert.ok(execution.observation.checks > 20000 && execution.observation.calls > 4000 && execution.observation.rejected > 40);
			assert.equal(execution.observation.primitives.length, 19); assert.equal(execution.observation.families, 7); assert.equal(execution.observation.constructors, 18);
			assert.equal(Object.keys(execution.observation.native_libraries).length, 4);
			for(const [file, hash] of Object.entries(execution.observation.native_libraries)) assert.equal(hash, installed.php.packageReceipt.files[file].sha256);
			t.diagnostic(`${path}/${execution.mode}: ${execution.observation.checks} public assertions and ${execution.observation.rejected} rejected inputs passed`);
		}
		const faults = await probePhpVariants({ consumer, environment, installed
			, projection: compileCopiedPhpModel(model.bindingIr, { lists: true, variants: true }) });
		t.diagnostic(`${path}: ${faults.failures} injected conversion failures and ${faults.partialInputs} partial-input failures passed`);
		reports.push({ path, profile: "php-native", ...installed, faults, nativeFaults
			, contract: contract(model.bindingIr)
			, packages: receipt.packages, receiptSha256
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, sourceApiSha256: sourceApiIdentity(model.bindingIr).sha256
			, modelSha256: sha256(canonicalJson(model))
			, sourceRemovedBeforeInstallation: true
			, handoffRemovedBeforeExecution: true });
		await rm(consumer, { recursive: true, force: true });
	}
	assert.deepEqual(reports[0].observation.native_libraries, reports[1].observation.native_libraries);
	await saveLakeFile("build/variants", "php-native.json", canonicalJson({ schemaVersion: 1, reports }));
});
