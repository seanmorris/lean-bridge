/**
 * Hosted producer for separately instrumented nominal and recursive PHP-Wasm
 * graph packages. This gate proves compiler-input closure and reproducibility;
 * installed call traces are a distinct later gate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	checkNominalPrimitiveSubtypePhpWasmModel
	, nominalPrimitiveSubtypePhpWasmConfiguration
	, nominalPrimitiveSubtypePhpWasmReview
	, nominalPrimitiveSubtypePhpWasmSettings
} from "./nominal-primitive-subtype-php-wasm-fixture.mjs";
import {
	nominalPrimitiveSubtypeFixture, nominalPrimitiveSubtypeModule
} from "./nominal-primitive-subtype-fixture.mjs";
import {
	recursiveSubtypeConfiguration, recursiveSubtypeFixtureRoot
	, recursiveSubtypeModule, recursiveSubtypeRefinements, recursiveSubtypeReview
} from "./recursive-subtype-fixture.mjs";
import {
	checkRecursiveCheckedRecordPhpWasmModel
	, recursiveCheckedRecordPhpWasmConfiguration
	, recursiveCheckedRecordPhpWasmPackage
	, recursiveCheckedRecordPhpWasmReview
} from "./recursive-checked-record-php-wasm-fixture.mjs";
import { nativeFixtureEnvironment } from "./copied-fixture-install.mjs";
import { buildPhpWasmRefinementEntryProbe } from "./php-wasm-refinement-entry-build.mjs";
import { phpWasmRefinementEntrySource } from "./php-wasm-refinement-entry-source.mjs";
import {
	phpWasmRefinementEntryHostedSelection, phpWasmRefinementEntrySourceFixture
} from "./php-wasm-refinement-entry-source-fixtures.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const prefix = "LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_";
const hostedSelection = phpWasmRefinementEntryHostedSelection(process.env);
const enabled = hostedSelection.enabled;
const selectedFamilies = hostedSelection.families;
const selectedRoutes = hostedSelection.routes;

const familySpec = (family, route) => {
	if(family.startsWith("nominal-"))
	{
		const mode = family === "nominal-full" ? "full" : "result-only";
		return {
			root: nominalPrimitiveSubtypeFixture, module: nominalPrimitiveSubtypeModule
			, settings: nominalPrimitiveSubtypePhpWasmSettings
			, configuration: nominalPrimitiveSubtypePhpWasmConfiguration(route, mode)
			, review: nominalPrimitiveSubtypePhpWasmReview(mode)
			, verify: model => checkNominalPrimitiveSubtypePhpWasmModel(model, route, mode)
		};
	}
	if(family === "recursive-subtype")
	{
		const configuration = recursiveSubtypeConfiguration(route);
		return {
			root: recursiveSubtypeFixtureRoot, module: recursiveSubtypeModule
			, settings: configuration.targets["php-wasm"], configuration
			, review: recursiveSubtypeReview()
			, verify: model => {
				assert.equal(reviewedContractDifference(recursiveSubtypeReview(), model.bindingIr), null);
				assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, item.refinements]))
					, recursiveSubtypeRefinements);
			}
		};
	}
	const fixture = "recursive", pkg = recursiveCheckedRecordPhpWasmPackage(fixture);
	return {
		root: pkg.root, module: pkg.leanModule, settings: pkg.settings
		, configuration: recursiveCheckedRecordPhpWasmConfiguration(route, fixture)
		, review: recursiveCheckedRecordPhpWasmReview(fixture)
		, verify: model => checkRecursiveCheckedRecordPhpWasmModel(model, route, fixture)
	};
};

for(const family of selectedFamilies) for(const route of selectedRoutes)
test(`instrumented PHP-Wasm graph package closes ${family} ${route} compiler entries`, {
	skip: !enabled, timeout: 3_600_000
}, async t => {
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	execFileSync("git", ["diff", "--quiet", "HEAD", "--", "src", "tests", "scripts"]);
	const output = resolve(process.env[prefix + "OUTPUT"] ?? "build/php-wasm-refinement-entry", route, family);
	await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
	const fixture = familySpec(family, route), marker = phpWasmRefinementEntrySourceFixture(family);
	assert.equal(basename(marker.path), fixture.module + ".lean");
	const original = await readFile(marker.path, "utf8");
	const sourceProbe = phpWasmRefinementEntrySource(original, marker);
	const environment = nativeFixtureEnvironment(["php-wasm"]);
	const runtimeRoot = resolve(environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME
		?? environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME ?? "build/type-corpus/php-wasm-current-runtime");
	const emsdkRoot = resolve(environment.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm");
	const phpSource = resolve(environment.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src");
	const roots = [], builds = []; let complete = false;
	t.after(async () => {
		if(complete) await Promise.all(roots.map(root => rm(root, { recursive: true, force: true })));
		else t.diagnostic("Retained failed refinement-entry roots: " + JSON.stringify(roots));
	});
	for(const attempt of [0, 1])
	{
		const author = await mkdtemp(join(tmpdir(), `lean-bridge-${family}-${route}-`)); roots.push(author);
		const projectRoot = join(author, "project"), outputRoot = join(author, "release");
		await cp(fixture.root, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, fixture.module + ".lean", sourceProbe.source);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(fixture.configuration));
		if(route === "reviewed")
			await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(fixture.review));
		const built = await buildPhpWasmRefinementEntryProbe({
			projectRoot, outputRoot, recordRoot: join(output, `build-${attempt}`)
			, sourceProbe, settings: fixture.settings, checkModel: fixture.verify
			, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
			, runtimeRoot, emsdkRoot, phpSource
		});
		await verifyPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
		assert.equal(built.model.schemaVersion, route === "reviewed" ? 5 : 4);
		builds.push(built);
		await rm(author, { recursive: true });
	}
	assert.deepEqual(builds[1].receipt, builds[0].receipt, "independent probe packages reproduce");
	assert.deepEqual(builds[1].observation.library, builds[0].observation.library);
	assert.deepEqual(builds[1].observation.selected, builds[0].observation.selected);
	assert.deepEqual(builds[1].observation.definitionCounts, builds[0].observation.definitionCounts);
	await saveLakeFile(output, "summary.json", canonicalJson({
		schemaVersion: 1, scope: "separate-instrumented-probe"
		, producerCommit, family, route
		, source: {
			originalSha256: sourceProbe.originalSha256
			, probeSha256: sourceProbe.probeSha256
		}
		, receipt: builds[0].receipt
		, observations: builds.map(item => item.observation)
	}));
	complete = true;
});
