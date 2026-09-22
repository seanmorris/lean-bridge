/**
 * Bind named PHP-Wasm variants to installed archives and isolated Zend probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { generateCopiedPhpZendAdapter } from "../src/backends/php/copied-zend.mjs";
import { phpVariantReviewedIr, phpVariantSignatures } from "./helpers/php-variant-fixture.mjs";
import { phpWasmVariantConsumer, phpWasmVariantRequest, phpWasmVariantContract } from "./helpers/php-wasm-variant-fixture.mjs";
import { zendVariantFaultIr, zendVariantFaultProvider } from "./helpers/php-wasm-variant-faults.mjs";
import { phpWasmDriverHashes, phpWasmIsolationFlags } from "./helpers/type-corpus-php-wasm-evidence.mjs";

const subset = (files, prefix) => Object.fromEntries(Object.entries(files).filter(([path]) => path.startsWith(prefix)).map(([path, value]) => [path.slice(prefix.length), value]));
test("PHP-Wasm variant evidence binds every named case to installed packages and loading modes", async () => {
	// Preserve this historical run. Current converters have separate collection acceptance.
	const bytes = await readFile("docs/evidence/php-wasm-variants-20260921.json");
	assert.equal(sha256(bytes), "794cb075cd6944224375594b46de4db2a8ea547129a4d8b85d39af0cec32f89c");
	const record = JSON.parse(bytes);
	assert.deepEqual(record.profiles, ["php-wasm"]); assert.equal(record.wordBits, 32);
	assert.deepEqual(record.signatures, phpVariantSignatures);
	assert.equal(record.primitives.length, 19);
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(phpVariantReviewedIr())));
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	assert.deepEqual(record.reproduction.reports.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const [path, hash] of Object.entries(record.sourceHashes))
		if(path !== "tests/php-wasm-variant-evidence.test.mjs") assert.equal(sha256(await readFile(path)), hash, path);
	const arrangements = new Set(["node/embedded", "node/composer", "chromium/bundled"].flatMap(host =>
		["startup", "lazy"].flatMap(loading => ["weak", "strict"].map(mode => `${host}/${loading}/${mode}`))));
	for(const run of record.executions)
	{
		assert.equal(run.profile, "php-wasm");
		for(const key of ["sourceRemovedBeforeInstallation", "handoffRemovedBeforeExecution"]) assert.equal(run[key], true, key);
		assert.equal(run.contractSha256, sha256(canonicalJson(phpWasmVariantContract(phpVariantReviewedIr()))));
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "sourceApiSha256", "modelSha256", "receiptSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		const evidence = run.phpWasm, files = evidence.deployment;
		const reproduced = record.reproduction.reports.find(item => item.path === run.path);
		assert.deepEqual(reproduced.packages, run.packages);
		assert.equal(reproduced.packageFilesSha256, sha256(canonicalJson(evidence.packageSet.files)));
		assert.equal(reproduced.executionsSha256, sha256(canonicalJson(evidence.executions)));
		assert.equal(reproduced.componentSha256, evidence.component.wasmLibrary.sha256);
		assert.equal(reproduced.packageFileCount, Object.keys(evidence.packageSet.files).length);
		assert.equal(reproduced.deploymentFileCount, Object.keys(files).length);
		assert.equal(reproduced.packageFileCount, 100);
		for(const key of phpWasmIsolationFlags) assert.equal(evidence[key], true, key);
		assert.equal(Object.keys(files).length, 257);
		assert.equal(evidence.host.version, "0.1.0"); assert.equal(evidence.component.pointerBits, 32);
		assert.equal(evidence.component.modelSha256, run.modelSha256);
		assert.equal(evidence.component.bindingIrSha256, run.bindingIrSha256);
		assert.equal(evidence.component.sourceIdentity.sourceTreeSha256, run.sourceTreeSha256);
		assert.deepEqual(subset(files, "node_modules/php-wasm/"), evidence.host.files);
		assert.equal(evidence.component.runtimeIdentity, sha256(canonicalJson(evidence.runtime)));
		assert.equal(evidence.driverSha256, phpWasmDriverHashes["driver.mjs"]);
		for(const [path, hash] of Object.entries(phpWasmDriverHashes)) assert.equal(files[path].sha256, hash);
		for(const mode of ["weak", "strict"])
		{
			assert.equal(evidence.consumerSources[mode], sha256(phpWasmVariantConsumer(mode, run.path)));
			assert.equal(files[mode + ".php"].sha256, evidence.consumerSources[mode]);
		}
		for(const arrangement of ["embedded", "composer"])
		{
			assert.equal(evidence.requests[arrangement], sha256(phpWasmVariantRequest(arrangement)));
			assert.equal(files["request-" + arrangement + ".json"].sha256, evidence.requests[arrangement]);
		}
		assert.equal(run.packages.length, 3);
		for(const pkg of run.packages)
		{
			const artifact = pkg.artifacts[0], packaged = evidence.packageSet.archives.find(item => item.role === pkg.role);
			assert.equal(packaged.sha256, artifact.sha256); assert.equal(packaged.name, pkg.name); assert.equal(packaged.version, pkg.version);
			const src = pkg.role === "api" ? "composer/" : pkg.role + "/package/";
			const dst = (pkg.role === "api" ? "vendor/" : "node_modules/") + pkg.name + "/";
			assert.deepEqual(subset(files, dst), subset(evidence.packageSet.files, src));
		}
		const component = "node_modules/" + run.packages.find(pkg => pkg.role === "component").name + "/compiled/";
		const runtime = "node_modules/" + run.packages.find(pkg => pkg.role === "runtime").name + "/compiled/";
		assert.deepEqual(files[component + evidence.component.library], evidence.component.wasmLibrary);
		assert.deepEqual(files[runtime + evidence.runtime.library], evidence.runtime.files[evidence.runtime.library]);
		const libraries = [basename(evidence.component.library), basename(evidence.runtime.library)].sort();
		assert.equal(evidence.composer.lock.packages.find(pkg => pkg.name === "brick/math").version, "1.0.0");
		assert.equal(evidence.executions.length, 12);
		assert.deepEqual(new Set(evidence.executions.map(e => `${e.realm}/${e.arrangement}/${e.loading}/${e.mode}`)), arrangements);
		for(const execution of evidence.executions)
		{
			const result = execution.observation;
			assert.equal(result.checks, 37701); assert.equal(result.calls, 4465); assert.equal(result.rejected, 59);
			assert.equal(result.families, 7); assert.equal(result.constructors, 18);
			assert.equal(result.word_bits, 32); assert.equal(result.php, "8.4.1");
			assert.deepEqual(result.primitives, record.primitives);
			assert.equal(result.api, "/vendor/lean-bridge-variants/wasm/src/Api.php");
			assert.deepEqual(execution.phases.map(phase => ({ ...phase, libraries: [...phase.libraries].sort() })),
				["ready", "autoload", "invalid", "complete"].map(stage => ({ stage, libraries: stage === "complete" || execution.loading === "startup" ? libraries : [] })));
			if(execution.realm === "chromium")
			{
				for(const request of execution.requests) assert.deepEqual({ bytes: request.bytes, sha256: request.sha256 }, files[request.path]);
				for(const identity of [evidence.component.wasmLibrary, evidence.runtime.files[evidence.runtime.library]])
					assert.equal(execution.requests.filter(request => request.sha256 === identity.sha256).length, 1);
			}
		}
	}
	const faults = record.faultProbe, ir = zendVariantFaultIr(), generated = generateCopiedPhpZendAdapter(ir);
	const manifest = JSON.parse(generated["copied-zend-manifest.json"]);
	assert.equal(faults.provider, "synthetic-not-Lean");
	assert.equal(faults.bindingIrSha256, manifest.bindingIrSha256);
	assert.equal(faults.providerSha256, sha256(zendVariantFaultProvider(ir)));
	assert.equal(faults.consumerSha256, sha256(await readFile("tests/fixtures/variant-consumers/php-wasm-faults.php")));
	assert.deepEqual(faults.executions.map(run => run.mode), ["weak", "strict"]);
	for(const run of faults.executions)
	{
		assert.equal(run.checks, 1040); assert.equal(run.allocationFailures, 63);
		assert.equal(new Set(run.constructors).size, 18); assert.equal(run.wordBits, 32);
		assert.equal(run.malformedTags, 7); assert.equal(run.malformedPayloads, 7);
		assert.equal(run.inactivePayloadCases, 8); assert.equal(run.wireRejections, 92);
		assert.equal(run.partialInputs, 32); assert.equal(run.bailoutRecovery, 2);
		assert.equal(run.oneClearPerNativeEntry, true);
	}
	const source = await readFile("tests/fixtures/variant-consumers/php-wasm.php", "utf8");
	assert.doesNotMatch(source, /Internal\\|FFI|CData|lean_ctor_|::check[0-9]|::from[0-9]/);
});

test("PHP-Wasm variants promote six copied cells and require installed CI checks", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts).filter(cell => cell.stages.installedExecution.evidence.includes("php-wasm-variants-installed"));
	assert.equal(cells.length, 6);
	for(const cell of cells)
	{
		assert.equal(cell.profile, "php-wasm"); assert.equal(cell.shape, "variant"); assert.ok(["parameter", "result", "field"].includes(cell.position));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["php-wasm-variants-installed"]); }
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.ok(workflow.includes("LEAN_BRIDGE_PHP_WASM_VARIANT_TEST=1 node --test --test-concurrency=1 tests/php-wasm-variants.test.mjs tests/php-wasm-variant-contract.test.mjs tests/php-wasm-variant-zend.test.mjs"));
	for(const name of ["php-wasm", "php-wasm-zend-faults"])
	{
		assert.ok(workflow.includes("test -s build/variants/" + name + ".json"));
		assert.ok(workflow.includes("            build/variants/" + name + ".json"));
	}
});
