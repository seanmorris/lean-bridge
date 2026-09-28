/**
 * Bind owned CPAN claims to exact source-free installed package observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedPerlXs } from "../../src/backends/perl/owned-xs.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./owned-dotnet-callback-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./owned-python-scalars-fixture.mjs";

export const ownedPerlPackageScope = {
	profiles: ["perl"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, installedCpan: true, cliIntegrated: true, abiVariants: 4
	, installationModes: ["prebuilt-only", "build-xs"], privateGmp: true
	, primitives: 19, publicCallbackExports: 51, transferredInputs: false
	, anchoredResults: false, wasm: false, promotedCells: 0
};
export const ownedPerlCommands = Object.fromEntries([
	["packages", "tests/owned-perl-package.test.mjs"]
	, ["documentation", "tests/owned-perl-documentation.test.mjs"]
	, ["coexistence", "tests/owned-perl-coexistence.test.mjs"]
	, ["runtime", "--test-concurrency=1 tests/owned-perl-runtime.test.mjs tests/owned-perl-values.test.mjs tests/owned-perl-conversions.test.mjs tests/owned-perl-xs.test.mjs tests/owned-perl-scalars.test.mjs tests/owned-perl-loader.test.mjs"]
].map(([name, args]) => [name, "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 node --test " + args]));
ownedPerlCommands.legacy = "LEAN_BRIDGE_PERL_NATIVE_TEST=1 LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 node --test --test-name-pattern='shared configuration drives|Perl installs ordinary' tests/perl-native.test.mjs";
const modes = ["prebuilt-only", "build-xs"];
const variants = ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"];
const variant = perl => {
	const abi = perl.match(/\/perl\/([^/]+)\/bin\/perl$/u)?.[1];
	assert.ok(variants.includes(abi), perl); return abi;
};
const digest = hash => assert.match(hash, /^[a-f0-9]{64}$/u);
const flags = (record, names) => {
	for(const name of names) assert.equal(record[name], true, name);
};
const matrix = observations => {
	assert.equal(observations.length, 8);
	assert.deepEqual(observations.map(item => {
		assert.ok(modes.includes(item.mode)); return variant(item.perl) + ":" + item.mode;
	}).sort(), variants.flatMap(abi => modes.map(mode => abi + ":" + mode)).sort());
};
const passing = (run, name, count) => {
	assert.equal(run.status, "passed");
	assert.equal(run.command, ownedPerlCommands[name]);
	assert.equal(sha256(run.text), run.sha256);
	for(const [key, value] of Object.entries({ tests: count, pass: count, fail: 0, skipped: 0, cancelled: 0 }))
		assert.match(run.text, new RegExp("^# " + key + " " + value + "$", "mu"));
	assert.doesNotMatch(run.text, /^not ok/mu);
};

/**
 * Verify a full acceptance record without widening its advertised scope.
 *
 * @param record - Current owned CPAN evidence and original installed reports.
 */
export const assertOwnedPerlExecution = async record => {
	assert.deepEqual(record.scope, ownedPerlPackageScope);
	assert.equal(record.acceptance, "passed");
	assert.deepEqual(Object.keys(record.runs).sort(), Object.keys(ownedPerlCommands).sort());
	for(const [name, count] of Object.entries({ packages: 4, documentation: 1, coexistence: 1, runtime: 16, legacy: 2 }))
		passing(record.runs[name], name, count);
	assert.deepEqual(Object.keys(record.packages).sort(), ["callbacks-ordinary", "callbacks-reviewed", "ordinary", "reviewed"]);
	const assetSource = sha256(await readFile("tests/fixtures/structured-types/owned-perl-installed-assets.pl"));
	for(const [name, report] of Object.entries(record.packages))
	{
		const complete = name.startsWith("callbacks-");
		flags(report, ["cliIntegrated", "installedPackage", "producerRemoved"
			, "receiptVerifiedWithoutProducer", "relocated", "sourceUnchanged"]);
		assert.equal(report.cliBuild.status, "ok");
		assert.deepEqual(report.cliBuild.result, report.packages);
		assert.deepEqual(report.packages.targets, ["cpan"]);
		assert.equal(report.packages.backend, "perl");
		assert.ok(Object.keys(report.files).length > 0);
		for(const [path, hash] of Object.entries(report.files))
		{ assert.ok(!path.startsWith("/") && !path.split("/").includes("..")); digest(hash); }
		assert.equal(report.packages.bindingIrSha256, report.owned.bindingIrSha256);
		assert.equal(report.owned.schemaVersion, 1);
		assert.equal(report.owned.gmpLibrary, "libgmp-lean-bridge.so.10");
		for(const key of ["bindingIrSha256", "publicHeaderSha256", "publicSourceSha256"]) digest(report.owned[key]);
		assert.equal(report.packageSetReceipt.profiles.length, 1);
		assert.equal(report.packageSetReceipt.profiles[0].bindingIrSha256, report.owned.bindingIrSha256);
		assert.equal(report.packageSetReceipt.packages.length, 2);
		assert.equal(report.packages.packages.length, 2);
		for(const pkg of report.packages.packages)
		{
			digest(pkg.sha256); assert.equal(pkg.abiVariants.length, 4);
			assert.equal(new Set(pkg.abiVariants).size, 4);
			for(const abi of pkg.abiVariants) digest(abi);
			const artifact = report.packageSetReceipt.packages.flatMap(item => item.artifacts)
				.find(item => item.path === "archives/" + pkg.archive);
			assert.equal(artifact.sha256, pkg.sha256); assert.ok(artifact.bytes > 0);
		}
		const expectedExports = generateOwnedPerlXs(complete ? ownedDotnetCallbacksReviewedIr()
			: ownedPythonScalarsReviewedIr(), "LeanBridge::OwnedProbe").functions.map(fn => fn.publicName).sort();
		assert.equal(report.consumerSha256, sha256(await readFile("tests/fixtures/structured-types/owned-perl-"
			+ (complete ? "signatures" : "installed-scalars") + ".pl")));
		matrix(report.observations);
		for(const { observed, assets, mode } of report.observations)
		{
			assert.equal(observed.checks, complete ? 115 : 134);
			assert.deepEqual(observed.exports, expectedExports);
			if(complete)
			{ assert.equal(observed.primitives, 19); assert.equal(observed.brokerIdentities, 0); }
			else assert.equal(observed.live, 0);
			assert.equal(assets.sourceSha256, assetSource);
			assert.equal(assets.observations.length, 6);
			const expected = ["OwnedProbe.so", report.owned.gmpLibrary, report.owned.componentLibrary]
				.flatMap(asset => ["cold", "warm"].map(mode => asset + ":" + mode));
			assert.deepEqual(assets.observations.map(item => item.asset + ":" + item.mode), expected);
			for(const item of assets.observations)
			{
				assert.equal(item.checks, 7); assert.equal(item.brokerIdentities, 0);
				digest(item.originalSha256);
				if(item.asset === "OwnedProbe.so" && mode === "prebuilt-only")
					assert.ok(Object.entries(report.files).some(([path, hash]) => path.startsWith("prebuilt/") && path.endsWith("/OwnedProbe.so") && hash === item.originalSha256));
				else if(item.asset !== "OwnedProbe.so")
					assert.equal(item.originalSha256, report.files["lib/LeanBridge/OwnedProbe/native/" + item.asset]);
			}
		}
	}
	const docs = record.documentation;
	flags(docs, ["cliIntegrated", "producerRemoved", "sourceUnchanged", "relocated"]);
	assert.deepEqual(docs.mixedTargets, ["c", "cpan"]);
	assert.deepEqual(docs.cliBuild.result.targets, docs.mixedTargets);
	assert.equal(docs.cliBuild.status, "ok"); assert.equal(docs.packageSetReceipt.profiles.length, 1);
	assert.deepEqual([...new Set(docs.packageSetReceipt.packages.map(pkg => pkg.target))], ["c", "cpan"]);
	matrix(docs.observations);
	for(const item of docs.observations)
	{ assert.equal(item.stdout, "42\n42\n"); assert.equal(item.stderr, ""); }
	for(const [name, file, heading, language] of [
		["lean", "publish/cpan", "## Export resource-containing values", "lean"]
		, ["config", "publish/cpan", "## Export resource-containing values", "json"]
		, ["example", "consume/perl", "### Resource-containing values", "perl"]
	]) {
		const section = (await readFile("docs/" + file + ".md", "utf8")).split(heading + "\n")[1].split("\n## ")[0];
		const source = section.match(new RegExp("```" + language + "\\n([^]*?)\\n```"))[1] + "\n";
		assert.equal(docs.sourceHashes[name], sha256(source));
	}
	const coexistence = record.coexistence;
	flags(coexistence, ["compilerFreeInstall", "producerRemoved", "relocated"]);
	assert.equal(coexistence.sourceSha256, sha256(await readFile("tests/fixtures/structured-types/owned-perl-coexistence.pl")));
	assert.equal(coexistence.releases.length, 4);
	assert.equal(coexistence.reproduced.independentNativeCompilation, true);
	assert.deepEqual(coexistence.reproduced.packages, coexistence.releases[0].built.packages);
	assert.equal(coexistence.reproduced.sourceSha256, coexistence.releases[0].sourceSha256);
	assert.equal(coexistence.observations.length, 16);
	const orders = new Set();
	for(const { perl, observed } of coexistence.observations)
	{
		orders.add(variant(perl) + ":" + observed.order);
		assert.equal(observed.checks, 323); assert.equal(observed.callbacks, 32);
		assert.equal(observed.foreignRejections, 64);
		assert.deepEqual(observed.snapshot, { live_callbacks: 0, live_identities: 0
			, live_scopes: 0, live_wrappers: 0, runtime_init_runs: 1 });
		assert.deepEqual(Object.keys(observed.mappings).sort(), ["libgmp-lean-bridge.so.10", "liblean_bridge_native.so", "libleanshared.so"]);
		for(const paths of Object.values(observed.mappings)) assert.equal(paths.length, 1);
	}
	assert.equal(orders.size, 16);
};
