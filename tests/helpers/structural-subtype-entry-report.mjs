/**
 * Authenticate separately identified structural entry executions and their exact source probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { structuralSubtypeEntrySource, structuralSubtypeEntryReview, structuralSubtypeEntryConfiguration, structuralSubtypeEntrySelection, structuralSubtypeEntryInterposer } from "./structural-subtype-entry.mjs";
import { structuralSubtypeRawProbe, structuralSubtypeRawCases } from "./structural-subtype-entry-raw.mjs";
import { checkStructuralSubtypePublicTrace, checkStructuralSubtypeRawTrace } from "./structural-subtype-entry-observe.mjs";
import { generateNativeLeanAdapters } from "../../src/build/native-model.mjs";

const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const controlSource = `#include <structuralsubtypes.h>
#include <stdio.h>
int main(void) {
  mpz_t input, output; mpz_init_set_ui(input, 42); mpz_init(output);
  structuralsubtypes_error error = {0};
  int ok = structuralsubtypes_unrestricted(input, output, &error) == STRUCTURALSUBTYPES_STATUS_OK && mpz_cmp_ui(output, 42) == 0;
  mpz_clears(input, output, NULL); if (!ok) return 1;
  puts("unrestricted-ok"); return 0;
}
`;

const beforeUnusedUnitBinderRename = (model, header) => {
	const current = "lean_object * _unit", previous = "lean_object * unit";
	const count = model.types.filter(type => type.kind === "option").length;
	assert.ok(count > 0);
	assert.equal(header.split(current).length - 1, count
		, "historical structural-entry adapters rename only unused Option Unit binders");
	return header.replaceAll(current, previous);
};

/**
 * Require exact source identities, two reproduced archives and every public/raw execution.
 *
 * @param read - Reader of original record bytes relative to one route.
 * @param options - Independent selection of original producer and source route.
 * @param options.route - Ordinary or independently reviewed author route.
 * @param options.producerCommit - Actual frozen producer revision, not a later archive revision.
 */
export const checkStructuralSubtypeEntryReport = async (read, { route, producerCommit }) => {
	assert.ok(["ordinary", "reviewed"].includes(route)); assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), path);
		return value;
	};
	const git = path => execFileSync("git", ["show", `${producerCommit}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
	const original = git("tests/fixtures/onboarding/structural-subtypes/StructuralSubtypes.lean").toString();
	const probe = structuralSubtypeEntrySource(original), review = structuralSubtypeEntryReview(), configuration = structuralSubtypeEntryConfiguration(route);
	const report = await json("report.json");
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route); assert.equal(report.producerCommit, producerCommit);
	assert.equal(report.scope, "separate-annotated-source-interposer"); assert.equal(report.dispatch.scope, report.scope);
	assert.deepEqual(await json("source-probe.json"), probe); assert.deepEqual(await json("expected.binding-ir.json"), review);
	assert.deepEqual(await json("configuration.json"), configuration); assert.deepEqual(report.configuration, configuration);
	assert.deepEqual(report.source, { originalSha256: probe.originalSha256, probeSha256: probe.probeSha256 });
	assert.equal(report.reproducible, true); assert.equal(report.independentBuilds, 2); assert.equal(report.sourceRemovedBeforeInstallation, true);
	assert.ok(["2.36", "2.38"].includes(report.declaredGlibcFloor));
	assert.equal(report.builds.length, 2); assert.deepEqual(report.builds[1], report.builds[0]);
	let model;
	for(const index of [0, 1])
	{
		const bytes = await read(`build-${index}/model.json`); model = await json(`build-${index}/model.json`);
		const receiptBytes = await read(`build-${index}/package-set-receipt.json`), receipt = await json(`build-${index}/package-set-receipt.json`);
		assert.equal(report.builds[index].modelSha256, sha256(bytes)); assert.equal(report.builds[index].receiptSha256, sha256(receiptBytes));
		assert.deepEqual(receipt, report.receipt);
		assert.equal(model.profile, "native-library-v1"); assert.equal(model.pointerBits, 64); assert.equal(model.exports.length, 13);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr)); assert.equal(reviewedContractDifference(review, model.bindingIr), null);
		assert.equal(model.sourceIdentity.modules.length, 1); assert.equal(model.sourceIdentity.modules[0].source.sha256, probe.probeSha256);
		assert.equal(model.sourceIdentity.exportConfigurationSource, canonicalJson(configuration));
		assert.equal(model.sourceIdentity.exportConfigurationSha256, sha256(canonicalJson(configuration)));
		assert.equal(model.sourceIdentity.extractorSha256, sha256(git("src/analyze/NativeExports.lean")));
		assert.deepEqual(model.sourceIdentity.request.metadata.modules.map(item => item.sourceSha256), [probe.probeSha256]);
		if(route === "reviewed") assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(review));
		else assert.ok(!model.sourceIdentity.reviewedBindingIr);
		assert.equal(receipt.profiles.length, 1); assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.ok(receipt.packages.length > 0 && receipt.packages.every(pkg => pkg.target === "c"));
		assert.deepEqual(report.builds[index].archives, Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256]))));
		for(const value of Object.values(report.builds[index].archives)) digest(value);
	}
	assert.deepEqual(await read("build-0/model.json"), await read("build-1/model.json"));
	const selected = structuralSubtypeEntrySelection(model, probe);
	assert.equal(selected.length, 59); assert.deepEqual(await json("observer/selected.json"), selected);
	assert.deepEqual(report.dispatch.selected, selected);
	const sources = { "interposer.c": '#include "component.h"\n' + structuralSubtypeEntryInterposer(selected)
		, "component.h": beforeUnusedUnitBinderRename(
			model, generateNativeLeanAdapters(model).header
		)
		, "raw.c": structuralSubtypeRawProbe(model), "control.c": controlSource };
	for(const [path, expected] of Object.entries(sources))
	{
		assert.equal((await read(`observer/${path}`)).toString(), expected);
		assert.equal(report.dispatch.observerFiles[path], sha256(expected));
	}
	assert.deepEqual(Object.keys(report.dispatch.observerFiles).sort(), ["component.h", "consumer", "consumer.c", "control", "control.c", "interposer.c", "libentry.so", "raw", "raw.c"]);
	const commands = await json("observer/commands.json"), strict = ["-std=c11", "-Wall", "-Wextra", "-Werror"];
	assert.equal(commands.length, 3);
	const leanInclude = commands[0].args[5], installedInclude = commands[0].args[7];
	assert.match(leanInclude, /^\/.*\/include$/u);
	assert.match(installedInclude, /^\/tmp\/lean-bridge-structural-entry-installed-[A-Za-z0-9]+\/consumer\/c\/structuralsubtypes-1\.0\.0-c\/include$/u);
	const installedRoot = installedInclude.slice(0, -"/include".length);
	const flags = [
		`-I${installedRoot}/lib/pkgconfig/../../include`
		, `-L${installedRoot}/lib/pkgconfig/../../lib`
		, `-Wl,-rpath,${installedRoot}/lib/pkgconfig/../../lib`
		, "-lstructuralsubtypes_gmp", "-l:libgmp.so.10"
	];
	assert.deepEqual(commands, [
		{ command: "/usr/bin/cc", args: [...strict, "-isystem", leanInclude, "-I", installedInclude, "-shared", "-fPIC", "interposer.c", "-ldl", "-o", "libentry.so"] }
		, { command: "/usr/bin/cc", args: [...strict, "-isystem", leanInclude, "raw.c", ...flags, "-lleanshared", "-ldl", "-o", "raw"] }
		, { command: "/usr/bin/cc", args: [...strict, "control.c", ...flags, "-o", "control"] }
	]);
	const consumer = git("tests/fixtures/structural-subtype-consumers/c.c").toString();
	const caller = route === "ordinary" ? consumer : consumer.replaceAll(/arg([01])/gu, "value$1");
	assert.equal((await read("consumer.c")).toString(), caller);
	assert.equal(report.installed.consumerSha256, sha256(caller)); assert.equal(report.installed.checks, 4049);
	assert.equal(report.installed.offlineInstall, true); assert.equal(report.installed.compilerFreePath, true);
	assert.equal(report.dispatch.observerFiles["consumer.c"], sha256(caller));
	for(const hash of Object.values(report.dispatch.observerFiles)) digest(hash);
	for(const key of ["sourceRemovedBeforeInstallation", "compilerFreeReplay", "relocatedInstallation"]) assert.equal(report.dispatch[key], true, key);
	assert.deepEqual(report.dispatch.unmeasured, ["Unmodified release dispatch", "Memory usage", "Other host entry counts"]);
	assert.equal(report.dispatch.observations.length, 2);
	const identities = new Set();
	for(const [position, name] of ["installed", "relocated"].entries())
	{
		const observation = report.dispatch.observations[position]; assert.equal(observation.relocated, Boolean(position));
		assert.equal(observation.calls, 2037); assert.equal(observation.checks, 4049);
		for(const field of ["receiptSha256", "packageFileSetSha256"]) digest(observation.closure[field]);
		assert.deepEqual(observation.closure, report.dispatch.observations[0].closure);
		const missing = await json(`${name}/without-observer.json`);
		assert.deepEqual(missing, { code: 0, stdout: "unrestricted-ok\n", stderr: "" });
		assert.throws(() => checkStructuralSubtypePublicTrace(missing.stderr, selected, true));
		const control = await json(`${name}/control.json`); assert.equal(control.code, 0); assert.equal(control.stdout, "unrestricted-ok\n");
		const controlCalls = checkStructuralSubtypePublicTrace(control.stderr, selected, true);
		const corpus = await json(`${name}/corpus.json`), trace = (await read(`${name}/corpus.trace`)).toString();
		assert.equal(corpus.code, 0); assert.equal(corpus.stdout, "structural-subtype-ok:4049\n");
		assert.equal(corpus.stderrBytes, Buffer.byteLength(trace)); assert.equal(corpus.stderrSha256, sha256(trace));
		assert.deepEqual(observation.corpus, corpus);
		const calls = checkStructuralSubtypePublicTrace(trace, selected);
		for(const call of [...calls, ...controlCalls])
		{
			identities.add(`public/${call.publicName}`);
			for(const entry of call.entries) identities.add(`${entry.kind}/${entry.label}`);
		}
		assert.deepEqual(observation.totals, Object.fromEntries(["validator", "constructor", "adapter", "source"].map(kind => [kind, calls.reduce((sum, call) => sum + call.counts[kind], 0)])));
		const rawCases = structuralSubtypeRawCases(); assert.equal(observation.raw.length, rawCases.length);
		for(const [index, item] of rawCases.entries())
		{
			const path = `${name}/raw-${item.name}-${item.bad}.json`, run = await json(path);
			assert.equal(run.code, 0); assert.equal(run.stdout, `raw:${item.name}:${item.bad}:${item.bad < 0 ? 1 : 0}\n`);
			const entries = checkStructuralSubtypeRawTrace(run.stderr, selected, item);
			assert.deepEqual(observation.raw[index], { ...item, entries, resultSha256: sha256(await read(path)) });
		}
	}
	assert.deepEqual([...identities].sort(), selected.map(item => `${item.kind}/${item.label}`).sort());
	return { route, producerCommit, scope: report.scope
		, publicCallsPerReplay: 2037, checksPerReplay: 4049
		, rawCasesPerReplay: 11, selectedIdentities: 59, replays: 2
		, totals: report.dispatch.observations[0].totals };
};
