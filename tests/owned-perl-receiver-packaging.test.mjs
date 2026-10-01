/**
 * Real installed CLI, independent CPAN builds and source-free receiver consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { archiveCpanPackage, readVerifiedCpanPackage } from "../src/release/cpan-package.mjs";
import { verifyOwnedCpanTransfers } from "../src/release/owned-cpan-contract.mjs";
import { ownedRustReceiverConfiguration, ownedRustReceiverReviewedIr, ownedRustReceiverSource } from "./helpers/owned-rust-receiver-fixture.mjs";
import { ownedPerlReceiverProbe } from "./helpers/owned-perl-receiver-fixture.mjs";
import { runInstalledPerlReceivers } from "./helpers/owned-perl-receiver-installed.mjs";
import { prepareOwnedReceiverCli } from "./helpers/owned-receiver-cli.mjs";
import { perlGraphCommands } from "./helpers/perl-graph-probes.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";

const rejectMutations = ({ manifest, files }) => {
	const cases = ["schema", "missing", "anchor", "empty", "ownership", "export"
		, "binding", "model", "receipt", "xs", "c-source", "header", "module"
		, "library"
		, ...["values", "members", "properties", "owners", "consumingReceivers", "exports"].map(name => "receiver-" + name)];
	for(const name of cases)
	{
		const changed = structuredClone(manifest), payload = new Map(files), owned = changed.ownedValues;
		const update = (path, mutate) => {
			const value = JSON.parse(payload.get(path)); mutate(value);
			payload.set(path, Buffer.from(canonicalJson(value)));
		};
		if(name === "schema") owned.schemaVersion = 3;
		else if(name === "missing") delete changed.ownedValues;
		else if(name === "anchor") owned.resultAnchors.anchor = "copied-owner";
		else if(name === "empty") owned.resultAnchors.emptyValues = "unowned";
		else if(name === "ownership") owned.inputTransfers.arguments = "ordinary-values";
		else if(name === "export") owned.resultAnchors.exports.pop();
		else if(name === "binding") update("binding-manifest.json", value => { delete value.owned.receiverExports; });
		else if(name === "model") update("model.json", value => { delete value.ownedGraph.receiverExports; });
		else if(name === "receipt") update("native-component.json", value => { value.receiverExports.exports.pop(); });
		else if(name.startsWith("receiver-")) owned.receiverExports[name.slice(9)] = "changed";
		else
		{
			const path = { xs: "Component.xs", "c-source": `owned/src/${owned.prefix}.c`
				, header: `owned/include/${owned.prefix}.h`
				, module: "lib/LeanBridge/OwnedProbe.pm"
				, library: `lib/LeanBridge/OwnedProbe/native/${owned.componentLibrary}` }[name];
			payload.set(path, Buffer.concat([payload.get(path), Buffer.from("\n/* altered lifetime */\n")]));
		}
		for(const [path, value] of payload) changed.files[path] = sha256(value);
		assert.throws(() => verifyOwnedCpanTransfers(changed, payload), undefined, name);
	}
	return cases;
};

for(const mode of ["ordinary", "reviewed"]) test(`installed CPAN receiver members preserve original owners (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PERL_RECEIVER_TEST !== "1"
	, timeout: 2400000
}, async t => {
	const config = mode === "ordinary" ? await ownedRustReceiverConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { cpan: { module: "LeanBridge::OwnedProbe", version: "0.010" } };
	const perls = perlGraphCommands();
	const context = await prepareOwnedReceiverCli(t, {
		label: `perl-receiver-package-${mode}`, configuration: config
		, reviewedIr: mode === "reviewed" ? ownedRustReceiverReviewedIr() : null
		, source: ownedRustReceiverSource, profiles: ["perl"]
		, environment: { LEAN_BRIDGE_PERLS: JSON.stringify(perls) }
	});
	const { directory, output, handoff } = context;
	t.diagnostic(`${mode}: installed CLI builds CPAN receiver packages`);
	await context.build(output);
	const built = context.builds[0].result;
	const prepared = await readVerifiedCpanPackage(join(output, "packages/component"));
	const { ownedValues: owned } = prepared.manifest;
	assert.equal(owned.schemaVersion, 4); assert.equal(owned.resultAnchors.exports.length, 20);
	assert.equal(owned.receiverExports.exports.length, 16);
	assert.equal(owned.inputTransfers.arguments, "whole-values");
	assert.equal(prepared.manifest.prebuilt.length, perls.length);
	const model = JSON.parse(prepared.files.get("model.json"));
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	const tamperRejections = rejectMutations(prepared);
	for(const name of ["runtime", "component"])
	{
		const again = await archiveCpanPackage({ packageRoot: join(output, "packages", name), outputRoot: join(directory, "reassembled") });
		assert.deepEqual(await readFile(again.path), await readFile(join(output, "archives", again.receipt.archive)));
	}
	await rm(join(directory, "reassembled"), { recursive: true });
	const independent = join(directory, "independent");
	t.diagnostic(`${mode}: independent second CLI build`);
	await context.build(independent);
	const second = await readVerifiedCpanPackage(join(independent, "packages/component"));
	assert.deepEqual(JSON.parse(second.files.get("model.json")), model);
	assert.deepEqual(second.manifest.ownedValues, owned);
	const packageSetReceipt = await copyPackageSetHandoff(output, handoff);
	await rm(independent, { recursive: true });
	const cliVerification = await context.removeAuthor();
	const archives = await Promise.all(built.packages.map(async pkg => ({ ...pkg, bytes: await readFile(join(handoff, "archives", pkg.archive)) })));
	await rm(handoff, { recursive: true }); await assert.rejects(access(handoff), { code: "ENOENT" });
	const source = await ownedPerlReceiverProbe();
	const observations = await runInstalledPerlReceivers({ directory, archives, perls, owned, source, diagnostic: text => t.diagnostic(text) })
		.catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); });
	await saveLakeFile(resolve("build/owned-perl-receiver-core"), `${mode}-package.json`, canonicalJson({
		schemaVersion: 1, mode, installedPackage: true, actualLean: true
		, cli: context.cli, cliBuilds: context.builds
		, cliInstallation: context.cliInstallation
		, cliVerification, independentProducerBuild: true, sourceUnchanged: true
		, deterministicReassembly: true, producerRemoved: true
		, receiptVerifiedWithoutProducer: true, handoffRemovedBeforeExecution: true
		, relocated: true, packageSetReceipt, observations, owned
		, manifest: prepared.manifest
		, consumerSha256: sha256(source), files: prepared.manifest.files
		, tamperRejections
		, componentReceipt: JSON.parse(prepared.files.get("native-component.json"))
		, input: { metadata: JSON.parse(prepared.files.get("metadata.json")), sourceIdentity: model.sourceIdentity, component: model.component }
	}));
});
