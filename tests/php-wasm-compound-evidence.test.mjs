/**
 * Bind compound claims to installed wasm32 packages and separate Zend probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compoundPrimitives, compoundSignatures } from "./helpers/compound-fixture.mjs";
import { assertCompoundSourceHash } from "./helpers/compound-source-history.mjs";
import { phpWasmCompoundConsumer, phpWasmCompoundRequest } from "./helpers/php-wasm-compound-fixture.mjs";
import { phpWasmDriverHashes, phpWasmIsolationFlags } from "./helpers/type-corpus-php-wasm-evidence.mjs";
import { zendCompoundFaultIr, zendCompoundFaultProvider, zendCompoundFaultConsumer } from "./helpers/php-wasm-compound-faults.mjs";
import { generateCopiedPhpZendAdapter } from "../src/backends/php/copied-zend.mjs";

const subset = (files, prefix) => Object.fromEntries(Object.entries(files).filter(([path]) => path.startsWith(prefix)).map(([path, value]) => [path.slice(prefix.length), value]));
test("PHP-Wasm compound evidence covers installed public APIs and exact loading arrangements", async () => {
	// Preserve this historical run. Current converters have separate collection acceptance.
	const bytes = await readFile("docs/evidence/php-wasm-compounds-20260920.json");
	assert.equal(sha256(bytes), "780ef34b9cadb48dca793936ca1ad53342263cec8cbf07232e4b1e48d048aba6");
	const record = JSON.parse(bytes);
	assert.deepEqual(record.profiles, ["php-wasm"]); assert.equal(record.wordBits, 32);
	assert.deepEqual(record.signatures, compoundSignatures);
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const [path, hash] of Object.entries(record.sourceHashes)) assertCompoundSourceHash(path, await readFile(path), hash);
	const arrangements = new Set(["node/embedded", "node/composer", "chromium/bundled"].flatMap(host =>
		["startup", "lazy"].flatMap(loading => ["weak", "strict"].map(mode => `${host}/${loading}/${mode}`))));
	for(const run of record.executions)
	{
		assert.equal(run.profile, "php-wasm");
		for(const key of ["sourceRemovedBeforeInstallation", "handoffRemovedBeforeExecution"]) assert.equal(run[key], true, key);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		const evidence = run.phpWasm, files = evidence.deployment;
		for(const key of phpWasmIsolationFlags) assert.equal(evidence[key], true, key);
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
			assert.equal(evidence.consumerSources[mode], sha256(phpWasmCompoundConsumer(mode, run.path)));
			assert.equal(files[mode + ".php"].sha256, evidence.consumerSources[mode]);
		}
		for(const arrangement of ["embedded", "composer"])
		{
			assert.equal(evidence.requests[arrangement], sha256(phpWasmCompoundRequest(arrangement)));
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
			assert.equal(result.checks, 46162); assert.equal(result.word_bits, 32); assert.equal(result.php, "8.4.1");
			assert.deepEqual(result.primitives.map(item => item.name).sort(), [...compoundPrimitives].sort());
			assert.ok(result.primitives.every(item => item.checks > 2000));
			assert.equal(result.api, "/vendor/lean-bridge-compounds/wasm/src/Api.php");
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
	const faults = record.faultProbe, ir = zendCompoundFaultIr(), generated = generateCopiedPhpZendAdapter(ir);
	const manifest = JSON.parse(generated["copied-zend-manifest.json"]);
	assert.equal(faults.provider, "synthetic-not-Lean");
	assert.equal(faults.providerSha256, sha256(zendCompoundFaultProvider(ir)));
	assert.equal(faults.consumerSha256, sha256(zendCompoundFaultConsumer(manifest)));
	assert.deepEqual(faults.executions.map(run => run.mode), ["weak", "strict"]);
	for(const run of faults.executions) assert.deepEqual(run, { mode: run.mode, allocationFailures: 19, bailoutRecovery: 2, checks: 95, inactivePayloads: 3, malformedOutputs: 9, wordBits: 32 });
	const source = await readFile("tests/fixtures/compound-consumers/php-wasm.php", "utf8");
	assert.doesNotMatch(source, /Internal\\|FFI|CData|lean_ctor_|::check[0-9]|::from[0-9]/);
});
