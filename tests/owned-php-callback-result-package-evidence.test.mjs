/**
 * Reconstruct original installed PHP observations and reject coordinated forgeries.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertOwnedPhpInstalledHandoffs, assertOwnedPhpInstalledLog
	, assertOwnedPhpInstalledMatrix, assertOwnedPhpInstalledReport
	, ownedPhpInstalledCases, ownedPhpInstalledReportRoot, readOwnedPhpInstalledEvidence
	, readOwnedPhpInstalledSource } from "./helpers/owned-php-callback-result-package-evidence.mjs";
import { readOwnedPhpCallbackZip } from "./helpers/owned-php-callback-result-package-zip.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_PHP_CALLBACK_RESULT_PACKAGE_EVIDENCE_TEST === "1";
const clone = value => structuredClone(value);
const zero = "0".repeat(64);
const raw = item => [...item.producerExecutions, ...item.installationExecutions
	, ...item.observations.map(value => value.execution)
	, ...item.assets.map(value => value.execution)
	, ...item.disk.samples.map(value => value.execution)];
const rewrite = value => { value.execution.stdout = JSON.stringify(value.observed).replaceAll("/", "\\/") + "\n"; };

test("six installed PHP reports authenticate original sources, handoffs and 300 raw executions", { skip: !enabled }, async t => {
	const evidence = await readOwnedPhpInstalledEvidence(), before = canonicalJson(evidence);
	const sources = new Set(), artifacts = new Set();
	const result = await assertOwnedPhpInstalledMatrix(evidence, {
		readSource: async path => { sources.add(path); return readOwnedPhpInstalledSource(path); }
		, readEvidence: async path => { artifacts.add(path); return readFile(path); }
	});
	assert.deepEqual(result, { reports: 6, producerBuilds: 12, handoffs: 12
		, rawExecutions: 300, aliases: 12, publicRuns: 24
		, publicChecks: 3344, assets: 180 });
	assert.equal(canonicalJson(evidence), before, "original report objects unchanged");
	const config = JSON.parse(await readFile("config/cli-package.v1.json"));
	for(const path of config.files) assert.ok(sources.has(path), `copied CLI source ${path}`);
	assert.ok(!sources.has("README.md") && !sources.has("package.json"), "generated CLI entries are not checkout root files");
	assert.equal(artifacts.size, 36, "two physical handoffs times three files times six cases");
	t.diagnostic(`${result.publicChecks} public checks, ${result.assets} asset cases, ${result.rawExecutions} raw executions, ${sources.size} source paths, ${artifacts.size} handoff files`);
});

test("installed PHP reports reject closed-schema and coordinated raw/identity forgeries", { skip: !enabled }, async t => {
	const evidence = await readOwnedPhpInstalledEvidence(); let rejected = 0;
	const mutations = [
		["mode swap", value => { value.mode = value.mode === "ordinary" ? "reviewed" : "ordinary"; }]
		, ["capability variant", value => { value.variant = "other"; }]
		, ["staging incomplete", value => { value.stage = "first-producer"; }]
		, ["producer interface", value => { value.producerInterface = "forged-cli"; }]
		, ["independent output aliases original", value => { value.producerExecutions[2] = clone(value.producerExecutions[1]); }]
		, ["verification alias", value => { value.verification.stdout += " "; }]
		, ["ABI alias", value => { value.installation.abiExecution.code = 1; }]
		, ["invented actual ABI", value => { value.installation.abi.version = "8.5.99"; }]
		, ["public count and raw", value => { value.observations[0].observed.consumer.checks++; rewrite(value.observations[0]); }]
		, ["public phase and raw", value => { value.observations[0].observed.consumer.phases.native--; rewrite(value.observations[0]); }]
		, ["live registry and raw", value => { value.observations[0].observed.resultSlots = 1; rewrite(value.observations[0]); }]
		, ["live states and raw", value => { value.observations[0].observed.registeredStates = 1; rewrite(value.observations[0]); }]
		, ["live broker and raw", value => { value.observations[0].observed.brokerIdentities = 1; rewrite(value.observations[0]); }]
		, ["native mappings and raw", value => { delete value.observations[0].observed.mappings[Object.keys(value.observations[0].observed.mappings)[0]]; rewrite(value.observations[0]); }]
		, ["public matrix reordered", value => { value.observations.reverse(); }]
		, ["asset matrix reordered", value => { value.assets.reverse(); }]
		, ["asset temperature and raw", value => { value.assets[0].observed.temperature = "warm"; rewrite(value.assets[0]); }]
		, ["asset diagnostic and raw", value => { value.assets[0].observed.diagnostic.message = "unrelated failure"; rewrite(value.assets[0]); }]
		, ["asset restore and raw", value => { value.assets[0].observed.restoredSha256 = zero; rewrite(value.assets[0]); }]
		, ["invented boundary and raw", value => { value.assets[0].observed.boundary = "all-public-calls"; rewrite(value.assets[0]); }]
		, ["source route", value => { value.sourceInputs.lean += "\n"; value.input.sourceIdentity.modules[0].source.sha256 = sha256(value.sourceInputs.lean); }]
		, ["compiler metadata", value => { value.input.metadata.producer.toolVersion = "forged"; }]
		, ["probe and digest", value => { value.probes.consumer.source += "\n"; value.probes.consumer.bytes++; value.probes.consumer.sha256 = sha256(value.probes.consumer.source); }]
		, ["opaque library and manifests", value => {
			const name = Object.keys(value.nativeEvidence.libraries)[0]; value.nativeEvidence.libraries[name] = zero;
			value.packageReceipt.files[`native/linux-x64/${name}`].sha256 = zero;
			value.bindingManifest.nativeEvidence.libraries[name] = zero;
		}]
		, ["coordinated archive identities", value => {
			value.originalArchive.sha256 = zero; value.independentArchive.sha256 = zero;
			value.reassembly.original.sha256 = zero; value.reassembly.repeated.sha256 = zero;
			value.reassembly.package.sha256 = zero; value.built.packages[0].sha256 = zero;
			value.packageSetReceipt.packages[0].artifacts[0].sha256 = zero;
			value.independentPackageSetReceipt = clone(value.packageSetReceipt);
			for(const execution of value.producerExecutions.slice(1, 3))
			{
				const parsed = JSON.parse(execution.stdout); parsed.result.packages[0].sha256 = zero;
				execution.stdout = canonicalJson(parsed);
			}
		}]
		, ["coordinated CLI inventory", value => {
			value.cli.files[0].sha256 = zero;
			const entries = Object.entries(value.cli).filter(([key]) => !["archive", "inventorySha256", "externalRegistryWrites"].includes(key));
			value.cli.inventorySha256 = sha256(canonicalJson(Object.fromEntries(entries)));
		}]
		, ["no physical independent handoff", value => { value.independentHandoff = value.savedHandoff; }]
		, ["unsafe disk count", value => { value.disk.samples[0].scratchBytes = Number.MAX_SAFE_INTEGER + 1; }]
		, ["below preflight floor", value => { value.disk.initialAvailable = 1024; }]
		, ["disk stdout disagreement", value => { value.disk.samples[0].execution.stdout = "0\t/forged\n"; }]
		, ["Composer online", value => { value.installationExecutions[3].env.COMPOSER_DISABLE_NETWORK = "0"; }]
		, ["Composer no reinstall", value => { value.installationExecutions.pop(); }]
		, ["opaque tool hash", value => { value.installation.hostSha256 = zero; }]
		, ["extra installed inventory", value => { value.inventory["forged.php"] = { bytes: 1, sha256: zero }; }]
	];
	for(const pin of ownedPhpInstalledCases)
	{
		const original = evidence.reports[pin.name];
		for(const [label, mutate] of mutations)
		{
			const value = clone(original); mutate(value); assert.notEqual(canonicalJson(value), canonicalJson(original), label);
			await assert.rejects(assertOwnedPhpInstalledReport(pin.name, value), undefined, label); rejected++;
		}
		for(const key of [null, ...Object.keys(original).filter(key => original[key] && typeof original[key] === "object" && !Array.isArray(original[key]))])
		{
			const value = clone(original); (key === null ? value : value[key]).forgedAcceptance = true;
			await assert.rejects(assertOwnedPhpInstalledReport(pin.name, value), /closed schema keys/u); rejected++;
		}
		for(let index = 0; index < 50; index++)
		{
			const value = clone(original); raw(value)[index].code = 17;
			await assert.rejects(assertOwnedPhpInstalledReport(pin.name, value), /raw process exit/u); rejected++;
		}
		for(const key of ["signal", "spawnError", "timedOut", "stdout", "stderr"])
		{
			const value = clone(original), entry = value.observations[0].execution;
			entry[key] = key === "timedOut" ? true : key === "signal" ? "SIGSEGV" : "forged diagnostic";
			await assert.rejects(assertOwnedPhpInstalledReport(pin.name, value)); rejected++;
		}
		const neighbor = evidence.reports[ownedPhpInstalledCases[(ownedPhpInstalledCases.indexOf(pin) + 1) % 6].name];
		const swaps = [
			value => { value.verification = clone(neighbor.verification); }
			, value => { value.installation.abiExecution = clone(neighbor.installation.abiExecution); }
			, value => {
				value.verification = clone(neighbor.verification);
				value.producerExecutions[3] = clone(neighbor.verification);
			}
			, value => {
				value.installation.abiExecution = clone(neighbor.installation.abiExecution);
				value.installationExecutions[0] = clone(neighbor.installation.abiExecution);
			}
			, value => { value.observations[0] = clone(neighbor.observations[0]); }
		];
		for(const swap of swaps)
		{
			const value = clone(original); swap(value);
			assert.notEqual(canonicalJson(value), canonicalJson(original));
			await assert.rejects(assertOwnedPhpInstalledReport(pin.name, value)); rejected++;
		}
	}
	t.diagnostic(`${rejected} changed report/schema/raw forgeries rejected`);
});

test("installed PHP evidence rejects terminal, source, handoff, ZIP and matrix forgeries", { skip: !enabled }, async t => {
	const evidence = await readOwnedPhpInstalledEvidence(); let rejected = 0;
	for(const pin of ownedPhpInstalledCases)
	{
		const item = evidence.reports[pin.name], original = evidence.logs[pin.name];
		const logs = [original + "\n"
			, original.replace("# pass 1", "# pass 0")
			, original.replace("# fail 0", "# fail 1")
			, original.replace("# skipped 0", "# skipped 1")
			, original.replace("ok 1 -", "not ok 1 -")
			, original.replace("1..1", "1..2")
			, original.replace("NODE_EXIT=0", "NODE_EXIT=17")
			, original.replace("TAP version 13\n", "")
			, original.replace(/# duration_ms .*\n/u, "")
			, original.replace("four public executions", "three public executions")
			, original.replace(item.directory, "/tmp/forged")
			, original.replace(item.savedHandoff, "/tmp/forged")
			, original.replace(/ {2}duration_ms: .*\n/u, "  duration_ms: NaN\n")
			, original.replace(/^# .*independent second producer.*\n/mu, "# forged\n")];
		for(const text of logs)
		{
			assert.notEqual(text, original, "terminal mutation changes original bytes");
			assert.throws(() => assertOwnedPhpInstalledLog(pin.name, text, item)); rejected++;
		}
		for(const root of [item.savedHandoff, item.independentHandoff])
		for(const relative of ["package-set-receipt.json", "package-set-receipt.json.sha256", `archives/${item.built.packages[0].archive}`])
		{
			const target = join(root, relative);
			await assert.rejects(assertOwnedPhpInstalledHandoffs(pin.name, item, async path => {
				const bytes = await readFile(path); if(path !== target) return bytes;
				const changed = Buffer.from(bytes); changed[0] ^= 1; return changed;
			})); rejected++;
		}
		await assert.rejects(readOwnedPhpInstalledEvidence(async path => {
			const bytes = await readFile(path); return path === join(ownedPhpInstalledReportRoot, pin.name) ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
		})); rejected++;
		await assert.rejects(assertOwnedPhpInstalledHandoffs(pin.name, item, async path => {
			const bytes = await readFile(path); if(!path.endsWith(".zip")) return bytes;
			const changed = Buffer.from(bytes); changed[0] ^= 1; return changed;
		})); rejected++;
	}
	const pin = ownedPhpInstalledCases[0], item = evidence.reports[pin.name];
	const sourcePaths = ["src/backends/php/owned-package.mjs"
		, "src/release/owned-composer.mjs", "src/release/deterministic-zip.mjs"
		, "src/build/native-project.mjs", "config/cli-package.v1.json"
		, "tests/helpers/owned-php-callback-result-installed.mjs"
		, "tests/helpers/owned-php-callback-result-execution.mjs"
		, "tests/helpers/owned-php-callback-result-composer.mjs"
		, "tests/helpers/owned-php-callback-result-producer.mjs"
		, "tests/owned-php-callback-result-packaging.test.mjs"
		, "tests/fixtures/structured-types/owned-php-callback-results.php"
		, "tests/fixtures/structured-types/owned-installed-php-callback-observer.php"
		, "tests/fixtures/structured-types/owned-installed-php-callback-assets.php"];
	for(const path of sourcePaths)
	{
		await assert.rejects(assertOwnedPhpInstalledReport(pin.name, item, async source => {
			const bytes = await readFile(source); return source === path ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
		}), undefined, path); rejected++;
	}
	const zip = await readFile(join(item.savedHandoff, "archives", item.built.packages[0].archive));
	const receipt = canonicalJson(item.packageReceipt), inventory = { ...item.packageReceipt.files
		, "lean-bridge/package-receipt.json": { bytes: Buffer.byteLength(receipt), sha256: sha256(receipt) } };
	const end = zip.length - 22, central = zip.readUInt32LE(end + 16);
	for(const offset of [0, 4, 6, 8, 10, 12, 14, 18, 22, 26, 28, 30, central, central + 38, central + 42, end, end + 8, end + 12, end + 16, end + 20])
	{
		const changed = Buffer.from(zip); changed[offset] ^= 1;
		assert.throws(() => readOwnedPhpCallbackZip(changed, inventory)); rejected++;
	}
	assert.throws(() => readOwnedPhpCallbackZip(Buffer.concat([zip, Buffer.from("extra")]), inventory)); rejected++;
	const matrixMutations = [value => { value.extra = true; }
		, value => { delete value.reports[pin.name]; }
		, value => { value.reports.extra = clone(item); }
		, value => { delete value.logs[pin.name]; }
		, value => { value.logs.extra = evidence.logs[pin.name]; }
		, value => { value.reports[pin.name] = clone(value.reports[ownedPhpInstalledCases[1].name]); }];
	for(const mutate of matrixMutations)
	{
		const value = clone(evidence); mutate(value);
		await assert.rejects(assertOwnedPhpInstalledMatrix(value)); rejected++;
	}
	const coordinated = clone(evidence);
	coordinated.reports[pin.name].observations[0].observed.consumer.checks++;
	rewrite(coordinated.reports[pin.name].observations[0]);
	coordinated.logs[pin.name] = coordinated.logs[pin.name].replace("102 public checks", "103 public checks");
	await assert.rejects(assertOwnedPhpInstalledMatrix(coordinated)); rejected++;
	t.diagnostic(`${rejected} terminal/source/physical-handoff/ZIP/matrix forgeries rejected; all mutations synthetic, no executions added`);
});
