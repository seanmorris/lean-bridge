/**
 * Observe the complete C corpus and direct adapters in one installed probe package.
 * Package files remain unchanged; LD_PRELOAD supplies the separately compiled observer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, rename, access } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateNativeLeanAdapters } from "../../src/build/native-model.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { structuralSubtypeEntryInterposer } from "./structural-subtype-entry.mjs";
import { structuralSubtypeEntryCorpus, structuralSubtypeEntryCall } from "./structural-subtype-entry-cases.mjs";
import { structuralSubtypeRawProbe, structuralSubtypeRawCases, structuralSubtypeRawEntries } from "./structural-subtype-entry-raw.mjs";
import { parseSubtypeEntryTrace } from "./php-wasm-subtype-entry-trace.mjs";
import { verifyFinContainerEdgeArchiveClosure } from "./fin-container-edge-closure.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const control = `#include <structuralsubtypes.h>
#include <stdio.h>
int main(void) {
  mpz_t input, output; mpz_init_set_ui(input, 42); mpz_init(output);
  structuralsubtypes_error error = {0};
  int ok = structuralsubtypes_unrestricted(input, output, &error) == STRUCTURALSUBTYPES_STATUS_OK && mpz_cmp_ui(output, 42) == 0;
  mpz_clears(input, output, NULL); if (!ok) return 1;
  puts("unrestricted-ok"); return 0;
}
`;

const sameCalls = (actual, expected) => {
	assert.equal(actual.length, expected.length, "complete call count");
	// Bounded diagnostics avoid formatting thousands of full call trees on a mismatch.
	for(let index = 0; index < expected.length; index++) assert.equal(canonicalJson(actual[index]), canonicalJson(expected[index]), `call ${index}`);
};

/**
 * Validate every bracketed public call against independently specified caller inputs.
 *
 * @param trace - Original stderr bytes decoded as UTF-8.
 * @param selected - Exact instrumented identities from the compiled probe.
 * @param controlOnly - Select the single unrefined control instead of the original full caller.
 */
export const checkStructuralSubtypePublicTrace = (trace, selected, controlOnly = false) => {
	const calls = parseSubtypeEntryTrace(trace, selected);
	sameCalls(calls, controlOnly ? [structuralSubtypeEntryCall("unrestricted")] : structuralSubtypeEntryCorpus());
	return calls;
};

/**
 * Check the public initialization control and each direct adapter's exact entries.
 *
 * @param trace - Complete original stderr, including raw-call delimiters.
 * @param selected - Independently labelled compiler symbols.
 * @param item - Named raw input case and failing position.
 */
export const checkStructuralSubtypeRawTrace = (trace, selected, item) => {
	const pieces = trace.split("LB_STRUCTURAL_RAW_V1 begin\n"); assert.equal(pieces.length, 2);
	checkStructuralSubtypePublicTrace(pieces[0], selected, true);
	assert.ok(pieces[1].endsWith("LB_STRUCTURAL_RAW_V1 end\n"));
	const lines = pieces[1].slice(0, -"LB_STRUCTURAL_RAW_V1 end\n".length).trimEnd().split("\n");
	const entries = lines.map(line => {
		const match = /^LB_SUBTYPE_ENTRY_V1 enter (validator|constructor|adapter|source) ([A-Za-z_][A-Za-z0-9_.:]*)$/u.exec(line);
		assert.ok(match, "exact raw entry marker");
		const [, kind, label] = match; assert.ok(selected.some(entry => entry.kind === kind && entry.label === label));
		return { kind, label };
	});
	assert.equal(canonicalJson(entries), canonicalJson(structuralSubtypeRawEntries(item)));
	return entries;
};

/**
 * Build an interposer, run all public and raw cases, move the whole tree and repeat.
 *
 * @param options - Installed component, original archive, observer model and output paths.
 */
export const observeStructuralSubtypeEntries = async options => {
	const { root, handoff, pkg, leanPrefix, model, selected, output } = options;
	const packageName = `${pkg.name}-${pkg.version}-c`, installed = join(root, packageName);
	const receipt = JSON.parse(await readFile(join(installed, "lean-bridge-package.json")));
	const compile = { ...copiedCleanEnvironment, PATH: join(root, "tools"), PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
	const strict = ["-std=c11", "-Wall", "-Wextra", "-Werror"];
	const sources = { "interposer.c": '#include "component.h"\n' + structuralSubtypeEntryInterposer(selected)
		, "component.h": generateNativeLeanAdapters(model).header
		, "raw.c": structuralSubtypeRawProbe(model), "control.c": control };
	for(const [path, source] of Object.entries(sources))
	{ await saveLakeFile(root, path, source); await saveLakeFile(output, `observer/${path}`, source); }
	await saveLakeFile(output, "observer/selected.json", canonicalJson(selected));
	const commands = [];
	const execute = async args => {
		commands.push({ command: "/usr/bin/cc", args });
		await saveLakeFile(output, "observer/commands.json", canonicalJson(commands));
		await runCopied("/usr/bin/cc", args, root, compile);
	};
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", receipt.pkgConfig], root, compile)).stdout.trim().split(/\s+/u);
	await execute([...strict, "-isystem", join(leanPrefix, "include"), "-I", join(installed, "include"), "-shared", "-fPIC", "interposer.c", "-ldl", "-o", "libentry.so"]);
	await execute([...strict, "-isystem", join(leanPrefix, "include"), "raw.c", ...flags, "-lleanshared", "-ldl", "-o", "raw"]);
	await execute([...strict, "control.c", ...flags, "-o", "control"]);
	const owned = ["consumer", "consumer.c", "interposer.c", "component.h", "raw.c", "control.c", "libentry.so", "raw", "control"];
	const initial = Object.fromEntries(await Promise.all(owned.map(async path => [path, sha256(await readFile(join(root, path)))])));
	const observations = [];
	for(const [position, location] of [root, root + "-relocated"].entries())
	{
		if(position)
		{ await rename(root, location); await assert.rejects(access(root), { code: "ENOENT" }); }
		const name = position ? "relocated" : "installed", installedRoot = join(location, packageName);
		const verify = () => verifyFinContainerEdgeArchiveClosure({ profile: "c", installed: installedRoot, receiptPath: "lean-bridge-package.json", archive: join(handoff, pkg.artifacts[0].path), archiveSha256: pkg.artifacts[0].sha256 });
		const closure = await verify(), clean = { ...copiedCleanEnvironment, LD_LIBRARY_PATH: join(installedRoot, "lib") };
		const env = { ...clean, LD_PRELOAD: join(location, "libentry.so") };
		const missing = await runCopied(join(location, "control"), [], location, clean);
		assert.equal(missing.stdout, "unrestricted-ok\n"); assert.equal(missing.stderr, "");
		assert.throws(() => checkStructuralSubtypePublicTrace(missing.stderr, selected, true));
		await saveLakeFile(output, `${name}/without-observer.json`, canonicalJson(missing));
		const controlRun = await runCopied(join(location, "control"), [], location, env);
		assert.equal(controlRun.stdout, "unrestricted-ok\n"); checkStructuralSubtypePublicTrace(controlRun.stderr, selected, true);
		await saveLakeFile(output, `${name}/control.json`, canonicalJson(controlRun));
		const corpus = await runCopied(join(location, "consumer"), [], location, env);
		await saveLakeFile(output, `${name}/corpus.trace`, corpus.stderr);
		const corpusResult = { code: corpus.code, stdout: corpus.stdout, stderrBytes: Buffer.byteLength(corpus.stderr), stderrSha256: sha256(corpus.stderr) };
		await saveLakeFile(output, `${name}/corpus.json`, canonicalJson(corpusResult));
		assert.equal(corpus.stdout, "structural-subtype-ok:4049\n");
		const calls = checkStructuralSubtypePublicTrace(corpus.stderr, selected);
		const observed = new Set([...calls, structuralSubtypeEntryCall("unrestricted")].flatMap(call => [`public/${call.publicName}`, ...call.entries.map(entry => `${entry.kind}/${entry.label}`)]));
		assert.deepEqual([...observed].sort(), selected.map(entry => `${entry.kind}/${entry.label}`).sort(), "all selected identities need nonzero controls");
		const raw = [];
		for(const item of structuralSubtypeRawCases())
		{
			const run = await runCopied(join(location, "raw"), [item.name, String(item.bad)], location, env);
			await saveLakeFile(output, `${name}/raw-${item.name}-${item.bad}.json`, canonicalJson(run));
			assert.equal(run.stdout, `raw:${item.name}:${item.bad}:${item.bad < 0 ? 1 : 0}\n`);
			const entries = checkStructuralSubtypeRawTrace(run.stderr, selected, item);
			raw.push({ ...item, entries, resultSha256: sha256(canonicalJson(run)) });
		}
		assert.deepEqual(await verify(), closure);
		for(const [path, digest] of Object.entries(initial)) assert.equal(sha256(await readFile(join(location, path))), digest, path);
		observations.push({ relocated: Boolean(position), closure
			, corpus: corpusResult, raw
			, calls: calls.length, checks: 4049
			, totals: Object.fromEntries(["validator", "constructor", "adapter", "source"].map(kind => [kind, calls.reduce((sum, call) => sum + call.counts[kind], 0)])) });
	}
	assert.ok((await nativeArtifactPaths(output)).includes("installed/corpus.trace"));
	return { scope: "separate-annotated-source-interposer"
		, selected, observations, observerFiles: initial
		, positiveControl: "All 59 selected public, validator, constructor, adapter and source identities observed; missing LD_PRELOAD rejected"
		, sourceRemovedBeforeInstallation: true, compilerFreeReplay: true
		, relocatedInstallation: true
		, unmeasured: ["Unmodified release dispatch", "Memory usage", "Other host entry counts"] };
};
