/**
 * Reject coordinated false CPAN producers, receipts and installed observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { selectCliPackageConfig } from "./cli-package-config-history.mjs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertOwnedPerlCallbackPackage, assertOwnedPerlCallbackPackageMatrix
	, ownedPerlCallbackPackageReports, assertOwnedPerlCallbackPacking } from "./owned-perl-callback-result-package-evidence.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_EVIDENCE_TEST === "1";
const directory = process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_PACKAGE_REPORTS ?? "build/owned-perl-callback-results";
const reports = async () => Object.fromEntries(await Promise.all(ownedPerlCallbackPackageReports.map(async name =>
	[name, JSON.parse(await readFile(join(directory, name), "utf8"))])));
const first = item => item.observations[0];
const buildXs = item => item.observations[1];
const asset = item => first(item).assets.observations[0];
const buildMutation = mutate => item => {
	mutate(item.cliBuilds[1]);
	item.cliExecutions[1].response = structuredClone(item.cliBuilds[1]);
	item.cliExecutions[1].stdout = canonicalJson(item.cliBuilds[1]);
};
const consumerMutation = mutate => item => {
	const execution = first(item).executions[0]; mutate(execution.observation);
	execution.stdout = JSON.stringify(JSON.parse(canonicalJson(execution.observation))) + "\n";
};
const assetMutation = mutate => item => {
	mutate(asset(item).observation); asset(item).execution.stdout = JSON.stringify(asset(item).observation);
};
const cliFileMutation = (path, mutate) => item => {
	mutate(item.cli.files.find(file => file.path === path));
	const inventory = Object.fromEntries(Object.entries(item.cli)
		.filter(([key]) => !["archive", "inventorySha256", "externalRegistryWrites"].includes(key)));
	item.cli.inventorySha256 = sha256(canonicalJson(inventory));
};

test("Perl callback package evidence reconstructs four producers and 32 installed public runs", { skip: !enabled }, async () => {
	await assertOwnedPerlCallbackPackageMatrix(await reports());
	await assertPortableIdentities();
	await assertCliInventorySelection();
});

// Synthetic changes exercise validator portability, not additional execution.
const assertPortableIdentities = async () => {
	for(const [name, original] of Object.entries(await reports()))
	{
		const changed = JSON.parse(JSON.stringify(original).replaceAll(original.cliExecutions[0].cwd, "/ci/relocated-producer"));
		for(const execution of [...changed.cliExecutions, changed.cliVerificationExecution])
			execution.command = "/opt/hostedtoolcache/node/22.99.1/x64/bin/node";
		const archiveHash = sha256("different opaque archive identity; this is not execution evidence");
		changed.packageSetReceipt.packages[0].artifacts[0].sha256 = archiveHash;
		changed.independentPackageSetReceipt = structuredClone(changed.packageSetReceipt);
		for(const build of changed.cliBuilds) build.result.packages[1].sha256 = archiveHash;
		for(const [index, execution] of changed.cliExecutions.entries())
		{
			execution.response = structuredClone(changed.cliBuilds[index]);
			execution.stdout = canonicalJson(execution.response);
		}
		for(const key of ["original", "repeated"])
		{
			changed.independentArchives[1][key].sha256 = archiveHash;
			changed.reassembly[1][key].sha256 = archiveHash;
		}
		changed.reassembly[1].receipt.sha256 = archiveHash;
		changed.cliVerification.result.receiptSha256 = sha256(canonicalJson(changed.packageSetReceipt));
		changed.cliVerificationExecution.stdout = canonicalJson(changed.cliVerification);
		const installed = first(changed), abi = installed.receipts[1].receipt.abi;
		const selected = changed.manifest.prebuilt.find(value => canonicalJson(value.abi) === canonicalJson(abi));
		const binaryHash = sha256("different opaque XS identity; this is not execution evidence");
		changed.manifest.files[selected.path] = binaryHash;
		installed.receipts[1].receipt.outputSha256 = binaryHash;
		installed.receipts[1].installed.sha256 = binaryHash;
		for(const value of installed.assets.observations.filter(value => value.asset === "OwnedProbe.so"))
			value.original.sha256 = binaryHash;
		await assertOwnedPerlCallbackPackage(name, changed);
		// This producer-fingerprint fixture is not an execution report and is not
		// inserted into the original runtime manifest. Full manifests separately
		// bind the packing object into runtimePackageIdentity (negative tests below).
		await assertOwnedPerlCallbackPacking({ ...original.runtimeManifest.runtimePacking
			, nodeVersion: "24.9.1", zlibVersion: "1.3.2-ci", icuVersion: "79.2"
			, collationLocale: "fr-FR" });
		const read = new Set();
		await assertOwnedPerlCallbackPackage(name, original, async path => {
			read.add(path); return readFile(path);
		});
		assert.ok(read.has("src/release/deterministic-archive.mjs"));
		assert.ok(read.has("tests/fixtures/structured-types/owned-perl-callback-results-installed.pl"));
		const config = await selectCliPackageConfig(original.cli);
		for(const path of config.files) assert.ok(read.has(path), path);
		// Generated CLI README/manifest are not the checkout's top-level files.
		assert.equal(read.has("README.md"), false); assert.equal(read.has("package.json"), false);
	}
};

test("Perl callback package evidence rejects coordinated producer, receipt and installed claims", { skip: !enabled }, async t => {
	const mutations = [
		["extra acceptance", item => { item.finalAcceptance = true; }]
		, ["schema", item => { item.schemaVersion++; }]
		, ["mode", item => { item.mode = item.mode === "ordinary" ? "reviewed" : "ordinary"; }]
		, ["variant", item => { item.variant = "host"; }]
		, ["missing limitations", item => { item.limitations = []; }]
		, ["installed native counters", item => { item.nativeCounters = [0, 0, 0]; }]
		, ["compiler metadata", item => { item.input.metadata.producer.toolVersion = "4.99.0"; }]
		, ["source identity", item => { item.input.sourceIdentity.leanCompilerSha256 = "0".repeat(64); }]
		, ["CPAN configuration", item => { item.input.sourceIdentity.exportConfigurationSource = "{}"; }]
		, ["extra source claim", item => { item.input.acceptance = true; }]
		, ["manifest extra claim", item => { item.manifest.acceptance = true; }]
		, ["runtime manifest extra claim", item => { item.runtimeManifest.acceptance = true; }]
		, ["inconsistent glibc floor", item => {
			item.runtimeManifest.glibcMinimumVersion = item.manifest.glibcMinimumVersion === "2.36" ? "2.38" : "2.36";
		}]
		, ["unsupported glibc floor", item => {
			item.manifest.glibcMinimumVersion = "2.99"; item.runtimeManifest.glibcMinimumVersion = "2.99";
		}]
		, ["packing extra claim", item => { item.runtimeManifest.runtimePacking.authenticated = true; }]
		, ["packing archive implementation", item => { item.runtimeManifest.runtimePacking.implementationSha256 = "0".repeat(64); }]
		, ["packing producer version without identity", item => { item.runtimeManifest.runtimePacking.nodeVersion = "24.9.1"; }]
		, ["packing producer locale without identity", item => { item.runtimeManifest.runtimePacking.collationLocale = "fr-FR"; }]
		, ["packing malformed Node", item => { item.runtimeManifest.runtimePacking.nodeVersion = "unknown"; }]
		, ["packing malformed locale", item => { item.runtimeManifest.runtimePacking.collationLocale = "en_US"; }]
		, ["runtime package identity", item => { item.runtimeManifest.runtimePackageIdentity = "0".repeat(64); }]
		, ["missing prebuilt ABI", item => { item.manifest.prebuilt.pop(); }]
		, ["wrong C source", item => { item.manifest.files["owned/src/owned_aggregates.c"] = "0".repeat(64); }]
		, ["wrong XS source", item => { item.manifest.files["Component.xs"] = "0".repeat(64); }]
		, ["wrong installer source", item => { item.manifest.files["LeanBridgeBuild.pm"] = "0".repeat(64); }]
		, ["wrong component binary", item => { item.componentReceipt.nativeLibrary.sha256 = "0".repeat(64); }]
		, ["CLI inventory extra claim", item => { item.cli.productionApproved = true; }]
		, ["CLI archive", item => { item.cli.archive.sha256 = "invalid"; }]
		, ["CLI source", item => { item.cli.files[0].sha256 = "0".repeat(64); }]
		, ...["schema/binding-ir-owned.schema.json"
			, "config/production-deployment-profile.v1.json"
			, "nix/perl-engine-source-boundary.json"
			, "poc/lean-link-spike/graph-lock.json"
			, "README.md", "package.json"].flatMap(path => [
			["coordinated CLI source digest " + path, cliFileMutation(path, file => { file.sha256 = "0".repeat(64); })]
			, ["coordinated CLI source size " + path, cliFileMutation(path, file => { file.bytes++; })]
			])
		, ["online CLI installation", item => { item.cliInstallation.offline = false; }]
		, ["missing producer", item => { item.cliBuilds.pop(); }]
		, ["missing raw producer", item => { item.cliExecutions.pop(); }]
		, ["producer process failure", item => { item.cliExecutions[1].code = 1; }]
		, ["producer crash", item => { item.cliExecutions[1].signal = "SIGSEGV"; }]
		, ["producer stderr", item => { item.cliExecutions[1].stderr = "failed"; }]
		, ["producer raw disagreement", item => { item.cliExecutions[1].stdout = "{}"; }]
		, ["producer status", buildMutation(value => { value.status = "error"; })]
		, ["producer exit", buildMutation(value => { value.exitCode = 1; })]
		, ["producer fake diagnostics", buildMutation(value => { value.diagnostics.push({ severity: "error" }); })]
		, ["producer partial ABI compilation", buildMutation(value => { value.progress.events.splice(3, 1); })]
		, ["producer no independent output", buildMutation(value => { value.result.output = value.result.output.replace(/independent$/u, "producer"); })]
		, ["producer extra result claim", buildMutation(value => { value.result.acceptance = true; })]
		, ["producer changed archive", buildMutation(value => { value.result.packages[1].sha256 = "0".repeat(64); })]
		, ["producer native runtime drift", buildMutation(value => { value.result.nativeRuntimeIdentity = "0".repeat(64); })]
		, ["producer wrong command", item => { item.cliExecutions[1].args[1] = "verify"; }]
		, ["producer inconsistent Node", item => { item.cliExecutions[1].command = "/different/bin/node"; }]
		, ["verify inconsistent Node", item => { item.cliVerificationExecution.command = "/different/bin/node"; }]
		, ["producer relative Node", item => {
			for(const execution of [...item.cliExecutions, item.cliVerificationExecution]) execution.command = "node";
		}]
		, ["producer non-Node executable", item => {
			for(const execution of [...item.cliExecutions, item.cliVerificationExecution]) execution.command = "/bin/true";
		}]
		, ["independent receipt drift", item => { item.independentPackageSetReceipt.packages[0].version = "0.011"; }]
		, ["coordinated receipt drift", item => {
			item.packageSetReceipt.packages[0].artifacts[0].sha256 = "0".repeat(64);
			item.independentPackageSetReceipt = structuredClone(item.packageSetReceipt);
		}]
		, ["missing independent archive", item => { item.independentArchives.pop(); }]
		, ["independent archive byte drift", item => { item.independentArchives[1].repeated.bytes++; }]
		, ["independent archive digest drift", item => { item.independentArchives[1].repeated.sha256 = "0".repeat(64); }]
		, ["coordinated rebuilt digest", item => {
			item.independentArchives[1].original.sha256 = "0".repeat(64);
			item.independentArchives[1].repeated.sha256 = "0".repeat(64);
		}]
		, ["missing archive reassembly", item => { item.reassembly.pop(); }]
		, ["reassembly byte drift", item => { item.reassembly[0].repeated.bytes++; }]
		, ["verification exit", item => { item.cliVerificationExecution.code = 1; }]
		, ["verification raw disagreement", item => { item.cliVerificationExecution.stdout = "{}"; }]
		, ["coordinated verification failure", item => {
			item.cliVerification.result.verified = false;
			item.cliVerificationExecution.stdout = canonicalJson(item.cliVerification);
		}]
		, ["coordinated authentication promotion", item => {
			item.cliVerification.result.authenticated = true;
			item.cliVerificationExecution.stdout = canonicalJson(item.cliVerification);
		}]
		, ["missing installed ABI", item => { item.observations.splice(2, 2); }]
		, ["duplicate installed ABI", item => { item.observations[2] = structuredClone(first(item)); }]
		, ["missing XS-only mode", item => { item.observations = item.observations.filter(value => value.mode !== "build-xs"); }]
		, ["installed extra scope", item => { first(item).sharedRelease = true; }]
		, ["different consumer source", item => { item.consumerSha256 = sha256("print qq(ok);"); }]
		, ["missing installation", item => { first(item).installs.pop(); }]
		, ["different archive installed", item => { first(item).installs[1].archive = "other.tar.gz"; }]
		, ["missing install command", item => { first(item).installs[1].commands.pop(); }]
		, ["install failure", item => { first(item).installs[1].commands[2].code = 1; }]
		, ["install crash", item => { first(item).installs[1].commands[2].signal = "SIGABRT"; }]
		, ["install stderr", item => { first(item).installs[1].commands[2].stderr = "broken"; }]
		, ["install raw tests absent", item => { first(item).installs[1].commands[2].stdout = ""; }]
		, ...["not ok 99 - unexplained failure", "  not ok 99 - nested failure"
			, "Bail out! unexpected failure"
			, "Result: FAIL"
			, "Result: NOTESTS"
			, "Failed 1/1 subtests", "Dubious, test returned 1", "Test Summary Report"]
			.map(line => ["contradictory install TAP " + line, item => { first(item).installs[1].commands[2].stdout += line + "\n"; }])
		, ["install compiler despite prebuilt", item => { first(item).installs[1].commands[1].stdout += "_xs-build/OwnedProbe.c\n"; }]
		, ["missing receipt", item => { first(item).receipts.pop(); }]
		, ["receipt wrong ABI", item => { first(item).receipts[1].receipt.abi.useithreads = ""; }]
		, ["receipt wrong mode", item => { first(item).receipts[1].receipt.operation = "generated-xs-only"; }]
		, ["installed XS wrong bytes", item => { first(item).receipts[1].installed.bytes++; }]
		, ["coordinated XS binary drift", item => {
			first(item).receipts[1].installed.sha256 = "0".repeat(64);
			first(item).receipts[1].receipt.outputSha256 = "0".repeat(64);
		}]
		, ["XS-only missing compile", item => { buildXs(item).receipts[1].receipt.commands.shift(); }]
		, ["XS-only fake compiler", item => { buildXs(item).receipts[1].receipt.commands[0][0] = "/bin/true"; }]
		, ["XS-only generated C invalid", item => { buildXs(item).receipts[1].receipt.generatedCSha256 = "invalid"; }]
		, ["XS-only coordinated invalid runtime output digest", item => {
			buildXs(item).receipts[0].receipt.outputSha256 = "not-a-sha256";
			buildXs(item).receipts[0].installed.sha256 = "not-a-sha256";
		}]
		, ...["1", 1.5, Number.MAX_SAFE_INTEGER + 1, 0, -1]
			.map(bytes => ["XS bytes " + JSON.stringify(bytes), item => {
				buildXs(item).receipts[0].installed.bytes = bytes;
			}])
		, ["XS-only wrong source", item => { buildXs(item).receipts[1].receipt.sourceSha256 = "0".repeat(64); }]
		, ["XS-only extra receipt claim", item => { buildXs(item).receipts[1].receipt.finalAcceptance = true; }]
		, ["missing repeat", item => { first(item).executions.pop(); }]
		, ["consumer failure", item => { first(item).executions[0].code = 1; }]
		, ["consumer crash", item => { first(item).executions[0].signal = "SIGSEGV"; }]
		, ["consumer stderr leak", item => { first(item).executions[0].stderr = "unreleased native ownership"; }]
		, ["consumer raw mismatch", item => { first(item).executions[0].stdout = "{}"; }]
		, ["consumer wrong interpreter", item => { first(item).executions[0].command = "/usr/bin/perl"; }]
		, ["consumer producer execution", item => { first(item).executions[0].cwd = item.cliExecutions[0].cwd + "/producer"; }]
		, ["coordinated fewer assertions", consumerMutation(value => { value.checks--; })]
		, ...["native", "host", "combined"].map(phase => ["coordinated missing " + phase, consumerMutation(value => { value.phases[phase]--; value.checks--; })])
		, ["consumer extra cleanup claim", consumerMutation(value => { value.nativeLive = 0; })]
		, ["consumer extra acceptance claim", consumerMutation(value => { value.finalAcceptance = true; })]
		, ["wrong asset probe", item => { first(item).assets.sourceSha256 = "0".repeat(64); }]
		, ["missing asset rejection", item => { first(item).assets.observations.pop(); }]
		, ["duplicate asset rejection", item => { first(item).assets.observations[1] = structuredClone(asset(item)); }]
		, ["wrong asset identity", item => { asset(item).asset = "Runtime.so"; }]
		, ["wrong original asset", item => { asset(item).original.sha256 = "0".repeat(64); }]
		, ["unchanged forged asset", item => { asset(item).forged = structuredClone(asset(item).original); }]
		, ["inconsistent forged warm bytes", item => { first(item).assets.observations[1].forged.sha256 = "0".repeat(64); }]
		, ["asset crash", item => { asset(item).execution.code = 139; }]
		, ["asset signal", item => { asset(item).execution.signal = "SIGSEGV"; }]
		, ["asset stderr", item => { asset(item).execution.stderr = "unreleased ownership"; }]
		, ["asset wrong mode", assetMutation(value => { value.mode = "warm"; })]
		, ["asset fewer assertions", assetMutation(value => { value.checks--; })]
		, ["asset leaked broker", assetMutation(value => { value.brokerIdentities++; })]
		, ["asset extra scope claim", assetMutation(value => { value.acceptance = true; })]
		, ["asset raw failure", item => { asset(item).execution.stdout = "{}"; }]
		, ["asset wrong argv", item => { asset(item).execution.args[2] = "/unrelated/OwnedProbe.so"; }]
	];
	const originals = await reports(); let rejected = 0;
	for(const name of ownedPerlCallbackPackageReports) for(const [label, mutate] of mutations)
	{
		const changed = structuredClone(originals[name]); mutate(changed);
		await assert.rejects(() => assertOwnedPerlCallbackPackage(name, changed), undefined, `${name}: ${label}`);
		rejected++;
	}
	const incomplete = [
		{}
		, { [ownedPerlCallbackPackageReports[0]]: originals[ownedPerlCallbackPackageReports[0]] }
		, { ...originals, "extra.json": originals[ownedPerlCallbackPackageReports[0]] }
	];
	for(const invalid of incomplete)
	{
		await assert.rejects(() => assertOwnedPerlCallbackPackageMatrix(invalid)); rejected++;
	}
	await assert.rejects(() => assertOwnedPerlCallbackPackage(ownedPerlCallbackPackageReports[0]
		, originals[ownedPerlCallbackPackageReports[0]], async path => path === "src/release/deterministic-archive.mjs"
			? Buffer.from("unrecognized archive implementation") : readFile(path)));
	rejected++;
	for(const changedPath of ["schema/binding-ir-owned.schema.json", "nix/perl-engine-source-boundary.json"])
	{
		await assert.rejects(() => assertOwnedPerlCallbackPackage(ownedPerlCallbackPackageReports[0]
			, originals[ownedPerlCallbackPackageReports[0]], async path => path === changedPath
				? Buffer.from("unrecognized shipped source") : readFile(path)));
		rejected++;
	}
	assert.deepEqual(await reports(), originals, "validation never rewrites original reports");
	t.diagnostic(`${rejected} altered CPAN reports rejected, including coordinated raw stdout changes`);
});

// A recorded inventory selects only among authenticated configurations; the full
// validator still rejects inventories that select a configuration they were not built from.
// Kept inside the reconstruction test so the CI evidence step keeps its fixed test count.
const assertCliInventorySelection = async () => {
	const current = JSON.parse(await readFile("config/cli-package.v1.json", "utf8"));
	const rehash = item => {
		const { archive, inventorySha256, externalRegistryWrites, ...inventory } = item.cli;
		void archive; void inventorySha256; void externalRegistryWrites;
		item.cli.inventorySha256 = sha256(canonicalJson(inventory));
	};
	for(const [name, original] of Object.entries(await reports()))
	{
		const selected = await selectCliPackageConfig(original.cli);
		assert.deepEqual([...selected.files, "README.md", "package.json"].sort(), original.cli.files.map(file => file.path).sort(), name);
		const added = structuredClone(original);
		added.cli.files.push({ path: "src/build/unrecorded.mjs", bytes: 1, sha256: "0".repeat(64), mode: 0o644 }); rehash(added);
		const removed = structuredClone(original);
		removed.cli.files = removed.cli.files.filter(file => file.path !== "src/build/canonical-build.mjs"); rehash(removed);
		for(const forged of [added, removed])
		{
			await assert.rejects(() => selectCliPackageConfig(forged.cli), /exactly one authenticated configuration/u, name);
			await assert.rejects(() => assertOwnedPerlCallbackPackage(name, forged), name);
		}
		// Pasting the current inventory selects the current configuration, but the
		// recorded installation, archive and receipts still bind the original build.
		const pasted = structuredClone(original);
		for(const path of current.files.filter(path => !pasted.cli.files.some(file => file.path === path)))
		{
			const bytes = await readFile(path);
			pasted.cli.files.push({ path, bytes: bytes.length, sha256: sha256(bytes), mode: 0o644 });
		}
		pasted.cli.files.sort((left, right) => left.path.localeCompare(right.path)); rehash(pasted);
		assert.deepEqual((await selectCliPackageConfig(pasted.cli)).files, current.files);
		await assert.rejects(() => assertOwnedPerlCallbackPackage(name, pasted), name);
	}
};
