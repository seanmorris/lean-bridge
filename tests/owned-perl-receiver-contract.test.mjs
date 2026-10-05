/**
 * Bind CPAN receiver policies in the producer and the consumer-side installer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { createCompiledNativeModel } from "../src/build/native-graph-model.mjs";
import { generateOwnedPerlPackage } from "../src/backends/perl/owned-package.mjs";
import { perlGraphCommands } from "./helpers/perl-graph-probes.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const fixtures = async () => {
	const record = JSON.parse(await readFile("docs/evidence/owned-dotnet-receivers-20261001.json", "utf8"));
	const inputs = [...record.packages.map(item => ({ item, callbacks: true }))
		, ...record.plain.map(item => ({ item, callbacks: false }))];
	return inputs.map(({ item, callbacks }) => {
		const model = createCompiledNativeModel(item.input, {
			ownedGraphs: true, ownedReceiverExports: true
			, ownedHostCallbacks: callbacks, ownedInputTransfers: true
			, ownedAnchoredResults: callbacks });
		const generated = generateOwnedPerlPackage({ model
			, metadata: item.input.metadata
			, receipt: { runtimeIdentity: "0".repeat(64), library: "libcomponent_01234567890123456789.so", nativeLibrary: { sha256: "1".repeat(64) } }
			, moduleName: "LeanBridge::OwnedProbe", gmpSha256: "2".repeat(64) });
		return { model, generated, callbacks };
	});
};

test("CPAN receiver contracts preserve native slots and optional capabilities", async () => {
	for(const { model, generated, callbacks } of await fixtures())
	{
		const { owned, files } = generated;
		assert.equal(owned.schemaVersion, 4);
		assert.equal(JSON.parse(files["binding-manifest.json"]).schemaVersion, 4);
		assert.equal(owned.receiverExports.members, "snake-case");
		assert.equal(owned.receiverExports.properties, "read-only-zero-argument-methods");
		assert.equal(owned.receiverExports.owners, "nominal-whole-values");
		assert.deepEqual(owned.receiverExports.exports, model.ownedGraph.receiverExports.exports);
		assert.equal(generated.generated.hostCallbacks, callbacks);
		assert.equal(Boolean(owned.resultAnchors), callbacks);
		if(owned.inputTransfers) assert.equal(owned.inputTransfers.arguments, "whole-values");
		assert.match(files["lib/LeanBridge/OwnedProbe.pm"], /Properties are read-only, zero-argument methods/u);
		assert.doesNotMatch(files["lib/LeanBridge/OwnedProbe.pm"], /C<undefined>/u);
		if(!callbacks)
		{
			assert.doesNotMatch(files["lib/LeanBridge/OwnedProbe.pm"], /Pass CODE references/u);
			assert.doesNotMatch(files["lib/LeanBridge/OwnedProbe.pm"], /Generated owned Lean values and synchronous callbacks/u);
			assert.doesNotMatch(files["lib/LeanBridge/OwnedProbe.pm"], /Callback arguments expire/u);
		}
	}
});

test("Perl installers reject changed receiver policies on every selected ABI", {
	skip: process.env.LEAN_BRIDGE_OWNED_PERL_RECEIVER_TEST !== "1"
	, timeout: 240000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-perl-receiver-installer-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	await saveLakeFile(directory, "LeanBridgeBuild.pm", await readFile("src/backends/perl/Build.pm"));
	await saveLakeFile(directory, "inc/LeanBridge/Runtime/Platform.pm", await readFile("src/backends/perl/Platform.pm"));
	const mutations = [
		value => { value.schemaVersion = 3; }
		, value => { delete value.receiverExports; }
		, value => { value.receiverExports.properties = "mutable"; }
		, value => { value.receiverExports.owners = "raw-values"; }
		, value => { value.receiverExports.consumingReceivers = "copy"; }
		, value => { value.receiverExports.exports.pop(); }
	];
	for(const { model, generated } of await fixtures())
	{
		await saveLakeFile(directory, "model.json", canonicalJson(model));
		const binding = JSON.parse(generated.files["binding-manifest.json"]);
		for(const perl of perlGraphCommands())
		{
			const args = ["-I.", "-MLeanBridgeBuild", "-e", "LeanBridgeBuild::owned_values(LeanBridgeBuild::read_json('manifest.json')); print qq(ok\\n)"];
			const save = async owned => {
				await saveLakeFile(directory, "manifest.json", canonicalJson({ module: "LeanBridge::OwnedProbe", ownedValues: owned }));
				await saveLakeFile(directory, "binding-manifest.json", canonicalJson({ ...binding, owned }));
			};
			await save(generated.owned);
			const good = await runCopied(perl, args, directory, copiedCleanEnvironment);
			assert.equal(good.stdout, "ok\n"); assert.equal(good.stderr, "");
			for(const mutate of mutations)
			{
				const changed = structuredClone(generated.owned); mutate(changed); await save(changed);
				await assert.rejects(runCopied(perl, args, directory, copiedCleanEnvironment), error => {
					assert.match(error.details.stderr, /owned Perl (lifetime|receiver)|Owned Perl receivers/u); return true;
				});
			}
		}
	}
});
