/**
 * Bind Perl original-owner borrowed-result claims to both compiler paths and installed CPAN APIs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { ownedReceiverHistoricalBytes } from "./owned-receiver-history.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedPerlPackage } from "../../src/backends/perl/owned-package.mjs";
import { generateOwnedPerlXs } from "../../src/backends/perl/owned-xs.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedRustBorrowSource } from "./owned-rust-borrow-fixture.mjs";

export const ownedPerlBorrowScript = "LEAN_BRIDGE_OWNED_PERL_BORROW_TEST=1 LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 tests/owned-perl-borrows.test.mjs tests/owned-perl-borrow-packaging.test.mjs tests/owned-perl-borrow-documentation.test.mjs";
export const ownedPerlBorrowCommand = "LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-perl-borrows";
export const ownedPerlBorrowScope = Object.freeze({
	ordinaryCompiler: true, reviewedCompiler: true, installedCpan: true
	, profiles: ["perl"], anchoredResults: 19, publicExports: 26
	, consumingFunctions: 4, abiVariants: 4
	, installationModes: ["prebuilt-only", "build-xs"]
	, wholeValueOwners: true, originalOwnerTransfers: true
	, emptyValues: true, recursiveValues: true, transitiveExpiration: true
	, sharedRoots: true, independentRetains: true, canonicalIdentity: true
	, rawResourceViews: "borrowed-from-whole-owner", borrowOnlyExecuted: true
	, callbackReentry: true, returnedClosures: true, singleScalarFetch: true
	, managedAllocationFaults: true, nativeAllocationFaults: true
	, retainedExceptions: true, forkRejection: true
	, interpreterThreadRejection: true, compiledNegativeVariants: 5
	, sourceFreeInstallation: true, offlineInstall: true
	, sourceFreeRelocatedExecution: true, runtimeOnlyExecution: true
	, deterministicReassembly: true, documentationExecuted: true
	, combinedCRelease: true, privateGmp: true, coldAndWarmAssetRejections: true
	, receiverAnchors: false, callbackResultAnchors: false
	, otherConsumerBindings: false, docker: false, installedSupportPromotions: 0
});
const variants = ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"];
const modes = ["prebuilt-only", "build-xs"];
const variant = perl => {
	const name = perl.match(/\/perl\/([^/]+)\/bin\/perl$/u)?.[1];
	assert.ok(variants.includes(name), perl); return name;
};
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);

/**
 * Reconstruct the exact instrumented native and XS sources used by the runner.
 *
 * @param c - Regenerated C public package.
 * @param model - Regenerated Perl XS model.
 * @param transferredInputs - Whether the probe instruments native handoffs.
 */
const instrumentedSources = async (c, model, transferredInputs) => {
	const handoff = "static inline void oc_transfer_consume(void *context) {";
	if(transferredInputs) assert.equal(c.source.split(handoff).length, 2);
	const native = `#include <stdlib.h>
#include <stdio.h>
#include <stddef.h>
#include <unistd.h>
static size_t live = 0; static ptrdiff_t fail_after = -1;${transferredInputs ? "\nstatic size_t handoffs = 0;" : ""}
static void *allocate(size_t size) {
  if (fail_after == 0) return NULL;
  if (fail_after > 0) --fail_after;
  void *value = malloc(size); if (value) ++live; return value;
}
static void deallocate(void *value) { if (value) { --live; free(value); } }
#define LB_OWNED_ALLOC allocate
#define LB_OWNED_FREE deallocate
${transferredInputs ? c.source.replace(handoff, handoff + "\n  ++handoffs;") : c.source}
size_t owned_test_live(void) { return live; }${transferredInputs ? "\nsize_t owned_test_handoffs(void) { return handoffs; }" : ""}
void owned_test_fail_after(ptrdiff_t value) { fail_after = value; }
size_t owned_test_identities(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot); return snapshot.live_identities;
}
__attribute__((destructor)) static void owned_test_final(void) {
  if (live || owned_test_identities()) {
    fprintf(stderr, "unreleased native ownership: %zu allocations, %zu identities\\n", live, owned_test_identities());
    _exit(88);
  }
}
`;
	const template = await readFile("tests/fixtures/structured-types/owned-perl-runtime.xs", "utf8");
	const index = template.indexOf("\nvoid\nreset("); assert.ok(index > 0);
	const xs = `#include "instrumentation.h"
#include "${c.values.prefix}.h"
size_t owned_test_live(void);
size_t owned_test_identities(void);
void owned_test_fail_after(ptrdiff_t);
${transferredInputs ? "size_t owned_test_handoffs(void);\n" : ""}\
${model.declarations}
${model.xs}
MODULE = LeanBridge::OwnedProbe PACKAGE = LeanBridge::OwnedProbe
${template.slice(index)}
${transferredInputs ? `\nUV\nhandoffs()\n  CODE:\n    RETVAL = owned_test_handoffs();\n  OUTPUT:\n    RETVAL\n` : ""}\
`;
	return { native, xs };
};

export { instrumentedSources as ownedPerlBorrowInstrumentedSources };

const flags = (value, names) => {
	for(const name of names) assert.equal(value[name], true, name);
};
const matrix = observations => assert.deepEqual(observations.map(item =>
	variant(item.perl) + ":" + item.mode).sort()
, variants.flatMap(name => modes.map(mode => name + ":" + mode)).sort());
const block = (text, heading, language) => {
	const sections = text.split(heading + "\n"); assert.equal(sections.length, 2);
	const section = sections[1].split(/^#{1,3} /mu)[0];
	const matches = [...section.matchAll(new RegExp("^```" + language + "\\n([^]*?)^```", "gmu"))];
	assert.equal(matches.length, 1, heading + "/" + language); return matches[0][1];
};

/**
 * Check generated bytes, compiled mutants and actual cleanup on every Perl ABI.
 *
 * @param item - One compiler path's runtime report.
 * @param model - Reconstructed native model.
 * @param xs - Reconstructed public Perl adapter.
 * @param exports - Expected public calls exercised by the consumer.
 */
export const assertOwnedPerlBorrowRuntime = async (item, model, xs, exports) => {
	assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
	assert.equal(item.declarationsSha256, sha256(xs.declarations));
	assert.equal(item.valuesSha256, sha256(xs.valuesSource));
	const c = generateOwnedCPackage({ ...item.input, hostCallbacks: true
		, transferredInputs: true, anchoredResults: true });
	const sources = await instrumentedSources(c, xs, true);
	assert.equal(item.nativeSourceSha256, sha256(sources.native));
	assert.equal(item.xsSha256, sha256(sources.xs));
	const equal = xs.types.find(node => node.name === "Ticket").cName + "_equal";
	const mutants = [
		["unchecked-whole-value"
			, "if (lpo_closed(wrapper) || !wrapper->payload) lpo_status(aTHX_ 4);"
			, "if (!wrapper->payload) lpo_status(aTHX_ 4);"]
		, ["unchecked-empty-value"
			, "if (lpo_closed(wrapper) || !wrapper->payload) lpo_status(aTHX_ 4);"
			, "if (!wrapper->payload || (SvOK(wrapper->payload) && !(SvROK(wrapper->payload) && SvTYPE(SvRV(wrapper->payload)) == SVt_PVAV && av_len((AV *)SvRV(wrapper->payload)) < 0) && lpo_closed(wrapper))) lpo_status(aTHX_ 4);"]
		, ["discarded-whole-owner"
			, "    owner->valid = 0;\n    if (!owner->pins) lpo_release_native(aTHX_ owner);"
			, "    owner->valid = 1;"]
		, ["escaped-callback-frame", "if (!owner->published || owner->borrowed) {"
			, "if (!owner->published && !owner->borrowed) {"]
		, ["pointer-equality"
			, `lpo_status(aTHX_ ${equal}(lpo_state.session, left, right, &equal));`
			, "equal = left == right;"]
	].map(([name, before, after]) => {
		assert.equal(sources.xs.split(before).length, 2, name);
		return { name, compiled: true, sourceSha256: sha256(sources.xs.replace(before, after)) };
	});
	assert.equal(model.ownedGraph.resultAnchors.exports.length, 19);
	assert.deepEqual(item.observations.map(observation => variant(observation.perl)).sort(), variants);
	for(const { perl, observed, rejectedMutations } of item.observations)
	{
		const threaded = !variant(perl).endsWith("unthreaded");
		assert.equal(observed.threaded, Number(threaded));
		assert.equal(observed.perlVersion, "v" + variant(perl).split("-")[0]);
		assert.equal(observed.checks, threaded ? 930 : 928);
		assert.deepEqual(observed.exports, exports);
		assert.equal(observed.managedLive, 0); assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
		assert.equal(observed.heldErrors, 366);
		assert.deepEqual(observed.faults, { allocator: { before: 19, after: 35 }
			, exception: { before: 23, after: 191 }
			, native: { before: 11, after: 86 } });
		assert.deepEqual(rejectedMutations, mutants);
	}
};

/**
 * Verify both compiler paths also execute anchors without consuming inputs.
 *
 * @param record - Borrow-only report with eight actual XS consumers.
 */
const assertBorrowOnly = async record => {
	assert.equal(record.probeSha256, sha256(record.probe));
	const source = await readFile("tests/owned-perl-borrows.test.mjs", "utf8");
	const literal = source.match(/const probe = `([^]*?)`;/u)?.[1];
	assert.equal(literal?.replaceAll("\\\\", "\\"), record.probe);
	assert.deepEqual(record.observations.map(item => item.mode + ":" + variant(item.perl)).sort()
		, ["ordinary", "reviewed"].flatMap(mode => variants.map(name => mode + ":" + name)).sort());
	const lean = sha256(await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean"));
	const extractor = sha256(ownedReceiverHistoricalBytes("src/analyze/NativeExports.lean", await readFile("src/analyze/NativeExports.lean")));
	for(const item of record.observations)
	{
		assert.equal(item.actualLean, true); assert.equal(item.code, 0);
		assert.equal(item.stdout, "borrow-only-ok\n"); assert.equal(item.stderr, "");
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, lean);
		assert.equal(item.input.sourceIdentity.extractorSha256, extractor);
		const model = createCompiledNativeModel(item.input, {
			ownedGraphs: true, ownedHostCallbacks: true, ownedAnchoredResults: true
		});
		assert.equal(model.exports.length, 22); assert.equal(model.ownedGraph.inputTransfers, undefined);
		assert.equal(model.ownedGraph.resultAnchors.exports.length, 18);
		const c = generateOwnedCPackage({ ...item.input, hostCallbacks: true, anchoredResults: true });
		const xs = generateOwnedPerlXs(model.bindingIr, "LeanBridge::OwnedProbe", { anchoredResults: true });
		const sources = await instrumentedSources(c, xs, false);
		assert.equal(item.nativeSourceSha256, sha256(sources.native));
		assert.equal(item.xsSha256, sha256(sources.xs));
	}
};

/**
 * Require actual native handoffs, exact generated sources and relocated installs.
 *
 * @param record - Frozen private, installed and documentation observations.
 */
export const assertOwnedPerlBorrowExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-perl-borrows");
	assert.equal(record.planNode, 1219); assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedPerlBorrowScope);
	assert.equal(record.run.command, ownedPerlBorrowCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [name, count] of Object.entries({ tests: 10, pass: 10, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + name + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	await assertOwnedPerlBorrowArtifacts(record);
};

/**
 * Reconstruct runtime, package and documentation artifacts independently of TAP.
 * This check alone does not establish that the complete enabled gate passed.
 *
 * @param record - Actual reports from both compiler paths and installed examples.
 */
export const assertOwnedPerlBorrowArtifacts = async record => {
	assert.deepEqual(record.runtime.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.packages.map(item => item.mode), ["ordinary", "reviewed"]);
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8") + ownedRustBorrowSource;
	const consumer = sha256(await readFile("tests/fixtures/structured-types/owned-perl-borrows.pl"));
	const assets = sha256(await readFile("tests/fixtures/structured-types/owned-perl-installed-assets.pl"));
	for(const item of [...record.runtime, ...record.packages])
	{
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean));
		assert.equal(sha256(ownedReceiverHistoricalBytes("src/analyze/NativeExports.lean", await readFile("src/analyze/NativeExports.lean"))), item.input.sourceIdentity.extractorSha256);
		assert.equal(item.consumerSha256, consumer);
		const model = createCompiledNativeModel(item.input, { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true, ownedAnchoredResults: true });
		assert.equal(model.schemaVersion, 9); assert.equal(model.exports.length, 26);
		assert.equal(model.ownedGraph.inputTransfers.exports.length, 4);
		const xs = generateOwnedPerlXs(model.bindingIr, "LeanBridge::OwnedProbe", { transferredInputs: true, anchoredResults: true });
		const exports = [...xs.functions.map(fn => fn.publicName).filter(name => name !== "payload"), "copy_value"].sort();
		assert.equal(model.ownedGraph.resultAnchors.exports.length, 19);
		if(record.runtime.includes(item))
		{
			await assertOwnedPerlBorrowRuntime(item, model, xs, exports);
			continue;
		}
		flags(item, ["installedPackage", "cliIntegrated"
			, "receiptVerifiedWithoutProducer"
			, "sourceUnchanged", "deterministicReassembly", "producerRemoved"
			, "handoffRemovedBeforeExecution", "relocated"]);
		assert.equal(item.schemaVersion, 1); assert.equal(item.planNode, 1219);
		assert.equal(item.cliBuild.status, "ok"); assert.deepEqual(item.cliBuild.result, item.packages);
		assert.deepEqual(item.packages.targets, ["cpan"]); assert.equal(item.packages.backend, "perl");
		assert.deepEqual(item.tamperRejections, [
			"schema", "missing", "anchor", "empty"
			, "ownership", "export", "binding", "model", "receipt", "xs"
			, "c-source", "header", "module", "library"]);
		const { manifest, componentReceipt: component, owned } = item;
		assert.deepEqual(item.files, manifest.files); assert.deepEqual(owned, manifest.ownedValues);
		assert.equal(manifest.module, "LeanBridge::OwnedProbe"); assert.equal(manifest.prebuilt.length, 4);
		const native = generateCompiledNativeLeanAdapters(model);
		assert.equal(component.schemaVersion, 5); assert.equal(component.profile, "native-library-v1");
		assert.equal(component.runtimeIdentity, manifest.nativeRuntimeIdentity);
		assert.equal(component.modelSha256, sha256(canonicalJson(model)));
		assert.equal(component.bindingIrSha256, model.bindingIrSha256);
		assert.equal(component.metadataSha256, sha256(canonicalJson(item.input.metadata)));
		assert.deepEqual(component.sourceIdentity, item.input.sourceIdentity);
		assert.deepEqual(component.inputTransfers, model.ownedGraph.inputTransfers);
		assert.deepEqual(component.resultAnchors, model.ownedGraph.resultAnchors);
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
		assert.deepEqual(owned, generated.owned); assert.equal(owned.schemaVersion, 3);
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
			assert.equal(runtimeOnlyRuns, 2); assert.equal(observed.checks, threaded ? 185 : 183);
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
	await assertBorrowOnly(record.borrowOnly);
	const documentation = record.documentation;
	flags(documentation, ["cliIntegrated", "anchoredResults", "producerRemoved", "sourceUnchanged", "relocated"]);
	assert.equal(documentation.consumingInputs, false);
	assert.deepEqual(documentation.mixedTargets, ["c", "cpan"]);
	assert.equal(documentation.cliBuild.status, "ok");
	assert.deepEqual(documentation.cliBuild.result.targets, documentation.mixedTargets);
	validatePackageSetReceipt(documentation.packageSetReceipt);
	assert.deepEqual([...new Set(documentation.packageSetReceipt.packages.map(pkg => pkg.target))], ["c", "cpan"]);
	assert.equal(documentation.packageSetReceipt.profiles.length, 1);
	matrix(documentation.observations);
	for(const observed of documentation.observations)
	{ assert.equal(observed.stdout, "42\nexpired\n42\n"); assert.equal(observed.stderr, ""); }
	const author = await readFile("docs/publish/cpan.md", "utf8");
	const consumerGuide = await readFile("docs/consume/perl.md", "utf8");
	const config = { ...JSON.parse(block(author, "## Export resource-containing values", "json"))
		, contracts: JSON.parse(block(author, "## Borrow a result from an input", "json")) };
	assert.deepEqual(documentation.sourceHashes, {
		lean: sha256(block(author, "## Export resource-containing values", "lean"))
		, config: sha256(canonicalJson(config))
		, example: sha256(block(consumerGuide, "### Borrowed results", "perl"))
	});
};

/**
 * Require each selected Perl ABI to execute the new gate and upload all reports.
 *
 * @param workflow - Complete Perl consumer workflow.
 * @param manifest - Parsed package scripts.
 */
export const assertOwnedPerlBorrowCi = (workflow, manifest) => {
	assert.equal(manifest.scripts["test:owned-perl-borrows"], ownedPerlBorrowScript);
	const step = workflow.split("      - name: Verify owned Perl values and installed CPAN archives\n")[1]?.split("      - name:")[0];
	assert.ok(step); assert.doesNotMatch(step, /^ {8}(?:if|continue-on-error):/mu);
	assert.ok(step.includes("CORPUS_PERL_CONFIGURATION: ${{ matrix.configuration }}"));
	assert.ok(step.includes('export LEAN_BRIDGE_CORPUS_PERL="$PWD/.toolchains/perl/$CORPUS_PERL_CONFIGURATION/bin/perl"'));
	assert.ok(step.includes("          npm run test:owned-perl-borrows\n"));
	for(const directory of ["borrows", "borrow-packaging"])
	{
		assert.ok(workflow.includes(`            build/owned-perl-${directory}/\n`));
		for(const mode of ["ordinary", "reviewed"])
			assert.ok(step.includes(`          test -s build/owned-perl-${directory}/${mode}.json\n`));
	}
	assert.ok(step.includes("          test -s build/owned-perl-borrow-packaging/documentation.json\n"));
	assert.ok(step.includes("          test -s build/owned-perl-borrows/borrow-only.json\n"));
};
