/**
 * Keep the PHP-Wasm owned checked-record hosted lane closed over its exact
 * per-mode reports, retained npm/Composer handoffs, Node and Chromium cells
 * and original API records, without ever accepting native PHP evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	phpWasmCopiedCompilerFiles, phpWasmCopiedPins, phpWasmCopiedProfile
} from "../../src/build/php-wasm-copied-artifacts.mjs";
import {
	packageSetReceiptName, writePackageSetReceipt
} from "../../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import {
	ownedCheckedRecordHostedLanes, ownedCheckedRecordHostedRoutes
	, ownedCheckedRecordHostedTestNames
} from "./owned-checked-record-hosted-contracts.mjs";
import {
	checkOwnedCheckedRecordHostedEvidence, writeOwnedCheckedRecordHostedEvidence
} from "./owned-checked-record-hosted-evidence.mjs";
import { ownedCheckedRecordEvidenceSources } from "./owned-checked-record-hosted-evidence-sources.mjs";
import { replayOwnedCheckedRecordHostedOutput } from "./owned-checked-record-hosted-output.mjs";
import {
	assertOwnedCheckedRecordPhpWasmModelCorpus, ownedCheckedRecordPhpWasmCorpora
	, ownedCheckedRecordPhpWasmCorpus
} from "./owned-checked-record-php-wasm-corpus.mjs";
import { ownedCheckedRecordMixedSelection } from "./owned-checked-record-mixed-fixture.mjs";
import { ownedCheckedRecordPhpWasmPeerSelection } from "./owned-checked-record-php-wasm-peer.mjs";
import { requiresOwnedCheckedRecordPhpWasmContexts } from "./owned-checked-record-php-wasm-context-evidence.mjs";
import { syntheticOwnedCheckedRecordPhpWasmContexts } from "./owned-checked-record-php-wasm-context-fixture.mjs";

const revision = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
const original = path => execFileSync("git", ["show", `${revision}:${path}`]);
const lane = ownedCheckedRecordHostedLanes["php-wasm"];

const fileId = name => ({ bytes: name.length, sha256: sha256(name) });
const without = (object, key) => Object.fromEntries(Object.entries(object)
	.filter(([name]) => name !== key));
const headers = ["lean.h", "lean_gmp.h", "lean_libuv.h", "config.h", "version.h"];

/**
 * Build a runtime manifest record the copied-runtime reader accepts.
 *
 * @param change - Optional manifest field overrides before naming.
 * @param edit - Optional runtime file inventory edit after naming.
 */
const runtimeFor = (change = {}, edit = files => files) => {
	const { emscriptenVersion, emscriptenCommit, emsdkCommit } = phpWasmCopiedPins;
	const inputFiles = Object.fromEntries([
		...headers.map(name => `cmake/include/lean/${name}`)
		, "cmake/lib/lean/libInit.a", "cmake/lib/lean/libleanrt.a"
		, "source/.lean-wasm-patched"].map(path => [path, fileId(path)]));
	const value = { schemaVersion: 1, profile: phpWasmCopiedProfile
		, pointerBits: 32, pins: phpWasmCopiedPins
		, compiler: { emsdkCommit
			, version: `emcc (Emscripten) ${emscriptenVersion} (${emscriptenCommit})`
			, files: Object.fromEntries(phpWasmCopiedCompilerFiles.map(path =>
				[path, fileId(path)])) }
		, inputs: { files: inputFiles, brokerSha256: sha256("broker")
			, libuvSha256: sha256("libuv") }, ...change };
	const { profile, pins, compiler, inputs } = value;
	const key = sha256(canonicalJson({ profile, pins, compiler, inputs }))
		.slice(0, 20);
	const library = `lib/liblean_bridge_php_wasm_copied_${key}.so`;
	const files = Object.fromEntries([
		[library, fileId(library)]
		, ...headers.map(name => [`include/lean/${name}`
			, inputs.files[`cmake/include/lean/${name}`]])
		, ["include/lean_bridge_native_runtime.h"
			, fileId("include/lean_bridge_native_runtime.h")]]);
	const manifest = { ...value, library, files: edit(files) };
	return { manifest, identity: sha256(canonicalJson(manifest)) };
};
const { manifest: runtimeManifest, identity: runtimeIdentity } = runtimeFor();
const lean = original(
	"tests/fixtures/onboarding/owned-checked-records/OwnedCheckedRecords.lean");

const writeHandoff = async (root, mode, author, peer = false) => {
	const suffix = mode === "result-only" ? "-checked-record-result-only" : "-checked-record";
	const profile = { id: "php-wasm-copied-v1"
		, bindingIrSha256: sha256(`${mode}/${author}/binding`), runtimeIdentity };
	const packages = [], archives = [];
	const add = async (ecosystem, name, role, requires = []) => {
		const archive = `${name.replace("@", "").replaceAll("/", "-")}-1.0.0.${ecosystem === "npm" ? "tgz" : "zip"}`;
		const path = `packages/php-wasm/archives/${archive}`;
		const bytes = Buffer.from(`Inert ${ecosystem} ${role} archive for ${mode}/${author}\n`);
		await saveLakeFile(root, path, bytes);
		const identity = { bytes: bytes.length, sha256: sha256(bytes) };
		archives.push({ archive, ...identity });
		packages.push({ target: "php-wasm", ecosystem, name, version: "1.0.0"
			, profile: profile.id, role, runtimeIdentity
			, runtimeDelivery: role === "runtime" ? "provided" : "dependency"
			, requires, artifacts: [{ path, ...identity }] });
		return { ecosystem, name, version: "1.0.0" };
	};
	const runtime = await add("npm", "@lean-bridge/php-wasm-runtime", "runtime");
	const component = await add("npm", peer ? "@lean-bridge-test/owned-checked-record-peer" : `@lean-bridge-test/owned-php-wasm${suffix}`
		, "component", [runtime]);
	await add("composer", peer ? "lean-bridge-test/owned-checked-record-peer" : `lean-bridge-test/owned-php-wasm${suffix}`, "api"
		, [runtime, component]);
	const receipt = await writePackageSetReceipt({ root
		, component: { id: `owned-checked-records${peer ? "-peer" : ""}@1.0.0`
			, name: `owned-checked-records${peer ? "-peer" : ""}`
			, version: "1.0.0" }
		, source: { treeSha256: sha256(`${mode}/${author}/tree`) }
		, profiles: [profile], packages });
	return { receipt, archives };
};

const run = (mode, extra) => ({ ...extra
	, observed: { ownedCheckedRecord: true, mode, phpBits: 32
		, checks: mode === "full" ? 140 : 6
		, ...mode === "full" ? { heldOriginalError: true } : {} }
	, requestRecovery: true
	, cleaned: { liveIdentities: 0, runtimeInitRuns: 1 }
	, refreshed: { liveIdentities: 0, runtimeInitRuns: 1 } });

const corpusModel = (mode, corpus) => ({
	exports: (mode === "full" ? corpus.exports
		: ["newTicket", "serial", "claimFor"].map(name => `lean:OwnedCheckedRecords.${name}`))
		.map(bindingId => ({ bindingId }))
	, ownedGraph: { transport: "owned-zend-v1", ...mode === "result-only" ? {} : {
		inputTransfers: { exports: structuredClone(corpus.transfers) }
		, hostCallbacks: { signatures: [{ index: 0 }, { index: 1 }] } } }
});

const observationFor = async (packagingRoot, mode, reviewed, readOriginal) => {
	const author = reviewed ? "reviewed" : "ordinary";
	const resultOnly = mode === "result-only";
	const handoff = join(packagingRoot, lane.evidence, mode, author, "handoff");
	const { receipt, archives } = await writeHandoff(handoff, mode, author);
	const sourceIdentity = { ...reviewed ? { reviewedBindingIr: { synthetic: true } } : {}
		, modules: [{ module: "OwnedCheckedRecords", source: { sha256: sha256(lean) } }] };
	const component = receipt.component;
	const model = { pointerBits: 32, schemaVersion: resultOnly ? 6 : 8
		, bindingIrSha256: receipt.profiles[0].bindingIrSha256
		, ...corpusModel(mode, ownedCheckedRecordPhpWasmCorpus(readOriginal(
			"tests/fixtures/structured-types/owned-checked-record-php-wasm.php")))
		, sourceIdentity, component };
	const build = { status: "ok", result: { targets: ["php-wasm"] } };
	const consumer = readOriginal("tests/fixtures/structured-types/"
		+ `owned-checked-record-${resultOnly ? "result-only-" : ""}php-wasm.php`);
	const executions = [];
	for(const arrangement of ["embedded", "composer"])
		for(const loading of ["startup", "lazy"])
			for(const strict of [0, 1])
				executions.push(run(mode, { arrangement, loading, strict
					, libraries: ["component.so", "runtime.so"], invalidStayedCold: true }));
	const loaded = ["component.so", "runtime.so"];
	const phases = loading => ["ready", "autoload", "invalid", "complete", "recovered"]
		.map((stage, index) => ({ stage
			, libraries: loading === "lazy" && index < 3 ? [] : loaded }));
	const observation = { reviewed
		, inputs: { metadata: { synthetic: true }, sourceIdentity, component }
		, model, receipt: { runtimeIdentity }, rejected: ["php-wasm-component.json"]
		, browser: { bundleSha256: sha256(`${mode}/bundle`)
			, observations: ["embedded", "composer"].map(arrangement => ({ arrangement
				, version: "131.0.6778.33", executableSha256: sha256("chromium")
				, sourceSha256: sha256(`${mode}/${arrangement}/browser`)
				, executions: ["startup", "lazy"].flatMap(loading =>
					["weak", "strict"].map(caller => run(mode, { realm: "chromium"
						, arrangement: "bundled", loading, mode: caller
						, phases: phases(loading) }))) })) }
		, sourceFreeInstallation: true, handoffRemoved: true
		, cliBuild: build, repeatedCliBuild: build, packageSetReceipt: receipt
		, verification: { status: "ok", result: { verificationType: "local-package-set" } }
		, deterministicReassembly: true, receiptVerifiedWithoutProducer: true
		, packageReceipt: { archives, npmSettings: { name: receipt.packages.find(item => item.role === "component").name } }
		, reproducedArchives: archives
		, observer: { synthetic: true }, independentlyRebuiltExactly: true
		, sourceUnchanged: true, installed: { synthetic: true }, authorRemoved: true
		, consumerSha256: sha256(consumer), runnerSha256: sha256(`${mode}/runner`)
		, executions };
	if(requiresOwnedCheckedRecordPhpWasmContexts(readOriginal))
	{
		model.bindingIr = ownedCheckedRecordMixedSelection(`${author}-${mode}`).reviewedIr;
		const peerRoot = join(packagingRoot, lane.evidence, mode, author, "checked-peer-handoff");
		const peerHandoff = await writeHandoff(peerRoot, mode, author, true);
		const peer = { reviewed
			, model: { pointerBits: 32, schemaVersion: 6
				, component: peerHandoff.receipt.component, sourceIdentity
				, bindingIr: ownedCheckedRecordPhpWasmPeerSelection(reviewed).reviewedIr
				, bindingIrSha256: peerHandoff.receipt.profiles[0].bindingIrSha256
				, ...corpusModel("result-only", ownedCheckedRecordPhpWasmCorpora.mixed) }
			, receipt: { runtimeIdentity }, packageSetReceipt: peerHandoff.receipt
			, packageReceipt: { archives: peerHandoff.archives
				, npmSettings: { name: "@lean-bridge-test/owned-checked-record-peer" } }
			, reproducedArchives: peerHandoff.archives
			, cliBuild: build, repeatedCliBuild: build
			, sourceUnchanged: true, independentlyRebuiltExactly: true
			, verification: observation.verification };
		observation.crossRuntime = syntheticOwnedCheckedRecordPhpWasmContexts(observation, peer, mode, readOriginal);
	}
	return observation;
};

/**
 * Write one complete synthetic PHP-Wasm hosted output tree.
 *
 * @param root - Empty extracted-artifact root.
 * @param readOriginal - Source reader used only to create synthetic observations.
 */
const synthesizePhpWasmOutput = async (root, readOriginal = original) => {
	const packagingRoot = join(root, lane.packaging);
	const reports = [];
	for(const mode of lane.modes)
	{
		const report = { schemaVersion: 1
			, profile: `${lane.reportProfile}-${mode}`, mode
			, compiledLean: true, installedPackage: true
			, installedCli: { archive: "lean-bridge-cli.tgz", packagingSourceRemoved: true }
			, cliAdmission: true, runtimeSupplied: true, runtimeIdentity, runtimeManifest
			, observations: [await observationFor(packagingRoot, mode, false, readOriginal)
				, await observationFor(packagingRoot, mode, true, readOriginal)] };
		await saveLakeFile(packagingRoot, `${mode}.json`, canonicalJson(report));
		reports.push(report);
	}
	await saveLakeFile(packagingRoot, lane.report, canonicalJson({ schemaVersion: 1
		, profile: lane.reportProfile, reports }));
	const names = ownedCheckedRecordHostedTestNames(lane);
	const tap = ["", "> lean-bridge@0.1.0 test:owned-checked-record-php-wasm"
		, "> node --test tests/owned-checked-record-php-wasm-packaging.test.mjs", ""
		, "TAP version 13"
		, ...names.flatMap((name, index) => [`# Subtest: ${name}`
			, ...index < 2 ? ["# ordinary: installed embedded/startup/strict0"] : []
			, `ok ${index + 1} - ${name}`, "  ---", "  duration_ms: 1.5", "  ..."])
		, `1..${names.length}`, `# tests ${names.length}`, "# suites 0"
		, `# pass ${names.length}`, "# fail 0", "# cancelled 0", "# skipped 0"
		, "# todo 0", "# duration_ms 12.5", ""].join("\n");
	await saveLakeFile(root, lane.acceptance, tap);
	for(const log of lane.logs) await saveLakeFile(root, log, `${log}: pinned build\n`);
};

const temporary = async (t, prefix) => {
	const root = await mkdtemp(join(tmpdir(), prefix));
	t.after(() => rm(root, { recursive: true, force: true }));
	return root;
};

const synthesize = async (t, readOriginal = original) => {
	const root = await temporary(t, "lean-owned-hosted-php-wasm-");
	await synthesizePhpWasmOutput(root, readOriginal);
	return root;
};

const replay = root => replayOwnedCheckedRecordHostedOutput(
	"php-wasm", root, revision, original);

const packagingPath = (root, path) => join(root, lane.packaging, path);
const handoffPath = (root, mode, author) =>
	packagingPath(root, `${lane.evidence}/${mode}/${author}/handoff`);

/**
 * Change one per-mode report and keep the aggregate consistent with it.
 *
 * @param root - Synthetic extracted-artifact root.
 * @param mode - Report whose JSON is mutated.
 * @param mutate - In-place report mutation.
 */
const rewriteMode = async (root, mode, mutate) => {
	const report = JSON.parse(await readFile(packagingPath(root, `${mode}.json`), "utf8"));
	mutate(report);
	await writeFile(packagingPath(root, `${mode}.json`), canonicalJson(report));
	const aggregate = JSON.parse(await readFile(packagingPath(root, lane.report), "utf8"));
	aggregate.reports[lane.modes.indexOf(mode)] = report;
	await writeFile(packagingPath(root, lane.report), canonicalJson(aggregate));
};

test("owned checked-record PHP-Wasm corpus requires exact old or expanded consumer bytes", async t => {
	const path = "tests/fixtures/structured-types/owned-checked-record-php-wasm.php";
	const legacy = execFileSync("git", ["show", `83d8de7c2d69efede5a3cf701790cce71bdc9a48:${path}`]);
	const mixed = await readFile(path);
	assert.equal(ownedCheckedRecordPhpWasmCorpus(legacy), ownedCheckedRecordPhpWasmCorpora.legacy);
	assert.equal(ownedCheckedRecordPhpWasmCorpus(mixed), ownedCheckedRecordPhpWasmCorpora.mixed);
	for(const source of [Buffer.concat([legacy, Buffer.from("\n")]), Buffer.concat([mixed, Buffer.from("\n")])])
		assert.throws(() => ownedCheckedRecordPhpWasmCorpus(source), /Unknown.*consumer/u);
	for(const [name, source] of [["legacy", legacy], ["mixed", mixed]])
	{
		const corpus = ownedCheckedRecordPhpWasmCorpus(source);
		const other = ownedCheckedRecordPhpWasmCorpora[name === "legacy" ? "mixed" : "legacy"];
		const model = corpusModel("full", corpus);
		assertOwnedCheckedRecordPhpWasmModelCorpus(model, "full", corpus);
		assert.throws(() => assertOwnedCheckedRecordPhpWasmModelCorpus(model, "full", other), /exact PHP-Wasm corpus exports/u);
		assert.throws(() => assertOwnedCheckedRecordPhpWasmModelCorpus(model, "full", { ...corpus }), /exact producer source/u);
		const badTransfer = structuredClone(model);
		badTransfer.ownedGraph.inputTransfers.exports[0].parameters = [1];
		assert.throws(() => assertOwnedCheckedRecordPhpWasmModelCorpus(badTransfer, "full", corpus), /transfer bindings and positions/u);
		const duplicate = structuredClone(model);
		duplicate.exports[1] = duplicate.exports[0];
		assert.throws(() => assertOwnedCheckedRecordPhpWasmModelCorpus(duplicate, "full", corpus), /exact PHP-Wasm corpus exports/u);
		assertOwnedCheckedRecordPhpWasmModelCorpus(corpusModel("result-only", corpus), "result-only", other);
		// These inert archives exercise the checker, not installed runtime acceptance.
		const reader = name => name === path ? source : original(name);
		const root = await synthesize(t, reader);
		assert.equal((await replayOwnedCheckedRecordHostedOutput("php-wasm", root, revision, reader)).routes.length, 4);
		await rewriteMode(root, "full", report => {
			for(const observation of report.observations)
				Object.assign(observation.model, corpusModel("full", other));
		});
		await assert.rejects(replayOwnedCheckedRecordHostedOutput("php-wasm", root, revision, reader), /exact PHP-Wasm corpus exports/u);
	}
});

test("owned checked-record PHP-Wasm hosted output replays all four routes", async t => {
	const accepted = await replay(await synthesize(t));
	assert.equal(accepted.lane, "php-wasm");
	assert.equal(accepted.producerCommit, revision);
	assert.equal(accepted.tests, 5);
	assert.deepEqual(accepted.routes.map(route => route.route)
		, ownedCheckedRecordHostedRoutes);
	for(const route of accepted.routes)
	{
		assert.equal(route.archives, 3, route.route);
		assert.ok(route.archiveBytes > 0, route.route);
		assert.equal(route.checks.node.length, 8, route.route);
		assert.equal(route.checks.chromium.length, 8, route.route);
	}
	assert.equal(accepted.routes[0].path, "evidence/full/ordinary/handoff");
	assert.equal(accepted.routes[3].path, "evidence/result-only/reviewed/handoff");
});

test("owned checked-record PHP-Wasm hosted replay refuses altered, missing or widened evidence", async t => {
	const refuse = async (change, pattern) => {
		const root = await synthesize(t);
		await change(root);
		await assert.rejects(replay(root), pattern);
	};
	await refuse(root => appendFile(join(handoffPath(root, "full", "ordinary")
		, "packages/php-wasm/archives/lean-bridge-php-wasm-runtime-1.0.0.tgz"), "x")
	, /Archive differs|archive-mismatch/u);
	await refuse(root => writeFile(join(handoffPath(root, "result-only", "reviewed")
		, "OwnedCheckedRecords.lean"), "-- source\n")
	, /exactly the receipt-named set/u);
	await refuse(root => writeFile(packagingPath(root, "partial.json"), "{}\n")
		, /exactly the logs, reports and retained package sets/u);
	await refuse(root => rm(join(root, lane.logs[0]))
		, /host\.log is a required hosted log \(ENOENT\)/u);
	await refuse(async root => {
		const report = JSON.parse(await readFile(packagingPath(root, "full.json"), "utf8"));
		report.observations[0].executions[0].observed.checks += 1;
		await writeFile(packagingPath(root, "full.json"), canonicalJson(report));
	}, /aggregate must equal the per-mode report/u);
	await refuse(async root => {
		const aggregate = JSON.parse(await readFile(packagingPath(root, lane.report), "utf8"));
		aggregate.reports.pop();
		await writeFile(packagingPath(root, lane.report), canonicalJson(aggregate));
	}, /deep-equal|deepStrictEqual/u);
	await refuse(async root => {
		const aggregate = JSON.parse(await readFile(packagingPath(root, lane.report), "utf8"));
		await writeFile(packagingPath(root, lane.report), JSON.stringify(aggregate));
	}, /must be canonical/u);
	await refuse(root => rewriteMode(root, "full", report => {
		report.observations.pop();
	}), /ordinary then reviewed authors/u);
	await refuse(root => rewriteMode(root, "result-only", report => {
		report.observations[1].consumerSha256 = "0".repeat(64);
	}), /result-only\/reviewed: consumer source/u);
	await refuse(root => rewriteMode(root, "full", report => {
		report.observations[0].executions.pop();
	}), /every installed Node cell/u);
	await refuse(root => rewriteMode(root, "full", report => {
		report.observations[1].executions[3].observed.heldOriginalError = false;
	}), /full\/reviewed\/embedded\/lazy\/1/u);
	await refuse(root => rewriteMode(root, "full", report => {
		report.observations[0].browser.observations[1].executions[0].observed.checks = 100;
	}), /full\/ordinary\/chromium\/composer\/startup/u);
	await refuse(root => rewriteMode(root, "result-only", report => {
		report.observations[0].executions[0].observed.mode = "full";
	}), /result-only\/ordinary\/embedded\/startup\/0/u);
	await refuse(root => rewriteMode(root, "result-only", report => {
		report.observations[0].model.ownedGraph.hostCallbacks = { signatures: [] };
	}), /result-only\/ordinary/u);
	await refuse(root => rewriteMode(root, "full", report => {
		report.observations[1].model.sourceIdentity.modules[0].source.sha256 = "0".repeat(64);
		report.observations[1].inputs.sourceIdentity = report.observations[1].model.sourceIdentity;
	}), /full\/reviewed: compiled Lean source/u);
	await refuse(root => rewriteMode(root, "full", report => {
		report.observations[0].reproducedArchives[0].sha256 = "0".repeat(64);
	}), /independent rebuild must reproduce every archive/u);
	await refuse(root => rewriteMode(root, "full", report => {
		report.observations[0].packageReceipt.archives[0].archive = "renamed.tgz";
	}), /must name exactly the verified package archives/u);
	await refuse(root => rewriteMode(root, "result-only", report => {
		report.observations[1].runnerSha256 = "1".repeat(64);
	}), /one installed runner for both authors/u);
	await refuse(root => rewriteMode(root, "result-only", report => {
		report.runtimeIdentity = "2".repeat(64);
	}), /runtime identity must hash its exact manifest/u);
	await refuse(root => rewriteMode(root, "result-only", report => {
		const other = runtimeFor({ inputs: { ...runtimeManifest.inputs
			, brokerSha256: sha256("other broker") } });
		report.runtimeManifest = other.manifest;
		report.runtimeIdentity = other.identity;
		for(const observation of report.observations)
			observation.receipt.runtimeIdentity = other.identity;
	}), /installed runtime profile/u);
	await refuse(root => rewriteMode(root, "full", report => {
		report.observations[0].sourceFreeInstallation = false;
	}), /full\/ordinary: sourceFreeInstallation/u);
	await refuse(root => rewriteMode(root, "full", report => {
		report.observations[0].coexistence = { synthetic: true };
	}), /full\/ordinary: exact observation fields/u);
	const bothModes = async (root, mutate) => {
		for(const mode of lane.modes) await rewriteMode(root, mode, mutate);
	};
	const chromium = (root, mutate) => rewriteMode(root, "full", report => {
		mutate(report.observations[0].browser.observations[0].executions);
	});
	await refuse(root => chromium(root, cells => cells.pop())
		, /full\/ordinary\/embedded: every Chromium cell in order/u);
	await refuse(root => chromium(root, cells => {
		cells[1] = structuredClone(cells[0]);
	}), /every Chromium cell in order/u);
	await refuse(root => chromium(root, cells => {
		[cells[0], cells[2]] = [cells[2], cells[0]];
	}), /every Chromium cell in order/u);
	await refuse(root => chromium(root, cells => {
		cells[3].mode = "lenient";
	}), /every Chromium cell in order/u);
	await refuse(root => chromium(root, cells => {
		cells[0].realm = "firefox";
	}), /every Chromium cell in order/u);
	await refuse(root => rewriteMode(root, "result-only", report => {
		report.observations[1].browser.observations[1].version = "132.0.0.0";
	}), /one Chromium build for both arrangements/u);
	await refuse(root => bothModes(root, report => {
		report.runtimeIdentity = sha256("forged runtime");
	}), /runtime identity must hash its exact manifest/u);
	const forgedRuntime = change => root => bothModes(root, report => {
		const runtime = typeof change === "function"
			? change() : runtimeFor(change);
		report.runtimeManifest = runtime.manifest;
		report.runtimeIdentity = runtime.identity;
		for(const observation of report.observations)
			observation.receipt.runtimeIdentity = runtime.identity;
	});
	await refuse(forgedRuntime({ pins: { ...phpWasmCopiedPins, php: "8.3.0" } })
		, /PHP-Wasm runtime pins/u);
	await refuse(forgedRuntime({ profile: "php-wasm-copied-v0" })
		, /PHP-Wasm runtime profile/u);
	await refuse(forgedRuntime({ pointerBits: 64 }), /PHP-Wasm runtime pointer width/u);
	const compiler = runtimeManifest.compiler, inputs = runtimeManifest.inputs;
	const forgedCompiler = change => forgedRuntime({
		compiler: { ...compiler, ...change } });
	await refuse(forgedCompiler({ extra: true })
		, /PHP-Wasm compiler identity fields/u);
	await refuse(forgedCompiler({ emsdkCommit: "0".repeat(40) })
		, /PHP-Wasm compiler emsdk commit/u);
	await refuse(forgedCompiler({ version: "emcc 3.1.67" })
		, /PHP-Wasm compiler version/u);
	const [firstCompilerFile] = Object.keys(compiler.files);
	await refuse(forgedCompiler({
		files: without(compiler.files, firstCompilerFile) })
	, /PHP-Wasm compiler files/u);
	await refuse(forgedCompiler({ files: { ...compiler.files
		, [firstCompilerFile]: { bytes: 0, sha256: sha256("") } } })
	, /PHP-Wasm compiler file identity/u);
	await refuse(forgedRuntime({ inputs: { ...inputs, libuvSha256: "libuv" } })
		, /PHP-Wasm runtime input libuvSha256/u);
	await refuse(forgedRuntime({ inputs: { ...inputs, files: { ...inputs.files
		, "cmake/lib/lean/libInit.a": { bytes: -1, sha256: sha256("init") } } } })
	, /PHP-Wasm runtime input identity: cmake\/lib\/lean\/libInit\.a/u);
	await refuse(forgedRuntime({ inputs: { ...inputs
		, files: without(inputs.files, "cmake/lib/lean/libleanrt.a") } })
	, /PHP-Wasm runtime input member: cmake\/lib\/lean\/libleanrt\.a/u);
	await refuse(forgedRuntime(() => runtimeFor({}, files => ({ ...files
		, "include/lean/lean_gmp.h": fileId("other lean_gmp.h") })))
	, /PHP-Wasm runtime header lean_gmp\.h must match its target build/u);
	await refuse(forgedRuntime(() => runtimeFor({}, files =>
		without(files, "include/lean_bridge_native_runtime.h")))
	, /PHP-Wasm runtime member: include\/lean_bridge_native_runtime\.h/u);
	await refuse(forgedRuntime(() => {
		const library = "lib/liblean_bridge_php_wasm_copied_0.so";
		const manifest = { ...runtimeManifest, library };
		return { manifest, identity: sha256(canonicalJson(manifest)) };
	}), /library must name its build inputs/u);
	await refuse(root => rewriteMode(root, "full", report => {
		report.observations[1].receipt.runtimeIdentity = sha256("other runtime");
	}), /full\/reviewed: component receipt runtime/u);
	await refuse(root => writeFile(join(root, lane.logs[0]), "")
		, /host\.log must retain the hosted build output/u);
	await refuse(root => writeFile(join(root, lane.logs[1]), "  \n\t\n")
		, /runtime\.log must retain the hosted build output/u);
	await refuse(async root => {
		const path = join(root, lane.acceptance);
		const text = await readFile(path, "utf8");
		await writeFile(path, text.replace(/(ok 4 - [^\n]*)/u, "$1 # SKIP"));
	}, /SKIP/u);
	await refuse(async root => {
		const path = join(root, lane.acceptance);
		const text = await readFile(path, "utf8");
		await writeFile(path, text.replace(
			/ok 2 - installed PHP-Wasm result-only owned checked records execute in Node and Chromium/u
			, "ok 2 - installed PHP-Wasm result-only owned checked records execute in Node only"));
	}, /exactly the PHP-Wasm lane tests in order/u);
});

test("owned checked-record PHP-Wasm replay binds reports to retained package identities", async t => {
	const refuse = async (mutate, pattern) => {
		const root = await synthesize(t);
		for(const mode of lane.modes) await rewriteMode(root, mode, mutate);
		await assert.rejects(replay(root), pattern);
	};
	await refuse(report => {
		const other = runtimeFor({ inputs: { ...runtimeManifest.inputs
			, brokerSha256: sha256("uninstalled runtime") } });
		report.runtimeManifest = other.manifest;
		report.runtimeIdentity = other.identity;
		for(const observation of report.observations)
			observation.receipt.runtimeIdentity = other.identity;
	}, /installed runtime profile/u);
	await refuse(report => {
		for(const observation of report.observations)
			observation.model.bindingIrSha256 = sha256("uninstalled model");
	}, /installed runtime profile/u);
	await refuse(report => {
		for(const observation of report.observations)
		{
			const component = { id: "uninstalled@1.0.0"
				, name: "uninstalled", version: "1.0.0" };
			observation.model.component = component;
			observation.inputs.component = component;
		}
	}, /installed component identity/u);
	await refuse(report => { report.runtimeSupplied = false; }, /runtimeSupplied/u);
});

const archiveInputs = async (t, { enforce = "skipped", laneName = "php-wasm" } = {}) => {
	const root = await synthesize(t);
	const inputs = await temporary(t, "lean-owned-hosted-php-wasm-inputs-");
	const zip = join(inputs, "artifact.zip");
	execFileSync("/usr/bin/zip", ["-X", "-r", "-q", zip, lane.acceptance
		, ...lane.logs, lane.packaging], { cwd: root });
	const bytes = await readFile(zip);
	const record = ownedCheckedRecordHostedLanes[laneName];
	const hostedRun = { id: 4242, status: "completed", conclusion: "success"
		, head_sha: revision, path: lane.workflow
		, repository: { full_name: "seanmorris/lean-bridge" }
		, head_repository: { full_name: "seanmorris/lean-bridge" }
		, run_attempt: 1, event: "push"
		, html_url: "https://github.com/seanmorris/lean-bridge/actions/runs/4242"
		, created_at: "2026-10-24T00:58:21Z", updated_at: "2026-10-24T02:03:04Z" };
	const job = { id: 4343, run_id: hostedRun.id, head_sha: revision
		, status: "completed", conclusion: "success", name: lane.job
		, labels: ["ubuntu-24.04"], runner_name: "GitHub Actions 1"
		, runner_group_name: "GitHub Actions"
		, started_at: "2026-10-24T01:00:00Z", completed_at: "2026-10-24T02:00:00Z"
		, steps: [{ name: "Check out the exact revision and original evidence history"
			, status: "completed", conclusion: "success", number: 1 }
		, { name: record.acceptanceStep, status: "completed", conclusion: "success"
			, number: 13 }
		, { name: record.enforceStep, status: "completed", conclusion: enforce
			, number: 15 }] };
	const artifact = { id: 4444, name: `${lane.prefix}-${revision}`
		, expired: false, workflow_run: { id: hostedRun.id, head_sha: revision }
		, size_in_bytes: bytes.length, digest: `sha256:${sha256(bytes)}`
		, created_at: "2026-10-24T02:00:01Z", expires_at: "2026-11-23T02:00:01Z" };
	const selected = { "artifact-zip": zip };
	for(const [name, value] of Object.entries({ run: hostedRun, job, artifact }))
	{
		selected[`${name}-json`] = join(inputs, `${name}.json`);
		await writeFile(selected[`${name}-json`], `${JSON.stringify(value, null, 2)}\n`);
	}
	return { selected, inputs };
};

test("owned checked-record PHP-Wasm hosted archives authenticate, retain and replay originals", async t => {
	const { selected, inputs } = await archiveInputs(t);
	const destination = join(inputs, "evidence");
	const index = await writeOwnedCheckedRecordHostedEvidence({ lane: "php-wasm"
		, selected, destination, archiveCommit: revision });
	assert.equal(index.kind, "owned-checked-record-php-wasm-hosted-v1");
	assert.deepEqual(index.targets, ["php-wasm"]);
	assert.ok(index.limitations.some(item => item.includes("establishes nothing for native PHP")));
	assert.ok(!index.limitations.some(item => item.startsWith("PHP-Wasm,")));
	assert.deepEqual(index.selectedSources, ownedCheckedRecordEvidenceSources(
		"php-wasm", { producer: revision, consumer: revision, checker: revision
			, archiver: revision }));
	for(const path of ["hosted/output/owned-checked-record-php-wasm.log"
		, "hosted/output/owned-checked-record-php-wasm-host.log"
		, "hosted/output/owned-checked-record-php-wasm/full.json"
		, `hosted/output/owned-checked-record-php-wasm/evidence/result-only/reviewed/handoff/${packageSetReceiptName}`])
		assert.ok(index.files.some(file => file.path === path), path);
	assert.deepEqual(await checkOwnedCheckedRecordHostedEvidence("php-wasm", destination)
		, index);
	const indexPath = join(destination, "index.json");
	const widened = structuredClone(index);
	widened.limitations = widened.limitations.slice(1);
	await writeFile(indexPath, canonicalJson(widened));
	await assert.rejects(checkOwnedCheckedRecordHostedEvidence("php-wasm", destination));
	await writeFile(indexPath, canonicalJson(index));
	const retained = index.files.find(file => file.path.includes("/handoff/packages/php-wasm/archives/"));
	await appendFile(join(destination, retained.path), "x");
	await assert.rejects(checkOwnedCheckedRecordHostedEvidence("php-wasm", destination));
	const enforced = await archiveInputs(t, { enforce: "success" });
	await assert.rejects(writeOwnedCheckedRecordHostedEvidence({ lane: "php-wasm"
		, selected: enforced.selected, destination: join(enforced.inputs, "evidence")
		, archiveCommit: revision }), /skipped/u);
	const native = await archiveInputs(t, { laneName: "php" });
	await assert.rejects(writeOwnedCheckedRecordHostedEvidence({ lane: "php"
		, selected: native.selected, destination: join(native.inputs, "evidence")
		, archiveCommit: revision }));
});

test("owned checked-record PHP-Wasm source roles retain its workflow inputs and consumers", () => {
	const sources = ownedCheckedRecordEvidenceSources("php-wasm", { producer: revision
		, consumer: revision, checker: revision, archiver: revision });
	const has = (role, path) => sources.some(item => item.role === role && item.path === path);
	for(const path of [lane.test, lane.workflow, "scripts/bootstrap-php-wasm-ci.sh"
		, "scripts/build-lean-runtime.sh", "scripts/lean-runtime-config.sh"
		, "scripts/install-playwright-browsers.sh", "flake.lock"
		, "poc/lean-link-spike/bindings/php-wasm.package.json"
		, "tests/helpers/owned-php-wasm-packages.mjs"
		, "tests/helpers/owned-php-wasm-browser.mjs"
		, "tests/helpers/owned-php-wasm-runtime.mjs"])
		assert.ok(has("producer", path), path);
	assert.deepEqual(sources.filter(item => item.role === "consumer").map(item => item.path), [
		"tests/fixtures/structured-types/owned-checked-record-php-wasm.php"
		, "tests/fixtures/structured-types/owned-checked-record-result-only-php-wasm.php"
		, ...requiresOwnedCheckedRecordPhpWasmContexts(original)
			? ["tests/fixtures/structured-types/owned-checked-record-php-wasm-contexts.php"] : []
	].sort());
	if(requiresOwnedCheckedRecordPhpWasmContexts(original))
		assert.ok(has("producer", "tests/fixtures/structured-types/owned-checked-record-php-wasm-contexts.php"));
	assert.ok(!sources.some(item => item.path.endsWith("owned-checked-record-php.php")));
});
