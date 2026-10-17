/**
 * Source-only controls for the recursive checked-record WIT caller. The genuine generated
 * public headers and graph encoders compile here; no Lean library or installed package runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateCopiedCGraphTypes } from "../../src/backends/c/copied-graph-layout.mjs";
import { compileCopiedWitGraphPackageModel } from "../../src/backends/wit/copied-graph-package.mjs";
import { renderWitGraphConversions } from "../../src/backends/wit/copied-graph-conversions.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { mutualCheckedRecordConfiguration } from "./mutual-checked-record-fixture.mjs";
import { recursiveCheckedRecordConfiguration } from "./recursive-checked-record-fixture.mjs";
import {
	parseRecursiveCheckedRecordWitResult, recursiveCheckedRecordWitCaller
	, recursiveCheckedRecordWitConfiguration, recursiveCheckedRecordWitCounts
	, recursiveCheckedRecordWitPackage, recursiveCheckedRecordWitReview
	, recursiveCheckedRecordWitSelection
} from "./recursive-checked-record-wit-fixture.mjs";
import { assertRecursiveCheckedRecordWitResources } from "./recursive-checked-record-wit-resources.mjs";

export const recursiveCheckedRecordWitModuleFaults = Object.freeze({
	recursive: Object.freeze(["second-normalizes-root-only"])
	, mutual: Object.freeze(["stop-as-none"])
});
export const recursiveCheckedRecordWitFaults = Object.freeze([
	"produce-offset", "produce-single", "produce-digits"
	, "accept-noncanonical", "wrong-host-message", "missing-fin"
	, "missing-normalization", "conflated-constructor", "diagnostic-suffix"
	, "wrong-path", "root-only", "echo-unnormalized", "echo-drops-tail"
	, "cycle-as-lean", "depth-unbounded", "shared-as-cycle", "groups-drop-none"
	, "echo-groups-drops-none", "poison-after-reject", "accept-used-slot"
	, "partial-output", "mutate-input"
]);
const compiler = "/usr/bin/cc", flags = ["-std=c11", "-O1", "-Wall", "-Wextra", "-Werror"];
const wasmtime = resolve(process.env.LEAN_BRIDGE_WASMTIME_C_API ?? ".toolchains/wasmtime42");
// Incomplete Wasmtime types let the genuine public header compile without the engine.
const standIn = `#include <stddef.h>
typedef struct { size_t size; char *data; } wasm_name_t;
typedef struct wasmtime_error wasmtime_error_t;
typedef struct wasmtime_component_linker wasmtime_component_linker_t;
typedef struct wasmtime_component_val wasmtime_component_val_t;
void wasmtime_error_message(const wasmtime_error_t *, wasm_name_t *);
void wasmtime_error_delete(wasmtime_error_t *);
void wasm_name_delete(wasm_name_t *);
`;
const headers = async (root, fixture) => {
	const { prefix } = recursiveCheckedRecordWitPackage(fixture), ir = recursiveCheckedRecordWitReview(fixture);
	const model = compileCopiedWitGraphPackageModel(ir, {}, { refinementDiagnostics: true });
	assert.equal(model.prefix, prefix);
	await saveLakeFile(root, `include/${prefix}-graph.h`, generateCopiedCGraphTypes(ir).header);
	await saveLakeFile(root, `include/${prefix}_wasmtime.h`, model.hostHeader);
	return model;
};

test("recursive checked-record WIT caller detects every result, input and cycle fault in an oracle", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-recursive-wit-model-"));
	t.after(() => rm(root, { recursive: true }));
	const caller = await readFile(recursiveCheckedRecordWitCaller, "utf8");
	await saveLakeFile(root, "consumer.c", caller);
	await saveLakeFile(root, "include/wasmtime.h", standIn); await saveLakeFile(root, "include/wasmtime/component.h", "");
	const model = resolve("tests/helpers/recursive-checked-record-wit-model.c");
	for(const fixture of ["recursive", "mutual"])
	{
		await headers(root, fixture);
		const { define } = recursiveCheckedRecordWitPackage(fixture), binary = join(root, fixture);
		await runCopied(compiler, [...flags, ...define ? [`-D${define}`] : [], "-I", join(root, "include"), "consumer.c", model, "-o", binary], root, { PATH: "/usr/bin:/bin" });
		const run = await runCopied(binary, [], root, { PATH: "/usr/bin:/bin" });
		assert.equal(run.stderr, "");
		assert.deepEqual(parseRecursiveCheckedRecordWitResult(run.stdout, fixture), recursiveCheckedRecordWitCounts[fixture]);
		for(const fault of [...recursiveCheckedRecordWitFaults, ...recursiveCheckedRecordWitModuleFaults[fixture]])
		{
			const outcome = await runCopied(binary, [], root, { PATH: "/usr/bin:/bin", RECURSIVE_CHECKED_RECORD_FAULT: fault })
				.then(() => null, error => error);
			assert.ok(outcome, `caller accepted ${fixture} fault ${fault}`);
			assert.match(JSON.stringify(outcome.details ?? outcome.message), /failed: |: expected '/u, `${fixture} ${fault} failed for a caller reason`);
		}
	}
	assert.equal(await readFile(join(root, "consumer.c"), "utf8"), caller);
	t.diagnostic("A C runtime double exercises the caller with the generated public headers; no installed Lean library executes.");
});

test("recursive checked-record WIT host refusals match the generated graph encoders", async t => {
	if(await access(join(wasmtime, "include/wasmtime.h")).then(() => false, () => true))
	{
		t.skip(`The Wasmtime C API is unavailable at ${wasmtime}`);
		return;
	}
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-recursive-wit-encoders-"));
	t.after(() => rm(root, { recursive: true }));
	const probe = resolve("tests/helpers/recursive-checked-record-wit-encoders.c");
	for(const fixture of ["recursive", "mutual"])
	{
		const { prefix, define } = recursiveCheckedRecordWitPackage(fixture), ir = recursiveCheckedRecordWitReview(fixture);
		const model = compileCopiedWitGraphPackageModel(ir, {}, { refinementDiagnostics: true });
		const index = predicate => model.nodes.find(predicate).index;
		const aliases = model.hostHeader.slice(model.hostHeader.indexOf("/* Stable names"), model.hostHeader.lastIndexOf("#endif"));
		await saveLakeFile(root, `${prefix}-graph-types.h`, generateCopiedCGraphTypes(ir).header);
		await saveLakeFile(root, `${prefix}-conversions.h`, `#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <wasmtime.h>
#include <wasmtime/component.h>
#include "${prefix}-graph-types.h"
${renderWitGraphConversions(model)}
${aliases}
#define ENCODE_RECORD lb_graph_encode_${index(node => node.kind === "record" && node.ref.kind === "named")}
#define ENCODE_GROUPS lb_graph_encode_${index(node => node.kind === "array")}
`);
		const binary = join(root, `encoders-${fixture}`);
		const args = ["-std=c11", "-O1", "-w", ...define ? [`-D${define}`] : []
			, "-I", root, "-I", join(wasmtime, "include"), probe
			, "-L", join(wasmtime, "lib"), "-lwasmtime", "-o", binary];
		await runCopied(compiler, args, root, { PATH: "/usr/bin:/bin" });
		const run = await runCopied(binary, [], root, { PATH: "/usr/bin:/bin", LD_LIBRARY_PATH: join(wasmtime, "lib") });
		assert.equal(run.stderr, "");
		assert.deepEqual(JSON.parse(run.stdout), { encoderChecks: fixture === "mutual" ? 14 : 12 });
	}
});

test("recursive checked-record WIT keeps both author contracts and package coordinates", async () => {
	const base = { recursive: recursiveCheckedRecordConfiguration, mutual: mutualCheckedRecordConfiguration };
	for(const route of ["ordinary", "reviewed"]) for(const fixture of ["recursive", "mutual"])
	{
		const expected = base[fixture](route), actual = recursiveCheckedRecordWitConfiguration(route, fixture);
		validateExportConfiguration(actual);
		assert.deepEqual({ ...actual, targets: expected.targets }, expected);
		assert.deepEqual(actual.targets, { "wit-wasi": { name: `${fixture}checkedrecords`, version: "1.0.0" } });
	}
	const caller = await readFile(recursiveCheckedRecordWitCaller, "utf8");
	// One caller source serves both modules; only its compile-time define differs.
	assert.equal(caller.split("#ifdef RECURSIVE_CHECKED_RECORD_MUTUAL").length, 2);
	for(const fixture of ["recursive", "mutual"])
	{
		const pkg = recursiveCheckedRecordWitPackage(fixture);
		assert.equal(pkg.prefix, `${fixture}checkedrecords`);
		assert.equal(pkg.define, fixture === "mutual" ? "RECURSIVE_CHECKED_RECORD_MUTUAL" : null);
		const counts = recursiveCheckedRecordWitCounts[fixture];
		const stdout = `${JSON.stringify(Object.fromEntries(Object.entries(counts).sort()))}\n`;
		assert.deepEqual(parseRecursiveCheckedRecordWitResult(stdout, fixture), counts);
		for(const key of Object.keys(counts).filter(key => key !== "module"))
			assert.throws(() => parseRecursiveCheckedRecordWitResult(stdout.replace(`"${key}":${counts[key]}`
				, `"${key}":${counts[key] + 1}`), fixture));
		assert.throws(() => parseRecursiveCheckedRecordWitResult(stdout.replace("{", "{\"extra\":1,"), fixture));
	}
	assert.throws(() => recursiveCheckedRecordWitPackage("unknown"));
});

test("recursive checked-record WIT gates reject disabled selections and unsupported modules", () => {
	const prefix = "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_WIT_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(recursiveCheckedRecordWitSelection({}), {
		enabled: false, routes: ["ordinary", "reviewed"]
		, fixtures: ["recursive", "mutual"], maxLoad: 8
	});
	for(const flag of ["", "true", "2", true, null])
		assert.throws(() => recursiveCheckedRecordWitSelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["FIXTURES", "recursive"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`, true, null])
			assert.throws(() => recursiveCheckedRecordWitSelection({ ...enabled, [prefix + name]: raw }));
		for(const flag of [undefined, "0"])
			assert.throws(() => recursiveCheckedRecordWitSelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
	}
	for(const maxLoad of [8, 12, 16, 20])
		assert.equal(recursiveCheckedRecordWitSelection({ ...enabled, [prefix + "MAX_LOAD"]: String(maxLoad) }).maxLoad, maxLoad);
	for(const maxLoad of ["", "6", "24", "eight"])
		assert.throws(() => recursiveCheckedRecordWitSelection({ ...enabled, [prefix + "MAX_LOAD"]: maxLoad }));
	const GiB = 1024 ** 3, admitted = { freeBytes: 3 * GiB, availableBytes: 4 * GiB, load: 7.5 };
	assertRecursiveCheckedRecordWitResources({ observations: [admitted], waits: 0 }, 8);
	assert.throws(() => assertRecursiveCheckedRecordWitResources({ observations: [{ ...admitted, load: 8 }], waits: 0 }, 8));
});
