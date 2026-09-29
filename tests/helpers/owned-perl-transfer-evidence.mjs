/**
 * Bind Perl consuming-input claims to both compiler paths and installed CPAN APIs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedPerlPackage } from "../../src/backends/perl/owned-package.mjs";
import { generateOwnedPerlXs } from "../../src/backends/perl/owned-xs.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedRustTransferSource } from "./owned-rust-transfer-fixture.mjs";

export const ownedPerlTransferCommand = "LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-perl-transfers";
export const ownedPerlTransferScope = Object.freeze({
	ordinaryCompiler: true, reviewedCompiler: true, installedCpan: true
	, profiles: ["perl"], transferredInputs: true, abiVariants: 4
	, installationModes: ["prebuilt-only", "build-xs"]
	, hostAssembledGraphs: true, recursiveValues: true, callbackReentry: true
	, sharedAliases: true, independentRetains: true, singleScalarFetch: true
	, multipleInputHandoffs: true, managedAllocationFaults: true
	, nativeAllocationFaults: true, retainedExceptions: true
	, forkRejection: true, interpreterThreadRejection: true
	, sourceFreeInstallation: true, offlineInstall: true
	, sourceFreeRelocatedExecution: true, runtimeOnlyExecution: true
	, deterministicReassembly: true, documentationExecuted: true
	, combinedCRelease: true, privateGmp: true, coldAndWarmAssetRejections: true
	, otherConsumerBindings: false, anchoredBorrowedResults: false
	, docker: false, installedSupportPromotions: 0
});
const variants = ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"];
const modes = ["prebuilt-only", "build-xs"];
const variant = perl => {
	const name = perl.match(/\/perl\/([^/]+)\/bin\/perl$/u)?.[1];
	assert.ok(variants.includes(name), perl); return name;
};
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const flags = (value, names) => {
	for(const name of names) assert.equal(value[name], true, name);
};
const matrix = observations => assert.deepEqual(observations.map(item =>
	variant(item.perl) + ":" + item.mode).sort()
, variants.flatMap(name => modes.map(mode => name + ":" + mode)).sort());
const block = (text, heading, language) => {
	const section = text.split(heading + "\n")[1]?.split("\n## ")[0];
	assert.ok(section, heading);
	const match = section.match(new RegExp("```" + language + "\\n([^]*?)\\n```"));
	assert.ok(match, heading + "/" + language); return match[1] + "\n";
};

/**
 * Require actual native handoffs, exact generated sources and relocated installs.
 *
 * @param record - Frozen private, installed and documentation observations.
 */
export const assertOwnedPerlTransferExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedPerlTransferScope);
	assert.equal(record.run.command, ownedPerlTransferCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [name, count] of Object.entries({ tests: 9, pass: 9, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + name + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	assert.deepEqual(record.runtime.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.consumers.map(item => item.mode), ["ordinary", "reviewed"]);
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8") + ownedRustTransferSource;
	const consumer = sha256(await readFile("tests/fixtures/structured-types/owned-perl-transfers.pl"));
	const assets = sha256(await readFile("tests/fixtures/structured-types/owned-perl-installed-assets.pl"));
	for(const item of [...record.runtime, ...record.consumers])
	{
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean));
		assert.equal(item.input.sourceIdentity.extractorSha256, sha256(await readFile("src/analyze/NativeExports.lean")));
		assert.equal(item.consumerSha256, consumer);
		const model = createCompiledNativeModel(item.input, { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true });
		assert.equal(model.schemaVersion, 8); assert.equal(model.exports.length, 26);
		assert.equal(model.ownedGraph.inputTransfers.exports.length, 20);
		const xs = generateOwnedPerlXs(model.bindingIr, "LeanBridge::OwnedProbe", { transferredInputs: true });
		const exports = xs.functions.map(fn => fn.publicName).sort();
		if(record.runtime.includes(item))
		{
			assert.equal(item.compiledLean, true); assert.equal(item.installedPackage, false);
			assert.equal(item.declarationsSha256, sha256(xs.declarations));
			assert.equal(item.valuesSha256, sha256(xs.valuesSource));
			digest(item.nativeSourceSha256); digest(item.xsSha256);
			assert.deepEqual(item.observations.map(observation => variant(observation.perl)).sort(), variants);
			for(const { perl, observed } of item.observations)
			{
				const threaded = !variant(perl).endsWith("unthreaded");
				assert.equal(observed.threaded, Number(threaded));
				assert.equal(observed.perlVersion, "v" + variant(perl).split("-")[0]);
				assert.equal(observed.checks, threaded ? 1016 : 1014);
				assert.deepEqual(observed.exports, exports);
				assert.equal(observed.managedLive, 0); assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
				assert.equal(observed.heldErrors, 349);
				for(const group of ["single", "multiple"])
					for(const domain of ["allocator", "exception", "native"])
						for(const phase of ["before", "after"])
							assert.ok(Number.isSafeInteger(observed[group][domain][phase]) && observed[group][domain][phase] > 0);
			}
			continue;
		}
		flags(item, ["installedPackage", "cliIntegrated"
			, "receiptVerifiedWithoutProducer"
			, "sourceUnchanged", "deterministicReassembly", "producerRemoved"
			, "handoffRemovedBeforeExecution", "relocated"]);
		assert.equal(item.schemaVersion, 1); assert.equal(item.planNode, 1219);
		assert.equal(item.cliBuild.status, "ok"); assert.deepEqual(item.cliBuild.result, item.packages);
		assert.deepEqual(item.packages.targets, ["cpan"]); assert.equal(item.packages.backend, "perl");
		assert.deepEqual(item.tamperRejections, ["schema", "missing", "consumption"
			, "aliases", "borrowed", "export", "binding", "model", "receipt", "xs"
			, "c-source", "header", "module", "library"]);
		const { manifest, componentReceipt: component, owned } = item;
		assert.deepEqual(item.files, manifest.files); assert.deepEqual(owned, manifest.ownedValues);
		assert.equal(manifest.module, "LeanBridge::OwnedProbe"); assert.equal(manifest.prebuilt.length, 4);
		const native = generateCompiledNativeLeanAdapters(model);
		assert.equal(component.schemaVersion, 4); assert.equal(component.profile, "native-library-v1");
		assert.equal(component.runtimeIdentity, manifest.nativeRuntimeIdentity);
		assert.equal(component.modelSha256, sha256(canonicalJson(model)));
		assert.equal(component.bindingIrSha256, model.bindingIrSha256);
		assert.equal(component.metadataSha256, sha256(canonicalJson(item.input.metadata)));
		assert.deepEqual(component.sourceIdentity, item.input.sourceIdentity);
		assert.deepEqual(component.inputTransfers, model.ownedGraph.inputTransfers);
		assert.equal(component.headerSha256, sha256(native.header));
		assert.equal(component.adaptersSha256, sha256(native.leanSource));
		assert.equal(component.callbackSourceSha256, sha256(native.callbackSource));
		const nativePath = "lib/LeanBridge/OwnedProbe/native/";
		assert.equal(owned.componentLibrary, component.library);
		assert.equal(owned.gmpLibrary, "libgmp-lean-bridge.so.10");
		assert.equal(component.nativeLibrary.sha256, item.files[nativePath + component.library]);
		assert.ok(component.nativeLibrary.bytes > 0);
		const generated = generateOwnedPerlPackage({ model
			, metadata: item.input.metadata
			, receipt: { ...component, runtimeIdentity: manifest.runtimeIdentity }
			, moduleName: manifest.module
			, gmpSha256: item.files[nativePath + owned.gmpLibrary] });
		assert.deepEqual(owned, generated.owned); assert.equal(owned.schemaVersion, 2);
		for(const [path, source] of Object.entries(generated.files))
		{
			const expected = path.endsWith(".pm") ? source.replace("our $VERSION = '0.001';", `our $VERSION = '${manifest.version}';`)
				.replace("use LeanBridge::Runtime;", `use LeanBridge::Runtime;\ndie "Incompatible shared Lean runtime package version\\n" unless $LeanBridge::Runtime::VERSION eq '${manifest.runtimeVersion}';`) : source;
			assert.equal(item.files[path], sha256(expected), path);
		}
		for(const [path, source] of Object.entries({ "model.json": canonicalJson(model)
			, "metadata.json": canonicalJson(item.input.metadata)
			, "binding-ir.json": canonicalJson(model.bindingIr)
			, "native-component.json": canonicalJson(component)
			, "component.h": native.header, "generated.lean": native.leanSource
			, "callbacks.c": native.callbackSource }))
			assert.equal(item.files[path], sha256(source), path);
		for(const [path, hash] of Object.entries(item.files))
		{ assert.ok(!path.startsWith("/") && !path.split("/").includes("..")); digest(hash); }
		validatePackageSetReceipt(item.packageSetReceipt);
		assert.equal(item.packageSetReceipt.profiles.length, 1);
		assert.equal(item.packageSetReceipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.equal(item.packageSetReceipt.packages.length, 2); assert.equal(item.packages.packages.length, 2);
		for(const pkg of item.packages.packages)
		{
			assert.equal(new Set(pkg.abiVariants).size, 4);
			for(const abi of pkg.abiVariants) digest(abi);
			const artifact = item.packageSetReceipt.packages.flatMap(pkg => pkg.artifacts)
				.find(file => file.path === "archives/" + pkg.archive);
			assert.equal(artifact.sha256, pkg.sha256); assert.ok(artifact.bytes > 0);
		}
		matrix(item.observations);
		for(const { perl, mode, observed, runtimeOnlyRuns, assets: inspected } of item.observations)
		{
			const threaded = !variant(perl).endsWith("unthreaded");
			assert.equal(runtimeOnlyRuns, 2); assert.equal(observed.checks, threaded ? 136 : 134);
			assert.equal(observed.threaded, Number(threaded));
			assert.equal(observed.perlVersion, "v" + variant(perl).split("-")[0]);
			assert.deepEqual(observed.exports, exports); assert.equal(observed.brokerIdentities, 0);
			assert.equal(inspected.sourceSha256, assets);
			assert.deepEqual(inspected.observations.map(item => item.asset + ":" + item.mode)
				, ["OwnedProbe.so", owned.gmpLibrary, owned.componentLibrary].flatMap(asset => ["cold", "warm"].map(mode => asset + ":" + mode)));
			for(const asset of inspected.observations)
			{
				assert.equal(asset.checks, 7); assert.equal(asset.brokerIdentities, 0); digest(asset.originalSha256);
				if(asset.asset === "OwnedProbe.so" && mode === "prebuilt-only")
					assert.ok(Object.entries(item.files).some(([path, hash]) => path.startsWith("prebuilt/") && path.endsWith("/OwnedProbe.so") && hash === asset.originalSha256));
				else if(asset.asset !== "OwnedProbe.so") assert.equal(item.files[nativePath + asset.asset], asset.originalSha256);
			}
		}
	}
	const documentation = record.documentation;
	flags(documentation, ["cliIntegrated", "transferredInputs", "producerRemoved", "sourceUnchanged", "relocated"]);
	assert.deepEqual(documentation.mixedTargets, ["c", "cpan"]);
	assert.equal(documentation.cliBuild.status, "ok");
	assert.deepEqual(documentation.cliBuild.result.targets, documentation.mixedTargets);
	validatePackageSetReceipt(documentation.packageSetReceipt);
	assert.deepEqual([...new Set(documentation.packageSetReceipt.packages.map(pkg => pkg.target))], ["c", "cpan"]);
	assert.equal(documentation.packageSetReceipt.profiles.length, 1);
	matrix(documentation.observations);
	for(const observed of documentation.observations)
	{ assert.equal(observed.stdout, "consumed\n42\n42\n"); assert.equal(observed.stderr, ""); }
	const author = await readFile("docs/publish/cpan.md", "utf8");
	const consumerGuide = await readFile("docs/consume/perl.md", "utf8");
	const config = { ...JSON.parse(block(author, "## Export resource-containing values", "json"))
		, contracts: JSON.parse(block(author, "## Transfer input ownership", "json")) };
	assert.deepEqual(documentation.sourceHashes, {
		lean: sha256(block(author, "## Export resource-containing values", "lean"))
		, config: sha256(canonicalJson(config))
		, example: sha256(block(consumerGuide, "### Consuming inputs", "perl"))
	});
};

/**
 * Require each selected Perl ABI to execute the new gate and upload all reports.
 *
 * @param workflow - Complete Perl consumer workflow.
 */
export const assertOwnedPerlTransferCi = workflow => {
	const step = workflow.split("      - name: Verify owned Perl values and installed CPAN archives\n")[1]?.split("      - name:")[0];
	assert.ok(step); assert.doesNotMatch(step, /^ {8}(?:if|continue-on-error):/mu);
	assert.ok(step.includes("CORPUS_PERL_CONFIGURATION: ${{ matrix.configuration }}"));
	assert.ok(step.includes('export LEAN_BRIDGE_CORPUS_PERL="$PWD/.toolchains/perl/$CORPUS_PERL_CONFIGURATION/bin/perl"'));
	assert.ok(step.includes("          npm run test:owned-perl-transfers\n"));
	for(const directory of ["transfers", "transfer-packaging"])
	{
		assert.ok(workflow.includes(`            build/owned-perl-${directory}/\n`));
		for(const mode of ["ordinary", "reviewed"])
			assert.ok(step.includes(`          test -s build/owned-perl-${directory}/${mode}.json\n`));
	}
	assert.ok(step.includes("          test -s build/owned-perl-transfer-packaging/documentation.json\n"));
};
