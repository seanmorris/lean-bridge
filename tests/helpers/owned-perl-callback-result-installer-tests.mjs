/**
 * Check callback-only CPAN installer extensions with isolated JSON witnesses.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedCValues } from "../../src/backends/c/owned-values.mjs";
import { renderOwnedPerlCallbackBuild } from "../../src/backends/perl/owned-callback-build.mjs";
import { ownedDotnetCallbackResultReviewedIr, ownedDotnetCallbackResultCombinedReviewedIr } from "./owned-dotnet-callback-result-fixture.mjs";
import { ownedAggregateReviewedIr } from "./owned-aggregate-fixture.mjs";
import { ownedPerlCallbackPackageFixture } from "./owned-perl-callback-result-package-fixture.mjs";
import { perlGraphCommands } from "./perl-graph-probes.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const namespace = "LeanBridge::OwnedProbe", digest = "1".repeat(64);
const templates = async () => ({
	original: await readFile("src/backends/perl/Build.pm", "utf8")
	, extension: await readFile("src/backends/perl/BuildCallbackResults.pm", "utf8")
});
const fixture = (combined = false, hostCallbacks = false) => {
	const ir = (combined ? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr)();
	const c = generateOwnedCValues(ir, {
		callbackResultAnchors: true, hostCallbacks
		, transferredInputs: combined, anchoredResults: combined
		, receiverExports: combined, valueCopies: true
	});
	const callbacks = {
		schemaVersion: 1, ownership: "borrow", lifetime: "parameter"
		, anchor: "original-argument-owner"
		, expiration: "owner-release-or-transfer"
		, descendants: "transitive", validation: "generation-and-owner-tree"
		, independentOwnership: "explicit-retain-or-copy", maximumDepth: 128
		, hostResultHandoff: "before-callback-frame-expires"
		, signatures: c.callbacks.filter(fn => fn.anchor !== undefined).map(fn => ({ id: fn.id, parameter: fn.anchor - 1 }))
	};
	const graph = { schemaVersion: 6, callbackResultAnchors: callbacks };
	if(hostCallbacks) graph.hostCallbacks = { schemaVersion: 1, lifetime: "call", recovery: "typed-value-v1", signatures: ["isolated-fixture"], trampolineSha256: digest };
	const model = {
		schemaVersion: 11, profile: "native-library-v1"
		, pointerBits: 64, byteOrder: "little"
		, bindingIr: ir, bindingIrSha256: digest, ownedGraph: graph
	};
	const receipt = {
		schemaVersion: 7, profile: "native-library-v1", bindingIrSha256: digest
		, runtimeIdentity: "2".repeat(64)
		, library: "libcomponent_01234567890123456789.so"
		, callbackResultAnchors: callbacks
		, ...hostCallbacks ? { callbackSourceSha256: digest } : {}
	};
	const owned = {
		schemaVersion: 5, prefix: c.prefix
		, gmpLibrary: "libgmp-lean-bridge.so.10"
		, componentLibrary: receipt.library, bindingIrSha256: digest
		, publicHeaderSha256: digest, publicSourceSha256: digest
		, callbackResultAnchors: {
			...callbacks, arguments: "whole-values"
			, results: "checked-whole-values", emptyValues: "owner-scoped"
			, independentRetains: "preserved", identityEquality: "native-identity"
			, parameterNumbering: "callback-local", hostReply: "value-or-whole-owner"
			, hostArguments: "borrowed-raw-values"
			, nativeClosures: "identity-preserved"
			, independentOwnership: "retain-or-copy_value"
		}
	};
	if(combined)
	{
		graph.inputTransfers = {
			schemaVersion: 1, ownership: "whole-result-owner"
			, validation: "before-consumption", consumption: "before-lean-call"
			, failure: "consumed-after-handoff", viewLifetime: "until-call-returns"
			, exports: c.functions.filter(fn => fn.transfers?.length).map(fn => ({ bindingId: fn.id, parameters: fn.transfers }))
		};
		graph.resultAnchors = {
			schemaVersion: 2, ownership: "borrow"
			, lifetime: "receiver-or-parameter", anchor: "original-result-owner"
			, expiration: "owner-release-or-transfer", descendants: "transitive"
			, validation: "generation-and-owner-tree"
			, independentOwnership: "explicit-retain-or-copy", maximumDepth: 128
			, exports: c.functions.filter(fn => fn.anchor !== undefined).map(fn => ({ bindingId: fn.id, receiver: true }))
		};
		graph.receiverExports = {
			schemaVersion: 1, callingConvention: "receiver-first"
			, exports: ir.declarations.filter(fn => fn.receiver).map(fn => ({ bindingId: fn.id, kind: fn.kind, owner: fn.owner, argument: 0 }))
		};
		owned.inputTransfers = { ...graph.inputTransfers, arguments: "whole-values", aliases: "shared-owner", borrowedInputs: "reject", independentRetains: "preserved" };
		owned.resultAnchors = { ...graph.resultAnchors, arguments: "whole-values", results: "checked-whole-values", emptyValues: "owner-scoped", independentRetains: "preserved", identityEquality: "native-identity" };
		owned.receiverExports = { ...graph.receiverExports, values: "checked-whole-result", members: "snake-case", properties: "read-only-zero-argument-methods", owners: "nominal-whole-values", consumingReceivers: "original-owner-handoff" };
		for(const name of ["inputTransfers", "resultAnchors", "receiverExports"]) receipt[name] = graph[name];
	}
	const manifest = {
		schemaVersion: 1, module: namespace, runtimeIdentity: "3".repeat(64)
		, nativeRuntimeIdentity: receipt.runtimeIdentity
		, ownedValues: owned
		, files: {
			[`owned/include/${c.prefix}.h`]: digest
			, [`owned/src/${c.prefix}.c`]: digest
			, ...hostCallbacks ? { "callbacks.c": digest } : {}
		}
	};
	const binding = {
		schemaVersion: 5, backend: "perl", profile: "native-library-v1", owned
		, runtimeIdentity: manifest.runtimeIdentity
		, publicModule: "lib/LeanBridge/OwnedProbe.pm"
	};
	return Object.fromEntries(Object.entries({ model, binding, receipt, ir, manifest }).map(([name, document]) => [name, structuredClone(document)]));
};

test("Perl callback installer renderer preserves every legacy and runtime template byte", async () => {
	const { original, extension } = await templates();
	for(const model of [
		undefined
		, { schemaVersion: 7, bindingIr: ownedAggregateReviewedIr(), ownedGraph: { schemaVersion: 2 } }
		, ...[8, 9, 10].map(schemaVersion => ({ schemaVersion, ownedGraph: { schemaVersion: schemaVersion - 5 } }))
	])
		assert.equal(renderOwnedPerlCallbackBuild(original, extension, { moduleName: namespace, model }), original);
	assert.equal(renderOwnedPerlCallbackBuild(original, extension, { moduleName: "LeanBridge::Runtime" }), original);
	assert.equal(sha256(await readFile("src/backends/perl/Build.pm")), sha256(original));
	const { model } = fixture();
	const rendered = renderOwnedPerlCallbackBuild(original, extension, { moduleName: namespace, model });
	assert.equal(rendered, original.replace("sub owned_values {\n", "sub _owned_values_before_callback_results {\n") + "\n" + extension);
	assert.equal(rendered.split("sub owned_values {\n").length, 2);
	assert.equal(rendered.split("sub _owned_values_before_callback_results {\n").length, 2);
	assert.equal(renderOwnedPerlCallbackBuild(original, extension, { moduleName: namespace, model }), rendered);
});

test("Perl callback installer renderer rejects ambiguous templates and stripped native models", async () => {
	const { original, extension } = await templates(), { model } = fixture();
	for(const before of [
		original.replace("sub owned_values {\n", "sub missing_values {\n")
		, original + "\nsub owned_values {\n}\n"
		, original + "\nsub _owned_values_before_callback_results {\n}\n"
	])
		assert.throws(() => renderOwnedPerlCallbackBuild(before, extension, { moduleName: namespace, model }), /unambiguous legacy/u);
	for(const after of ["", extension + "not-perl", extension.replace("package LeanBridgeBuild;", "package Other;")])
		assert.throws(() => renderOwnedPerlCallbackBuild(original, after, { moduleName: namespace, model }), /installer extension/u);
	for(const moduleName of ["LeanBridge::Runtime", "LeanBridge::Runtime::Private"])
		assert.throws(() => renderOwnedPerlCallbackBuild(original, extension, { moduleName, model }), /component module/u);
	for(const change of [
		value => { value.schemaVersion = 10; }
		, value => { delete value.ownedGraph.callbackResultAnchors; }
		, value => { value.bindingIr.types = []; }
	]) {
		const changed = structuredClone(model); change(changed);
		assert.throws(() => renderOwnedPerlCallbackBuild(original, extension, { moduleName: namespace, model: changed }), /native ownership model/u);
	}
});

const mutations = combined => [
	["missing-owned", value => { delete value.manifest.ownedValues; }]
	, ["owned-version", value => { value.manifest.ownedValues.schemaVersion = 4; }]
	, ["string-version", value => { value.manifest.ownedValues.schemaVersion = "5"; }]
	, ["model-version", value => { value.model.schemaVersion = 10; }]
	, ["graph-version", value => { value.model.ownedGraph.schemaVersion = 5; }]
	, ["binding-version", value => { value.binding.schemaVersion = 4; }]
	, ["receipt-version", value => { value.receipt.schemaVersion = 6; }]
	, ["public-callback-policy", value => { delete value.manifest.ownedValues.callbackResultAnchors; }]
	, ["native-callback-policy", value => { delete value.model.ownedGraph.callbackResultAnchors; }]
	, ["receipt-callback-policy", value => { delete value.receipt.callbackResultAnchors; }]
	, ["native-anchor", value => { value.model.ownedGraph.callbackResultAnchors.anchor = "captured-owner"; }]
	, ["public-anchor", value => { value.manifest.ownedValues.callbackResultAnchors.anchor = "captured-owner"; }]
	, ["private-parameter-offset", value => { value.manifest.ownedValues.callbackResultAnchors.signatures[0].parameter++; }]
	, ["signature-removed", value => { value.manifest.ownedValues.callbackResultAnchors.signatures.pop(); }]
	, ["empty-lifetime", value => { value.manifest.ownedValues.callbackResultAnchors.emptyValues = "unowned"; }]
	, ["reply-handoff", value => { value.manifest.ownedValues.callbackResultAnchors.hostResultHandoff = "after-callback-frame-expires"; }]
	, ["native-closure-identity", value => { value.manifest.ownedValues.callbackResultAnchors.nativeClosures = "host-wrapper"; }]
	, ["host-arguments", value => { value.manifest.ownedValues.callbackResultAnchors.hostArguments = "owned-values"; }]
	, ["independent-retain", value => { value.manifest.ownedValues.callbackResultAnchors.independentOwnership = "shared"; }]
	, ["binding-copy", value => { value.binding.owned = {}; }]
	, ["binding-ir-copy", value => { value.ir.types.pop(); }]
	, ["model-hash", value => { value.receipt.modelSha256 = "0".repeat(64); }]
	, ["binding-identity", value => { value.receipt.bindingIrSha256 = "0".repeat(64); }]
	, ["runtime-identity", value => { value.binding.runtimeIdentity = "0".repeat(64); }]
	, ["native-runtime-identity", value => { value.receipt.runtimeIdentity = "0".repeat(64); }]
	, ["component-library", value => { value.manifest.ownedValues.componentLibrary = "wrong.so"; }]
	, ["public-module", value => { value.binding.publicModule = "lib/Other.pm"; }]
	, ["public-header-bytes", value => { value.manifest.ownedValues.publicHeaderSha256 = value.binding.owned.publicHeaderSha256 = "0".repeat(64); }]
	, ["public-source-bytes", value => { value.manifest.ownedValues.publicSourceSha256 = value.binding.owned.publicSourceSha256 = "0".repeat(64); }]
	, ["unknown-owned-field", value => { value.manifest.ownedValues.optionalCallbacks = true; }]
	, ["all-callback-summaries-stripped", value => {
		delete value.manifest.ownedValues.callbackResultAnchors;
		delete value.binding.owned.callbackResultAnchors;
		delete value.model.ownedGraph.callbackResultAnchors;
		delete value.receipt.callbackResultAnchors;
	}]
	, ["all-versions-downgraded", value => {
		value.manifest.ownedValues.schemaVersion = combined ? 4 : 1; value.binding.schemaVersion = combined ? 4 : 1;
		value.binding.owned.schemaVersion = value.manifest.ownedValues.schemaVersion;
		value.model.schemaVersion = combined ? 10 : 7; value.model.ownedGraph.schemaVersion = combined ? 5 : 2;
		value.receipt.schemaVersion = combined ? 6 : 3;
		delete value.manifest.ownedValues.callbackResultAnchors;
		delete value.binding.owned.callbackResultAnchors;
		delete value.model.ownedGraph.callbackResultAnchors;
		delete value.receipt.callbackResultAnchors;
	}]
	, ...combined ? ["inputTransfers", "resultAnchors", "receiverExports"].map(name => [
		`all-${name}-stripped`
		, value => {
			delete value.manifest.ownedValues[name]; delete value.binding.owned[name];
			delete value.model.ownedGraph[name]; delete value.receipt[name];
		}
	]) : [["invented-transfer", value => { value.manifest.ownedValues.inputTransfers = {}; }]]
];

test("Perl callback-v5 installer authenticates independent witnesses on all selected ABIs", {
	skip: process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_TEST !== "1"
	, timeout: 300000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-perl-callback-installer-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const { original, extension } = await templates();
	await saveLakeFile(directory, "LeanBridgeBuild.pm", renderOwnedPerlCallbackBuild(original, extension, { moduleName: namespace, model: fixture().model }));
	await saveLakeFile(directory, "inc/LeanBridge/Runtime/Platform.pm", await readFile("src/backends/perl/Platform.pm"));
	const args = ["-I.", "-MLeanBridgeBuild", "-e", "LeanBridgeBuild::owned_values(LeanBridgeBuild::read_json('manifest.json')); print qq(ok\\n)"];
	const save = async (value, name = "") => {
		if(name !== "model-hash") value.receipt.modelSha256 = sha256(canonicalJson(value.model));
		for(const [path, document] of [
			["manifest.json", value.manifest], ["model.json", value.model]
			, ["binding-manifest.json", value.binding], ["binding-ir.json", value.ir]
			, ["native-component.json", value.receipt]
		])
			await saveLakeFile(directory, path, canonicalJson(document));
	};
	let accepted = 0, rejected = 0;
	for(const perl of perlGraphCommands()) for(const combined of [false, true]) for(const hostCallbacks of [false, true])
	{
		const good = fixture(combined, hostCallbacks); await save(good);
		const execution = await runCopied(perl, args, directory, copiedCleanEnvironment);
		assert.equal(execution.stdout, "ok\n"); assert.equal(execution.stderr, ""); accepted++;
		for(const [name, change] of [
			...mutations(combined)
			, ["host-source", value => { value.receipt.callbackSourceSha256 = "0".repeat(64); }]
			, ["host-inventory", value => { value.manifest.files["callbacks.c"] = "0".repeat(64); }]
		]) {
			const changed = structuredClone(good); change(changed); await save(changed, name);
			await assert.rejects(runCopied(perl, args, directory, copiedCleanEnvironment), error => {
				assert.match(error.details.stderr, /Invalid owned Perl callback-result contract/u, `${perl}: ${name}`); return true;
			}, `${perl}: ${name}`);
			rejected++;
		}
	}
	assert.equal(accepted, perlGraphCommands().length * 4);
	assert.equal(rejected, perlGraphCommands().length * 144);
	t.diagnostic(`${accepted} isolated JSON contracts accepted; ${rejected} rehashed/stripped contracts rejected. No native build or package install.`);
});

test("Perl callback-v5 installer accepts compiler-derived package contracts on all selected ABIs", {
	skip: process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_TEST !== "1"
	, timeout: 300000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-perl-callback-installer-compiled-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const { original } = await templates(), platform = await readFile("src/backends/perl/Platform.pm");
	const script = "my $manifest = LeanBridgeBuild::read_json('manifest.json'); LeanBridgeBuild::verify($manifest); LeanBridgeBuild::owned_values($manifest); print qq(ok\\n)";
	let accepted = 0, rejected = 0, incapable = 0;
	for(const mode of ["ordinary", "reviewed"]) for(const combined of [false, true]) for(const hostCallbacks of [false, true])
	{
		const source = await ownedPerlCallbackPackageFixture(mode, combined, hostCallbacks);
		const root = join(directory, `${mode}-${combined}-${hostCallbacks}`);
		await saveLakeFile(root, "inc/LeanBridge/Runtime/Platform.pm", platform);
		await saveLakeFile(root, "legacy/LeanBridgeBuild.pm", original);
		const save = async value => {
			value.receipt.modelSha256 = sha256(canonicalJson(value.model));
			const files = new Map(source.files);
			for(const [path, document] of [
				["model.json", value.model], ["binding-ir.json", value.ir]
				, ["binding-manifest.json", value.binding]
				, ["native-component.json", value.receipt]
			]) files.set(path, Buffer.from(canonicalJson(document)));
			value.manifest.files = Object.fromEntries([...files].map(([path, bytes]) => [path, sha256(bytes)]));
			for(const [path, bytes] of files) await saveLakeFile(root, path, bytes);
			await saveLakeFile(root, "manifest.json", canonicalJson(value.manifest));
		};
		const good = {
			manifest: structuredClone(source.manifest)
			, model: structuredClone(source.model)
			, receipt: structuredClone(source.receipt)
			, ir: JSON.parse(source.files.get("binding-ir.json").toString())
			, binding: JSON.parse(source.files.get("binding-manifest.json").toString())
		};
		await save(good);
		for(const perl of perlGraphCommands())
		{
			const execution = await runCopied(perl, ["-I.", "-MLeanBridgeBuild", "-e", script], root, copiedCleanEnvironment);
			assert.equal(execution.stdout, "ok\n"); assert.equal(execution.stderr, ""); accepted++;
			await assert.rejects(runCopied(perl, ["-Ilegacy", "-MLeanBridgeBuild", "-e", script], root, copiedCleanEnvironment), error => {
				assert.match(error.details.stderr, /Invalid owned Perl package contract/u); return true;
			}); incapable++;
		}
		for(const [name, change] of mutations(combined).filter(([name]) => [
			"binding-ir-copy", "receipt-callback-policy"
			, "all-callback-summaries-stripped", "all-versions-downgraded"
			, "public-header-bytes", "public-source-bytes"
		].includes(name))) {
			const changed = structuredClone(good); change(changed); await save(changed);
			for(const perl of perlGraphCommands())
			{
				await assert.rejects(runCopied(perl, ["-I.", "-MLeanBridgeBuild", "-e", script], root, copiedCleanEnvironment), error => {
					assert.match(error.details.stderr, /Invalid owned Perl callback-result contract/u, `${mode}/${combined}/${hostCallbacks}/${perl}: ${name}`); return true;
				}); rejected++;
			}
		}
	}
	assert.equal(accepted, perlGraphCommands().length * 8);
	assert.equal(incapable, accepted);
	assert.equal(rejected, accepted * 6);
	t.diagnostic(`${accepted} compiler-derived contracts accepted, ${rejected} rehashed witness forgeries rejected, ${incapable} incapable legacy readers rejected. Synthetic libraries were not loaded.`);
});
