/**
 * Reconstruct actual optional installed matrices and reject coordinated forgeries.
 * Synthetic relocation checks below are validator tests, not further execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertOwnedPerlCallbackVariant, assertOwnedPerlCallbackVariantMatrix
	, ownedPerlCallbackVariantReports } from "./owned-perl-callback-result-variant-evidence.mjs";
import { assertOwnedPerlCallbackVariantHandoff, readOwnedPerlCallbackVariantTar } from "./owned-perl-callback-result-variant-archives.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_EVIDENCE_TEST === "1";
const directory = process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_VARIANT_REPORTS ?? "build/owned-perl-callback-result-variants";
const reports = async () => Object.fromEntries(await Promise.all(ownedPerlCallbackVariantReports.map(async name =>
	[name, JSON.parse(await readFile(join(directory, name), "utf8"))])));
const source = readFile;
const first = item => item.observations[0];
const xs = item => item.observations[1];
const zero = "0".repeat(64);
const compact = value => JSON.stringify(JSON.parse(canonicalJson(value)));
const consumerMutation = change => item => {
	const run = first(item).executions[0]; change(run.observation); run.stdout = compact(run.observation) + "\n";
};
const producerMutation = change => item => {
	const run = item.producerExecutions[1]; change(run.response); run.stdout = canonicalJson(run.response);
};
const assetMutation = change => item => {
	const asset = first(item).assets.observations[0]; change(asset.observation); asset.execution.stdout = JSON.stringify(asset.observation);
};

test("Perl optional CPAN evidence reconstructs eight producers, exact archives and 64 public runs", { skip: !enabled }, async () => {
	const original = await reports();
	assert.deepEqual(await assertOwnedPerlCallbackVariantMatrix(original, source), {
		configurations: 4, producers: 8, prefixes: 32, runs: 64, checks: 3296
		, assetRejections: 192 });
	for(const [name, report] of Object.entries(original))
	{
		await assertOwnedPerlCallbackVariantHandoff(report, join(directory, report.savedHandoff.split("/").at(-1)));
		const relocated = JSON.parse(JSON.stringify(report).replaceAll(report.producerExecutions[0].cwd, "/ci/relocated-producer"));
		for(const run of [...relocated.producerExecutions, relocated.cliVerificationExecution]) run.command = "/opt/recorded/node";
		await assertOwnedPerlCallbackVariant(name, relocated, source);
		const read = new Set();
		await assertOwnedPerlCallbackVariant(name, report, async path => { read.add(path); return source(path); });
		for(const path of JSON.parse(await readFile("config/cli-package.v1.json", "utf8")).files) assert.ok(read.has(path), path);
		for(const path of ["tests/fixtures/structured-types/owned-perl-callback-results-variants-installed.pl"
			, "tests/fixtures/structured-types/owned-perl-installed-assets.pl"
			, "src/release/deterministic-archive.mjs"])
			assert.ok(read.has(path), path);
	}
});

test("Perl optional CPAN evidence rejects partial matrices, false capabilities and coordinated raw claims", { skip: !enabled }, async t => {
	const original = await reports(), mutations = [
		["unknown acceptance", item => item.acceptance = "passed"]
		, ["schema", item => item.schemaVersion++]
		, ["incomplete stage", item => item.stage = "installed"]
		, ["wrong source slot", item => item.mode = item.mode === "ordinary" ? "reviewed" : "ordinary"]
		, ["wrong capability slot", item => item.variant = item.variant === "host" ? "no-host" : "host"]
		, ["false producer interface", item => item.producerInterface = "synthetic"]
		, ["missing limitation", item => item.limitations.pop()]
		, ["authored configuration", item => item.sourceInputs.configuration.targets.cpan.module = "Forged"]
		, ["authored Lean", item => item.sourceInputs.lean += "\n"]
		, ["compiler identity", item => item.input.sourceIdentity.leanCompilerSha256 = zero]
		, ["elaborated metadata", item => item.input.metadata.diagnostics.push({ status: "ok" })]
		, ["consumer text and hash", item => { item.consumer.source += "\n"; item.consumer.sha256 = sha256(item.consumer.source); }]
		, ["source snapshot and hash", item => { const value = item.sources["Component.xs"]; value.source += "\n"; value.sha256 = sha256(value.source); value.bytes++; item.manifest.files["Component.xs"] = value.sha256; }]
		, ["missing source", item => delete item.sources["Component.xs"]]
		, ["unknown source", item => item.sources["synthetic.c"] = item.sources["Component.xs"]]
		, ["producer removed", item => item.producerExecutions.pop()]
		, ["producer duplicated", item => item.producerExecutions[1] = item.producerExecutions[0]]
		, ["independent archive changed", item => item.independentArchives[1].repeated.sha256 = zero]
		, ["independent receipt changed", item => item.independentPackageSetReceipt.packages[0].version = "0.999"]
		, ["reassembly archive changed", item => item.reassembly[1].repeated.bytes++]
		, ["producer target and raw", producerMutation(value => value.result.targets.push("php-native"))]
		, ["producer success and raw", producerMutation(value => value.status = "failed")]
		, ["producer package hash and raw", producerMutation(value => value.result.packages[0].sha256 = zero)]
		, ["CLI verification unsigned claim", item => { item.cliVerification.result.authenticated = true; item.cliVerificationExecution.stdout = canonicalJson(item.cliVerification); }]
		, ["missing ABI", item => item.abiQueries.pop()]
		, ["duplicate ABI", item => item.abiQueries[1] = item.abiQueries[0]]
		, ["ABI version and raw", item => { const query = item.abiQueries[0]; query.observation.perlVersion = "v5.36.0"; query.execution.stdout = compact(query.observation); }]
		, ["ABI threaded and raw", item => { const query = item.abiQueries[0]; query.observation.threaded = 0; query.execution.stdout = compact(query.observation); }]
		, ["missing prefix", item => item.observations.pop()]
		, ["duplicate prefix", item => item.observations[1] = item.observations[0]]
		, ["reordered prefixes", item => item.observations.reverse()]
		, ["source not removed", item => delete item.removedBeforeInstallation.project]
		, ["prefix not relocated", item => first(item).relocated = first(item).removed.originalPrefix]
		, ["tools remain", item => delete first(item).removed.tools]
		, ["missing role install", item => first(item).installs.pop()]
		, ["install manifest hash", item => first(item).installs[0].manifestIdentity.sha256 = zero]
		, ["install receipt hash", item => first(item).installs[0].receiptIdentity.sha256 = zero]
		, ["failed package tests", item => first(item).installs[0].commands[2].stdout += "not ok 2 - forged\n"]
		, ["prebuilt mode fallback", item => first(item).receipts[0].receipt.operation = "generated-xs-only"]
		, ["prebuilt receipt extra claim", item => first(item).receipts[0].receipt.compilerAccess = true]
		, ["compiled C identity", item => xs(item).installs[0].generatedC.sha256 = zero]
		, ["compiled XS identity", item => xs(item).installs[0].generatedXs.sha256 = zero]
		, ["compiled commands hash", item => xs(item).installs[0].commandsSha256 = zero]
		, ["compiled receipt extra claim", item => xs(item).receipts[0].receipt.synthetic = true]
		, ["native payload missing", item => first(item).nativePayload.pop()]
		, ["native payload identity", item => first(item).nativePayload[0].sha256 = zero]
		, ["one execution", item => first(item).executions.pop()]
		, ["third execution", item => first(item).executions.push(first(item).executions[0])]
		, ["checks and raw", consumerMutation(value => value.checks--)]
		, ["native phase and raw", consumerMutation(value => value.phases.native--)]
		, ["surface phase and raw", consumerMutation(value => value.phases.surface--)]
		, ["host phase and raw", consumerMutation(value => value.phases.host = 30)]
		, ["runtime ABI and raw", consumerMutation(value => value.threaded = 0)]
		, ["runtime extra counter and raw", consumerMutation(value => value.nativeOwners = 0)]
		, ["partial raw", item => first(item).executions[0].stdout = "{}\n"]
		, ["raw extra line", item => first(item).executions[0].stdout += "accepted\n"]
		, ["missing asset rejection", item => first(item).assets.observations.pop()]
		, ["duplicated asset rejection", item => first(item).assets.observations[1] = first(item).assets.observations[0]]
		, ["asset source", item => first(item).assets.sourceSha256 = zero]
		, ["asset checks and raw", assetMutation(value => value.checks = 6)]
		, ["asset broker counter and raw", assetMutation(value => value.brokerIdentities = 1)]
		, ["asset native counter and raw", assetMutation(value => value.nativeOwners = 0)]
		, ["asset unchanged", item => first(item).assets.observations[0].forged = first(item).assets.observations[0].original]
	];
	const processes = [
		item => item.producerExecutions[0], item => item.cliVerificationExecution
		, item => item.abiQueries[0].execution
		, item => first(item).installs[0].commands[1]
		, item => first(item).executions[0]
		, item => first(item).assets.observations[0].execution];
	for(const [index, process] of processes.entries()) for(const [key, value] of Object.entries({ code: 139, signal: "SIGSEGV", timedOut: true, spawnError: "ENOENT", stderr: "fault\n", unknownClaim: true }))
		mutations.push([`process ${index} ${key}`, item => process(item)[key] = value]);
	let rejected = 0;
	for(const [name, report] of Object.entries(original))
	{
		for(const [label, change] of mutations)
		{
			// Adding the already-present correct host phase is not a mutation.
			if(label === "host phase and raw" && report.variant === "host") continue;
			const altered = structuredClone(report); change(altered);
			await assert.rejects(() => assertOwnedPerlCallbackVariant(name, altered, source), undefined, `${name}: ${label}`); rejected++;
		}
		await assert.rejects(() => assertOwnedPerlCallbackVariant(name + ".unrecorded", report, source)); rejected++;
		for(const other of ownedPerlCallbackVariantReports.filter(value => value !== name))
		{ await assert.rejects(() => assertOwnedPerlCallbackVariant(other, report, source)); rejected++; }
		const incomplete = { ...original }; delete incomplete[name];
		await assert.rejects(() => assertOwnedPerlCallbackVariantMatrix(incomplete, source)); rejected++;
		const additional = { ...original, "preliminary-failed.json": report };
		await assert.rejects(() => assertOwnedPerlCallbackVariantMatrix(additional, source)); rejected++;
		await assert.rejects(() => assertOwnedPerlCallbackVariant(name, report, async path => {
			const bytes = await source(path); return path === "src/backends/perl/Build.pm" ? Buffer.concat([Buffer.from(bytes), Buffer.from("\nchanged source\n")]) : bytes;
		})); rejected++;
		if(report.variant === "no-host")
		{
			const altered = structuredClone(report);
			for(const run of altered.producerExecutions)
			{
				run.response.capabilities.ownedHostCallbacks = true; run.stdout = canonicalJson(run.response);
			}
			await assert.rejects(() => assertOwnedPerlCallbackVariant(name, altered, source)); rejected++;
		}
	}
	const item = original[ownedPerlCallbackVariantReports[0]];
	for(const target of ["package-set-receipt.json", "package-set-receipt.json.sha256", ...item.packageSetReceipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => artifact.path))])
	{
		await assert.rejects(() => assertOwnedPerlCallbackVariantHandoff(item, item.savedHandoff, async path => {
			const bytes = await readFile(path); return path === join(item.savedHandoff, target) ? Buffer.concat([bytes, Buffer.from("forged")]) : bytes;
		})); rejected++;
	}
	const component = item.packageSetReceipt.packages.find(pkg => pkg.role === "component").artifacts[0];
	const bytes = await readFile(join(item.savedHandoff, component.path)), tar = gunzipSync(bytes);
	const headerMutations = [
		value => value[0] ^= 1, value => value[156] = 50, value => value[257] = 0
		, value => { value.fill(0, 0, 100); value.write("LeanBridge-OwnedProbe-0.010/../escape", 0); }];
	for(const mutate of headerMutations)
	{
		const altered = Buffer.from(tar); mutate(altered);
		// Also fix checksum, so semantic header checks—not just checksum—reject.
		altered.fill(32, 148, 156);
		const checksum = altered.subarray(0, 512).reduce((sum, byte) => sum + byte, 0);
		altered.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, "ascii");
		assert.throws(() => readOwnedPerlCallbackVariantTar(gzipSync(altered), "LeanBridge-OwnedProbe-0.010")); rejected++;
	}
	const blockSize = offset => 512 + Math.ceil(Number.parseInt(tar.subarray(offset + 124, offset + 136).toString(), 8) / 512) * 512;
	const firstBlock = blockSize(0), secondBlock = blockSize(firstBlock);
	const padding = Buffer.from(tar), checksum = Buffer.from(tar);
	const firstSize = Number.parseInt(tar.subarray(124, 136).toString(), 8);
	assert.ok(firstSize % 512); padding[512 + firstSize] = 1; checksum[148] ^= 1;
	const malformed = [
		padding, checksum, Buffer.concat([tar, Buffer.alloc(512)])
		, Buffer.concat([tar.subarray(0, firstBlock), tar])
		, Buffer.concat([tar.subarray(firstBlock, firstBlock + secondBlock), tar.subarray(0, firstBlock), tar.subarray(firstBlock + secondBlock)])
		, tar.subarray(firstBlock)
	];
	for(const changedTar of malformed)
	{
		const altered = structuredClone(item), archive = gzipSync(changedTar);
		Object.assign(altered.packageSetReceipt.packages[0].artifacts[0], { bytes: archive.length, sha256: sha256(archive) });
		const receipt = Buffer.from(canonicalJson(altered.packageSetReceipt));
		await assert.rejects(() => assertOwnedPerlCallbackVariantHandoff(altered, item.savedHandoff, async path => {
			if(path === join(item.savedHandoff, "package-set-receipt.json")) return receipt;
			if(path === join(item.savedHandoff, "package-set-receipt.json.sha256")) return Buffer.from(sha256(receipt) + "  package-set-receipt.json\n");
			return path === join(item.savedHandoff, component.path) ? archive : readFile(path);
		})); rejected++;
	}
	t.diagnostic(`${rejected} coordinated optional-package forgeries rejected`);
});
