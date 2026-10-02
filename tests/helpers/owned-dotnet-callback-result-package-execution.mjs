/**
 * Bind installed observations to public consumers, source inputs and archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedDotnetCallbackInstalledProbe, ownedDotnetCallbackInvalidPrograms } from "./owned-dotnet-callback-result-installed.mjs";
import { ownedDotnetCallbackInstalledProcessProbe, ownedDotnetCallbackProcessProject } from "./owned-dotnet-callback-result-installed-process.mjs";
import { ownedDotnetCallbackForkProbe } from "./owned-dotnet-callback-result-probes.mjs";
import { ownedDotnetCallbackResultConfiguration } from "./owned-dotnet-callback-result-fixture.mjs";
import { assertOwnedDotnetCallbackPackageInputs } from "./owned-dotnet-callback-result-package-evidence.mjs";

const hash = value => sha256(canonicalJson(value));
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const flags = (item, names) => { for(const name of names) assert.equal(item[name], true, name); };

/**
 * Require the installed public API, negative compilations and relocated probes.
 *
 * @param item - Installed NuGet observations, standalone or combined.
 * @param projection - Reconstructed managed API.
 * @param combined - Whether host callbacks and consuming receivers are enabled.
 */
export const assertOwnedDotnetCallbackInstalledExecution = async (item, projection, combined) => {
	flags(item, ["sourceFreeInstallation", "sourceFreeRelocatedExecution"
		, "consumerSourceRemoved", "packageCacheRemoved", "sdkFreeExecution"]);
	assert.equal(item.consumerSha256, sha256(await ownedDotnetCallbackInstalledProbe(combined)));
	assert.deepEqual(item.observation, { checks: combined ? 57 : 21, safePublicApi: true });
	const programs = [...ownedDotnetCallbackInvalidPrograms(projection, combined)
		, ["whole-owner-constructor", "void Invalid() { _ = new Value<Bundle>(); }", /CS1729/u]
		, ["private-owner-guard", "void Invalid(Value<Bundle> value) { _ = value.Guard; }", /CS1061/u]
		, ["resource-constructor", "void Invalid() { _ = new Ticket(); }", /CS1729/u]
		, ["raw-handle", "void Invalid(Ticket value) { _ = value.Handle; }", /CS1061/u]];
	assert.deepEqual(item.invalidConsumers, programs.map(([name, statement, diagnostic]) => ({
		name
		, source: `using ${projection.namespace};\ninternal static class Program { static void Main() { } internal static ${statement} }\n`
		, diagnostic: diagnostic.source
	})));
	const guide = await readFile("docs/consume/dotnet.md", "utf8");
	const publisher = await readFile("docs/publish/nuget.md", "utf8");
	const section = publisher.split("### Anchor a callback result to its argument\n")[1];
	const contract = (await ownedDotnetCallbackResultConfiguration()).contracts["Owned.makeRecord"];
	assert.deepEqual(JSON.parse(section.split("```json\n")[1].split("\n```")[0]), contract);
	const observed = [];
	for(const name of ["owned-callback-results", ...combined ? ["owned-callback-replies"] : []])
	{
		const source = await readFile(`tests/fixtures/documentation/consumers/dotnet/${name}.cs`, "utf8");
		assert.equal(guide.split(`\x60\x60\x60csharp file=dotnet/${name}.cs\n`)[1].split("\n```")[0] + "\n", source);
		observed.push({ name, sourceSha256: sha256(source), code: 0, stdout: "42\n42\n", stderr: "" });
	}
	assert.deepEqual(item.documentation, { contract, observed });
	assert.deepEqual(item.relocatedDocumentation, observed);
	const process = item.installedProcess;
	assert.equal(process.sourceSha256, sha256(await ownedDotnetCallbackInstalledProcessProbe()));
	assert.equal(process.projectSha256, sha256(ownedDotnetCallbackProcessProject(item.manifest, combined)));
	assert.equal(process.forkProbeSha256, sha256(ownedDotnetCallbackForkProbe));
	const modes = ["fork", "retirement", ...combined ? ["host-retirement", "transfer-retirement"] : []];
	assert.deepEqual(process.observations, modes.map(mode => ({
		mode
		, checks: mode === "fork" ? combined ? 22 : 20 : mode === "transfer-retirement" ? 5 : 4
		, rejected: mode === "fork" ? 0 : combined ? mode === "retirement" ? 8 : 9 : 7
		, forkChecks: mode === "fork" ? combined ? 7 : 6 : 0
		, identities: 0, installedPublicApi: true
	})));
	assert.deepEqual(item.relocatedProcess, process.observations);
};

/**
 * Authenticate the installed producer CLI's complete configured file set.
 *
 * @param report - CLI archive inventory from the actual offline installation.
 */
export const assertOwnedDotnetCallbackCli = async report => {
	const { archive, inventorySha256, externalRegistryWrites, ...inventory } = report;
	assert.equal(report.schemaVersion, 1); assert.equal(report.kind, "lean-bridge-cli-package");
	assert.equal(report.productionApproved, false); assert.equal(externalRegistryWrites, false);
	assert.equal(inventorySha256, hash(inventory)); digest(archive.sha256); assert.ok(archive.bytes > 0);
	const config = JSON.parse(await readFile("config/cli-package.v1.json", "utf8"));
	assert.deepEqual(report.package, { name: config.name, version: config.version });
	assert.equal(new Set(report.files.map(file => file.path)).size, report.files.length);
	for(const path of config.files)
	{
		const file = report.files.find(entry => entry.path === path); assert.ok(file, path);
		const bytes = await readFile(path);
		assert.equal(file.bytes, bytes.length, path); assert.equal(file.sha256, sha256(bytes), path);
	}
};

/**
 * Require two reproducible builds and every original standalone package check.
 *
 * @param item - Original installed-package report.
 */
export const assertOwnedDotnetCallbackPackageExecution = async item => {
	const { model, projection } = await assertOwnedDotnetCallbackPackageInputs(item);
	assert.equal(item.schemaVersion, 1); assert.equal(item.planNode, 1219);
	flags(item, ["compiledLean", "installedPackage", "installedNuget"
		, "sourceUnchanged", "handoffRemoved", "deterministicReassembly"
		, "independentProducerBuild", "safePublicApi"]);
	await assertOwnedDotnetCallbackInstalledExecution(item, projection, item.combined);
	assert.deepEqual(item.relocatedObservation, item.observation);
	const rejected = [];
	for(const [prefix, contract] of [
		["adapter.ownedValues", item.adapterReceipt.ownedValues]
		, ["adapter.dotnetValues", projection.contract]
		, ["compiled.ownedValues", projection.contract]
	]) {
		for(const field of Object.keys(contract.callbackResultAnchors).sort())
			for(const action of ["forged", "omitted"]) rejected.push(`${prefix}.${field}.${action}`);
		for(const action of ["omitted", "downgraded", "different-parameter", "missing-signature", "duplicate-signature", "foreign-signature"])
			rejected.push(`${prefix}.${action}`);
	}
	rejected.push("adapter.downgraded", "compiled.downgraded", "coordinated-original-owner-substitution", "coordinated-wrong-argument", "managed-source");
	assert.equal(rejected.length, 97); assert.deepEqual(item.tamperRejected, rejected);
	assert.deepEqual(item.incapableReadersRejected, ["ownedCallbackResultAnchors"
		, ...item.combined ? ["ownedHostCallbacks", "ownedInputTransfers", "ownedAnchoredResults", "ownedReceiverExports"] : []]);
	assert.deepEqual(item.loaderRejected, ["changed-library", "symlink-library"]);
	await assertOwnedDotnetCallbackCli(item.cli);
	assert.deepEqual(item.cliInstallation, { offline: true, filesVerified: item.cli.files.length, sourceRemoved: true });
	const receipt = item.packageSetReceipt; validatePackageSetReceipt(receipt);
	assert.deepEqual(receipt.component, model.component);
	assert.deepEqual(receipt.profiles, [{ id: "native-library-v1", bindingIrSha256: model.bindingIrSha256, runtimeIdentity: item.manifest.runtimeIdentity }]);
	assert.equal(receipt.packages.length, 1); const pkg = receipt.packages[0];
	assert.equal(pkg.target, "nuget"); assert.equal(pkg.name, item.manifest.name);
	assert.equal(pkg.version, item.manifest.version); assert.equal(pkg.runtimeIdentity, item.manifest.runtimeIdentity);
	assert.equal(pkg.artifacts.length, 1); const archive = pkg.artifacts[0];
	assert.equal(item.cliBuilds.length, 2);
	for(const build of item.cliBuilds)
	{
		if(item.combined)
		{
			assert.equal(build.status, "ok"); assert.equal(build.exitCode, 0);
			assert.deepEqual(build.result.targets, ["nuget"]);
			assert.equal(build.result.bindingIrSha256, model.bindingIrSha256);
		}
		else
		{ assert.equal(build.producerInterface, "native-build-api"); assert.equal(build.projections.length, 1); }
		const built = item.combined ? build.result : build.projections[0];
		assert.equal(built.backend, "owned-dotnet-v5"); assert.equal(built.runtimeIdentity, pkg.runtimeIdentity);
		assert.deepEqual(built.packages, [{ archive: archive.path.slice("archives/".length)
			, bytes: archive.bytes, sha256: archive.sha256, compilerAccess: false
			, name: pkg.name, version: pkg.version }]);
	}
	assert.equal(item.cliVerification.status, "ok"); assert.equal(item.cliVerification.exitCode, 0);
	assert.deepEqual(item.cliVerification.result, {
		archives: 1, authenticated: false, component: model.component.id
		, packages: [{ ecosystem: "nuget", name: pkg.name, target: "nuget", version: pkg.version }]
		, profiles: ["native-library-v1"], receiptSha256: hash(receipt)
		, verificationType: "local-package-set", verified: true
	});
};
