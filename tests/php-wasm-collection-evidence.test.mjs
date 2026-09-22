/**
 * Bind wasm32 collection guarantees to installed archives and separate fault probes.
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
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { collectionReviewedIr, collectionSignatures } from "./helpers/collection-fixture.mjs";
import { primitiveFields } from "./helpers/record-fixture.mjs";
import { phpWasmCollectionConsumer, phpWasmCollectionRequest, phpWasmCollectionDocumentation } from "./helpers/php-wasm-collection-fixture.mjs";
import { phpWasmDriverHashes, phpWasmIsolationFlags } from "./helpers/type-corpus-php-wasm-evidence.mjs";
import { zendCollectionFaultIr, zendCollectionFaultProvider } from "./helpers/php-wasm-collection-faults.mjs";
import { zendAllocationHeader } from "./helpers/php-copied-zend.mjs";
import { zendListFaultIr } from "./helpers/php-wasm-list-faults.mjs";
import { zendCompoundFaultIr } from "./helpers/php-wasm-compound-faults.mjs";
import { zendAliasFaultIr } from "./helpers/php-wasm-alias-faults.mjs";
import { zendVariantFaultIr } from "./helpers/php-wasm-variant-faults.mjs";

const receipt = async () => JSON.parse(await readFile("docs/evidence/php-wasm-collections-20260922.json"));
const subset = (files, prefix) => Object.fromEntries(Object.entries(files).filter(([path]) => path.startsWith(prefix)).map(([path, value]) => [path.slice(prefix.length), value]));
const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));

test("PHP-Wasm collections bind public values and executable docs to original installed archives", async () => {
	const record = await receipt(), example = phpWasmCollectionDocumentation();
	assert.equal(record.schemaVersion, 1); assert.deepEqual(record.profiles, ["php-wasm"]); assert.equal(record.wordBits, 32);
	assert.deepEqual(sort(record.signatures), sort(collectionSignatures));
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(collectionReviewedIr())));
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	for(const [path, hash] of Object.entries(record.generatorSourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	const reports = record.executions.map(({ signaturesSha256, ...run }) => {
		assert.equal(signaturesSha256, sha256(canonicalJson(record.signatures)));
		return { ...run, signatures: record.signatures };
	});
	assert.equal(record.reportSha256, sha256(canonicalJson({ schemaVersion: 1, reports })));
	const arrangements = new Set(["node/embedded", "node/composer", "chromium/bundled"].flatMap(host =>
		["startup", "lazy"].flatMap(loading => ["weak", "strict"].map(mode => `${host}/${loading}/${mode}`))));
	for(const run of record.executions)
	{
		assert.equal(run.profile, "php-wasm"); assert.deepEqual(run.documentation, example);
		for(const flag of ["sourceRemovedBeforeInstallation", "handoffRemovedBeforeExecution"]) assert.equal(run[flag], true, flag);
		const evidence = run.phpWasm, files = evidence.deployment;
		for(const flag of phpWasmIsolationFlags) assert.equal(evidence[flag], true, flag);
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
			const source = phpWasmCollectionConsumer(mode, run.path);
			assert.equal(evidence.consumerSources[mode], sha256(source)); assert.equal(files[mode + ".php"].sha256, sha256(source));
			assert.doesNotMatch(source, /Internal\\|FFI|CData|lean_ctor_|::check[0-9]|::from[0-9]/u);
		}
		for(const arrangement of ["embedded", "composer"])
		{
			assert.equal(evidence.requests[arrangement], sha256(phpWasmCollectionRequest(arrangement)));
			assert.equal(files["request-" + arrangement + ".json"].sha256, evidence.requests[arrangement]);
		}
		assert.equal(run.packages.length, 3);
		for(const pkg of run.packages)
		{
			const archive = evidence.packageSet.archives.find(item => item.role === pkg.role);
			assert.equal(archive.sha256, pkg.artifacts[0].sha256); assert.equal(archive.name, pkg.name); assert.equal(archive.version, pkg.version);
			const src = pkg.role === "api" ? "composer/" : pkg.role + "/package/";
			const dst = (pkg.role === "api" ? "vendor/" : "node_modules/") + pkg.name + "/";
			assert.deepEqual(subset(files, dst), subset(evidence.packageSet.files, src));
			if(pkg.role !== "runtime") assert.ok(files[dst + "README.md"]);
		}
		assert.deepEqual(evidence.packageSet.files["composer/README.md"], evidence.packageSet.files["component/package/README.md"]);
		const component = "node_modules/" + run.packages.find(pkg => pkg.role === "component").name + "/compiled/";
		const runtime = "node_modules/" + run.packages.find(pkg => pkg.role === "runtime").name + "/compiled/";
		assert.deepEqual(files[component + evidence.component.library], evidence.component.wasmLibrary);
		assert.deepEqual(files[runtime + evidence.runtime.library], evidence.runtime.files[evidence.runtime.library]);
		assert.equal(evidence.composer.lock.packages.find(pkg => pkg.name === "brick/math").version, "1.0.0");
		assert.equal(evidence.executions.length, 12);
		assert.deepEqual(new Set(evidence.executions.map(e => `${e.realm}/${e.arrangement}/${e.loading}/${e.mode}`)), arrangements);
		const libraries = [basename(evidence.component.library), basename(evidence.runtime.library)].sort();
		for(const execution of evidence.executions)
		{
			const result = execution.observation;
			assert.equal(result.checks, 191569); assert.equal(result.calls, 4330); assert.equal(result.rejections, 73);
			assert.equal(result.word_bits, 32); assert.equal(result.php, "8.4.1"); assert.equal(result.records, 7); assert.equal(result.documentation, example.stdout);
			assert.deepEqual(result.primitives.map(item => item.name).sort(), Object.values(primitiveFields).sort());
			for(const primitive of result.primitives) assert.equal(primitive.checks, primitive.name === "bytes" ? 3091 : 2065);
			assert.equal(result.api, "/vendor/lean-bridge-collections/wasm/src/Api.php");
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
});

test("PHP-Wasm collection reproduction and current Zend failure probes retain their scope", async () => {
	const record = await receipt(), faults = record.faultProbe;
	assert.equal(record.faultReportSha256, sha256(canonicalJson(faults)));
	const ir = zendCollectionFaultIr(), generated = generateCopiedPhpZendAdapter(ir);
	const model = compileCopiedPhpModel(ir, { integerBits: 32 }), manifest = JSON.parse(generated["copied-zend-manifest.json"]);
	const extension = generated[`extension/${manifest.extension}.c`];
	assert.equal(faults.provider, "synthetic-not-Lean"); assert.equal(faults.bindingIrSha256, manifest.bindingIrSha256);
	assert.equal(faults.extensionSha256, sha256(extension)); assert.equal(faults.providerSha256, sha256(zendCollectionFaultProvider(ir)));
	assert.equal(faults.consumerSha256, sha256(await readFile("tests/fixtures/collection-consumers/php-wasm-faults.php")));
	const hooks = '#undef ZVAL_STRINGL\n#define ZVAL_STRINGL(z, s, n) do { fixture_before_string(); ZVAL_NEW_STR((z), zend_string_init((s), (n), 0)); } while (0)';
	assert.equal(faults.instrumentedSha256, sha256(`${zendAllocationHeader}\n${extension.replace('#include <limits.h>', `#include <limits.h>\n${hooks}`)}`));
	const functions = {};
	for(const fn of model.surface.functions.filter(fn => fn.field.startsWith("echo_")))
	{
		const entry = manifest.exports.find(item => item.function.endsWith("\\" + fn.field));
		const copy = model.surface.copy(fn.declaration.parameters[0].type);
		functions[fn.field] = { transport: entry.transport, to: `to${copy.index}` };
	}
	assert.equal(faults.requestSha256, sha256(canonicalJson({ functions })));
	assert.deepEqual(faults.executions.map(run => run.mode), ["weak", "strict"]);
	for(const run of faults.executions)
	{
		assert.deepEqual(run, { mode: run.mode, allocationFailures: 456
			, bailoutRecovery: 2, checks: 7216
			, emptyPoisonPointers: 12, malformedOutputs: 81, partialInputs: 32
			, primitives: Object.values(primitiveFields)
			, wireRejections: 120, oneClearPerNativeEntry: true, wordBits: 32 });
	}
	for(const key of ["archivesIdentical", "packageFilesIdentical", "nativeLibrariesIdentical", "publicObservationsIdentical"])
		assert.equal(record.reproduction[key], true, key);
	assert.equal(record.reproduction.runs.length, 2);
	for(const previous of record.reproduction.runs)
	{
		const run = record.executions.find(run => run.path === previous.path); assert.ok(run);
		assert.equal(previous.packagesSha256, sha256(canonicalJson(run.packages)));
		assert.equal(previous.packageFilesSha256, sha256(canonicalJson(run.phpWasm.packageSet.files)));
		assert.equal(previous.executionsSha256, sha256(canonicalJson(run.phpWasm.executions)));
		assert.equal(previous.componentSha256, run.phpWasm.component.wasmLibrary.sha256);
	}
	assert.deepEqual(record.regressions.map(run => run.name), ["lists", "compounds", "aliases", "variants", "callables", "ordinary"]);
	const probes = { lists: zendListFaultIr, compounds: zendCompoundFaultIr, aliases: zendAliasFaultIr, variants: zendVariantFaultIr };
	for(const run of record.regressions)
	{
		assert.equal(run.log.sha256, sha256(run.log.text)); assert.match(run.log.text, /# fail 0\n/u);
		assert.match(run.log.text, /# skipped 0\n/u);
		assert.ok(run.passed > 0);
		if(run.faultProbe)
		{
			const source = generateCopiedPhpZendAdapter(probes[run.name]());
			const metadata = JSON.parse(source["copied-zend-manifest.json"]);
			assert.equal(run.faultProbe.extensionSha256, sha256(source[`extension/${metadata.extension}.c`]));
			assert.equal(run.faultProbe.provider, "synthetic-not-Lean");
			for(const execution of run.faultProbe.executions) assert.equal(execution.bailoutRecovery, 2);
		}
	}
});

test("PHP-Wasm collections promote only their installed reviewed fields and signatures", async () => {
	const { document, ...contracts } = await readTypeSurface(), id = "php-wasm-collections-installed";
	const cells = typeSurfaceCells(document, contracts).filter(cell => cell.stages.installedExecution.evidence.includes(id));
	assert.equal(cells.length, 22);
	for(const cell of cells)
	{
		assert.equal(cell.profile, "php-wasm"); assert.equal(cell.path, "reviewed-ir");
		assert.equal(cell.stages.installedExecution.state, "passed");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.ok(workflow.includes("LEAN_BRIDGE_PHP_WASM_COLLECTION_TEST=1 node --test --test-concurrency=1 tests/php-wasm-collections.test.mjs tests/php-wasm-collection-contract.test.mjs tests/php-wasm-collection-zend.test.mjs"));
	for(const name of ["php-wasm", "php-wasm-zend-faults"]) assert.ok(workflow.includes(`test -s build/collections/${name}.json`));
});
