/**
 * Installed native PHP callable acceptance under weak and strict PHP callers.
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
import { phpCallableSignatures, phpCallableArities, phpCallableConsumer, phpCallableRequest } from "./helpers/php-callable-fixture.mjs";
import { nativeFixtureEnvironment, copiedCleanEnvironment } from "./helpers/copied-fixture-install.mjs";
import { installedPhpCorpus } from "./helpers/type-corpus-php.mjs";

const enabled = process.env.LEAN_BRIDGE_PHP_CALLABLE_TEST === "1";
const type = value => value.kind === "primitive" ? value.name : { callback: { parameters: value.parameters.map(type), result: type(value.result) } };

test("installed native PHP callables preserve nineteen primitives on both source paths", { skip: !enabled, timeout: 1_800_000 }, async t => {
	const reports = [];
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-php-callable-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-php-callable-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/callables", projectRoot, { recursive: true });
		for(const name of ["Lifetimes", "Python", "Dotnet", "Jvm"]) await saveLakeFile(projectRoot, `Callables/${name}.lean`, await readFile(`tests/fixtures/callable-consumers/${name}.lean`, "utf8"));
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Callables", "Callables.Lifetimes", "Callables.Python", "Callables.Dotnet", "Callables.Jvm"]
			, targets: { "php-native": { name: "lean-bridge-callables/api", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: phpCallableSignatures.map(entry => entry.name), arities: phpCallableArities } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "callables.binding-ir.json", canonicalJson(callableReviewedIr(phpCallableSignatures)));
		const environment = { ...nativeFixtureEnvironment(["php-native"]), LEAN_BRIDGE_PHP: process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php", LEAN_BRIDGE_COMPOSER: process.env.LEAN_BRIDGE_COMPOSER ?? "/usr/bin/composer" };
		t.diagnostic(`${path}: compiling the 63-export native PHP callable library`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["php-native"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		const signatures = model.exports.map(entry => ({ name: entry.name, parameters: entry.parameters.map(parameter => type(parameter.type)), result: type(entry.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(phpCallableSignatures));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff), pkg = receipt.packages.find(entry => entry.role === "component");
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		await rm(directory, { recursive: true, force: true });
		t.diagnostic(`${path}: installing Composer archives offline, then repeating weak/strict callers after relocation`);
		const installed = await installedPhpCorpus({ library: { phpModule: "LeanCallables" }
			, consumer, handoff, pkg, environment
			, clean: copiedCleanEnvironment, sourcePath: path
			, fixture: { source: phpCallableConsumer, request: phpCallableRequest } }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		for(const execution of installed.php.executions)
		{
			assert.ok(execution.observation.checks > 50000);
			for(const [file, hash] of Object.entries(execution.observation.libraries))
			{
				const base = join(consumer, "php-native/relocated/vendor", pkg.name);
				assert.ok(file.startsWith(base + "/native/linux-x64/"));
				assert.equal(hash, installed.php.packageReceipt.files[file.slice(base.length + 1)].sha256);
			}
			t.diagnostic(`${path}/${execution.mode}: ${execution.observation.checks} assertions, repeated without compilers`);
		}
		reports.push({ path, profile: "php-native", signatures
			, ...installed
			, packages: receipt.packages, receiptSha256
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, sourceRemovedBeforeInstallation: true });
		await rm(consumer, { recursive: true, force: true });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_PHP_CALLABLE_REPORT ?? "build/callables/php-native.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
