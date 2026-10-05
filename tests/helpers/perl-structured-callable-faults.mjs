/**
 * Separate XS checkpoints preserve original installed archives and libraries.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";

/**
 * Require every shape, constructor seed, execution path and exception mode.
 *
 * @param report - Output from the separately compiled, installed-runtime probe.
 */
export const assertPerlStructuredFaults = report => {
	assert.equal(report.schemaVersion, 1);
	assert.ok(report.checks > 10000); assert.ok(report.failures > 1000);
	assert.equal(report.scenarios.length, 160);
	assert.deepEqual(report.scenarios.map(({ shape, seed, path }) => `${shape}/${seed}/${path}`),
		["array", "list", "option", "result", "tuple", "record", "variant", "alias"]
			.flatMap(shape => [0, 1, 2, 3].flatMap(seed =>
				["callback", "twice", "create", "create-call", "held-call"].map(path => `${shape}/${seed}/${path}`))));
	const checkpoints = report.scenarios.reduce((sum, item) => sum + item.checkpoints, 0);
	assert.equal(report.failures, 2 * checkpoints);
	assert.deepEqual(report.errorModes, { message: checkpoints, object: checkpoints });
	for(const item of report.scenarios)
	{
		assert.ok(Number.isSafeInteger(item.checkpoints) && item.checkpoints > 0);
		assert.equal(item.baseline.count, item.checkpoints);
		assert.equal(item.baseline.live_scopes, 0);
		assert.equal(item.baseline.live_owners, 0);
		for(const key of ["keeps", "callbacks", "resources", "borrows"])
			assert.ok(Number.isSafeInteger(item.baseline[key]) && item.baseline[key] >= 0);
	}
	assert.equal(report.deferredClose, 4);
	for(const key of ["liveScopes", "liveOwners", "liveCallbacks", "liveIdentities"])
		assert.equal(report[key], 0, key);
};

/**
 * Insert checkpoints after ownership registration without rewriting conversions.
 *
 * @param original - Exact Component.xs bytes from the verified CPAN archive.
 */
export const instrumentPerlStructuredCallables = original => {
	const marker = '#include "component.h"';
	assert.equal(original.split(marker).length, 2);
	assert.equal((original.match(/^typedef struct \{.*lb_callback_frame_/gm) ?? []).length, 14);
	assert.equal((original.match(/^_callback_[a-f0-9]+\(\.\.\.\)$/gm) ?? []).length, 14);
	assert.equal((original.match(/^call\(\.\.\.\)$/gm) ?? []).length, 14);
	assert.equal((original.match(/^ {4}LBP_ENTER\(\);$/gm) ?? []).length, 54);
	for(const name of ["lbp_keep", "lbp_budget", "lbp_resource", "lbp_borrow", "lbp_callback_new"])
		assert.ok(original.includes(`${name}(`), name);
	return original.replace(marker, `${marker}\n#include "perl-probe.h"`) + `
MODULE = LeanBridge::Structured    PACKAGE = LeanBridge::Structured

void
_structured_probe(...)
  PPCODE:
    if (items < 1 || items > 2) croak("probe expects a failure index and optional error object");
    ST(0) = lb_test_reset(aTHX_ SvUV(ST(0)), items == 2 ? ST(1) : NULL);
    XSRETURN(1);
`;
};

/**
 * Compile an isolated copy with headers from the original relocated installation.
 *
 * @param options - Verified package sources and selected Perl ABI.
 * @param options.consumer - Test-owned compilation and execution workspace.
 * @param options.perl - Absolute pinned interpreter executable.
 * @param options.prepared - Exact verified component archive contents.
 * @param options.lib - Relocated installed Perl library directory.
 * @param options.environment - Producer tools, removed from execution environment.
 */
export const preparePerlStructuredFaults = async options => {
	const { consumer, perl, prepared, lib, environment } = options;
	const original = prepared.files.get("Component.xs").toString();
	const xs = instrumentPerlStructuredCallables(original);
	const read = name => readFile(`tests/fixtures/structured-callable-consumers/${name}`, "utf8");
	const sources = { "perl-probe.h": await read("perl-probe.h")
		, "perl-values.pl": await read("perl-values.pl")
		, "perl-faults.pl": await read("perl-faults.pl") };
	const builder = (await readFile("tests/fixtures/list-consumers/perl-probe-build.pl", "utf8"))
		.replaceAll("LeanBridge::Lists", "LeanBridge::Structured");
	await saveLakeFile(consumer, "Probe.xs", xs);
	await saveLakeFile(consumer, "component.h", prepared.files.get("component.h"));
	await saveLakeFile(consumer, "perl-probe.h", sources["perl-probe.h"]);
	await saveLakeFile(consumer, "build-faults.pl", builder);
	await runCopied(perl, ["build-faults.pl"], consumer, { ...environment, PERL5LIB: lib });
	const probeSha256 = sha256(await readFile(join(consumer, "Probe.so")));
	for(const file of ["Probe.xs", "Probe.c", "Probe.o", "component.h", "perl-probe.h", "build-faults.pl"])
		await rm(join(consumer, file));
	await saveLakeFile(consumer, "faults.pl", sources["perl-values.pl"] + "\n" + sources["perl-faults.pl"]);
	return async () => {
		const result = await runCopied(perl, ["faults.pl", join(consumer, "Probe.so")],
			consumer, { ...copiedCleanEnvironment, PERL5LIB: lib });
		assert.equal(result.stderr, "");
		const report = JSON.parse(result.stdout);
		assertPerlStructuredFaults(report);
		return { ...report, originalXsSha256: sha256(original)
			, instrumentedXsSha256: sha256(xs), probeSha256
			, sourceHashes: Object.fromEntries(Object.entries(sources)
				.map(([name, bytes]) => [name, sha256(bytes)]))
			, builderSha256: sha256(builder), isolatedXsCopy: true
			, installedRuntime: true, compilerFreeExecution: true };
	};
};
