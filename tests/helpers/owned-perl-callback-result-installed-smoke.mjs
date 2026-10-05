/**
 * One ordinary combined CPAN release, installed on the selected pinned ABIs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, statfs } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedCpanPackage } from "../../src/release/cpan-package.mjs";
import { ownedDotnetCallbackResultCombinedConfiguration, ownedDotnetCallbackResultCombinedSource } from "./owned-dotnet-callback-result-fixture.mjs";
import { prepareOwnedReceiverCli } from "./owned-receiver-cli.mjs";
import { perlGraphCommands } from "./perl-graph-probes.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runInstalledPerlCallbackResults } from "./owned-perl-callback-result-installed.mjs";

test("installed CPAN callback-result smoke preserves combined owners (ordinary)", {
	skip: process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_PACKAGE_TEST !== "1"
	, timeout: 1800000
}, async t => {
	const disk = await statfs("/tmp");
	assert.ok(disk.bavail * disk.bsize >= 3 * 1024 ** 3, "CPAN smoke needs at least 3 GiB free before building");
	const configuration = await ownedDotnetCallbackResultCombinedConfiguration();
	configuration.targets = { cpan: { module: "LeanBridge::OwnedProbe", version: "0.010" } };
	const perls = perlGraphCommands();
	const context = await prepareOwnedReceiverCli(t, {
		label: "perl-callback-result-installed-smoke", configuration
		, source: ownedDotnetCallbackResultCombinedSource, profiles: ["perl"]
		, environment: { LEAN_BRIDGE_PERLS: JSON.stringify(perls) }
	});
	t.diagnostic(`ordinary combined: one installed CLI build for ${perls.length} Perl ABIs`);
	const { directory, output, handoff } = context;
	await context.build(output);
	assert.equal(context.builds.length, 1);
	const prepared = await readVerifiedCpanPackage(join(output, "packages/component"));
	assert.equal(prepared.manifest.ownedValues.schemaVersion, 5);
	assert.equal(prepared.manifest.prebuilt.length, perls.length);
	const model = JSON.parse(prepared.files.get("model.json"));
	assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
	for(const name of ["callbackResultAnchors", "resultAnchors", "inputTransfers", "receiverExports"])
		assert.ok(model.ownedGraph[name], name);
	assert.ok(model.ownedGraph.hostCallbacks);
	const packageSetReceipt = await copyPackageSetHandoff(output, handoff);
	const retainedRoot = resolve("build/owned-perl-callback-results");
	await mkdir(retainedRoot, { recursive: true });
	const savedHandoff = await mkdtemp(join(retainedRoot, "ordinary-combined-smoke-handoff-"));
	await copyPackageSetHandoff(output, savedHandoff);
	await saveLakeFile(savedHandoff, "smoke-inputs.json", canonicalJson({
		cli: context.cli, cliBuilds: context.builds
		, cliInstallation: context.cliInstallation, packageSetReceipt
		, manifest: prepared.manifest
		, componentReceipt: JSON.parse(prepared.files.get("native-component.json"))
		, input: { metadata: JSON.parse(prepared.files.get("metadata.json")), sourceIdentity: model.sourceIdentity, component: model.component }
	}));
	t.diagnostic(`retained verified handoff for diagnostics: ${savedHandoff}`);
	const archives = await Promise.all(context.builds[0].result.packages.map(async archive => ({
		...archive, bytes: await readFile(join(handoff, "archives", archive.archive))
	})));
	const cliVerification = await context.removeAuthor();
	await rm(handoff, { recursive: true }); await assert.rejects(access(handoff), { code: "ENOENT" });
	const source = await readFile("tests/fixtures/structured-types/owned-perl-callback-results-installed.pl", "utf8");
	assert.doesNotMatch(source, /\b(?:snapshot|handoffs)\s*\(|::Probe::|_Owned|::_identity\b/u);
	const observations = await runInstalledPerlCallbackResults({ directory, archives, perls, source, diagnostic: value => t.diagnostic(value) })
		.catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); });
	await saveLakeFile(resolve("build/owned-perl-callback-results"), "ordinary-combined-installed-smoke.json", canonicalJson({
		schemaVersion: 1, mode: "ordinary", variant: "combined"
		, scope: "single-producer-prebuilt-only-public-api-smoke"
		, cli: context.cli, cliBuilds: context.builds
		, cliInstallation: context.cliInstallation
		, cliVerification, packageSetReceipt, savedHandoff
		, manifest: prepared.manifest
		, componentReceipt: JSON.parse(prepared.files.get("native-component.json"))
		, input: { metadata: JSON.parse(prepared.files.get("metadata.json")), sourceIdentity: model.sourceIdentity, component: model.component }
		, consumerSha256: sha256(source), observations
		, limitations: ["no independent producer rebuild", "no shared release", "no XS-only consumer install", "no native internal cleanup counters"]
	}));
});
