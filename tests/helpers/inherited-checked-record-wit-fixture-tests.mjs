/**
 * Source-only WIT contract and caller controls for inherited checked records.
 * No compiled Lean component or installed package executes here.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import test from "node:test";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { renderWitHostHeader } from "../../src/backends/wit/copied-host.mjs";
import { compileCopiedWitModel } from "../../src/backends/wit/copied-model.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import {
	inheritedCheckedRecordWitCaller
	, inheritedCheckedRecordWitCallerDirectives
	, inheritedCheckedRecordWitConfiguration
	, inheritedCheckedRecordWitCounts
	, inheritedCheckedRecordWitModes
	, inheritedCheckedRecordWitReview
	, inheritedCheckedRecordWitRoutes
	, inheritedCheckedRecordWitSelection
	, inheritedCheckedRecordWitTarget
	, parseInheritedCheckedRecordWitResult
} from "./inherited-checked-record-wit-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const capi = process.env.LEAN_BRIDGE_WASMTIME_C_API ?? resolve(".toolchains/wasmtime42");
const cc = process.env.CC ?? "/usr/bin/cc";
const callerControls = process.env.LEAN_BRIDGE_WASMTIME_C_API !== undefined
	|| existsSync(join(capi, "include/wasmtime.h"));

const fullNames = [
	"first", "normalized", "pair", "aliased", "nested", "echo"
	, "produce", "produce-stamped"
];

test("inherited checked-record WIT preserves parent subobjects and result-only erasure", async () => {
	for(const route of inheritedCheckedRecordWitRoutes)
		for(const mode of inheritedCheckedRecordWitModes)
		{
			const configuration = inheritedCheckedRecordWitConfiguration(route, mode);
			validateExportConfiguration(configuration);
			assert.deepEqual(configuration.targets, {
				"wit-wasi": { name: "inheritedcheckedrecords", version: "1.0.0" }
			});
			assert.equal(Object.hasOwn(configuration, "exports"), route === "ordinary");
			if(route === "ordinary") assert.deepEqual(
				configuration.exports.map(name => name.split(".").at(-1))
				, mode === "full"
					? ["first", "normalized", "pair", "aliased", "nested", "echo"
						, "produce", "produceStamped"]
					: ["produce", "produceStamped"]
			);
			const review = inheritedCheckedRecordWitReview(mode);
			validateBindingIr(review);
			const projection = compileCopiedWitModel(
				review, configuration.targets["wit-wasi"], { callables: true }
			);
			assert.deepEqual(projection.surface.functions.map(fn => fn.witName)
				, mode === "full" ? fullNames : fullNames.slice(-2));
			const span = projection.surface.copies.find(copy => copy.witName === "span");
			const ticket = projection.surface.copies.find(copy => copy.witName === "ticket");
			const stamped = projection.surface.copies.find(copy => copy.witName === "stamped");
			assert.deepEqual(span.fields.map(field => field.witName), ["lo", "hi"]);
			assert.deepEqual(ticket.fields.map(field => [field.witName, field.type.wit])
				, [["to-span", "span"], ["word", "bridge-value-0"]]);
			assert.deepEqual(stamped.fields.map(field => [field.witName, field.type.wit])
				, [["to-ticket", "ticket"], ["mark", "bridge-value-0"]]);
			assert.match(projection.wit
				, /record span \{ lo: bridge-value-0, hi: bridge-value-0 \}\n {2}record ticket \{ to-span: span, word: bridge-value-0 \}\n {2}record stamped \{ to-ticket: ticket, mark: bridge-value-0 \}/u);
			assert.equal(/type ticket-alias = ticket;/u.test(projection.wit)
				, mode === "full");
			const caller = await inheritedCheckedRecordWitCaller(route, mode);
			assert.doesNotMatch(caller, /#include "wit-values\.h"/u);
			assert.equal(caller.includes("#define INHERITED_CHECKED_RECORD_RESULT_ONLY\n")
				, mode === "result-only");
			assert.equal(caller.includes('#define INHERITED_PARAMETER_PREFIX "value"\n')
				, route === "reviewed");
			for(const name of mode === "full" ? fullNames : fullNames.slice(-2))
				assert.ok(caller.includes(`"${name}"`), name);
		}
});

test("inherited checked-record WIT selections are closed and counters are exact", () => {
	const prefix = "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_WIT_";
	assert.deepEqual(inheritedCheckedRecordWitSelection({}), {
		enabled: false, routes: [...inheritedCheckedRecordWitRoutes]
		, modes: [...inheritedCheckedRecordWitModes], maxLoad: 8
	});
	assert.deepEqual(inheritedCheckedRecordWitSelection({
		[prefix + "TEST"]: "1", [prefix + "ROUTES"]: "reviewed"
		, [prefix + "MODES"]: "result-only"
		, [prefix + "OUTPUT"]: "build/x", [prefix + "MAX_LOAD"]: "20"
	}), {
		enabled: true, routes: ["reviewed"], modes: ["result-only"], maxLoad: 20
	});
	for(const environment of [
		{ [prefix + "TEST"]: "yes" }, { [prefix + "ROUTES"]: "reviewed" }
		, { [prefix + "OUTPUT"]: "build/x" }
		, { [prefix + "TEST"]: "1", [prefix + "ROUTES"]: "other" }
		, { [prefix + "TEST"]: "1", [prefix + "MODES"]: "full,full" }
		, { [prefix + "TEST"]: "1", [prefix + "MODES"]: "" }
		, { [prefix + "TEST"]: "1", [prefix + "OUTPUT"]: "" }
		, { [prefix + "MAX_LOAD"]: "20" }
		, { [prefix + "TEST"]: "0", [prefix + "MAX_LOAD"]: "20" }
		, { [prefix + "TEST"]: "1", [prefix + "MAX_LOAD"]: "6" }
		, { [prefix + "TEST"]: "1", [prefix + "MAX_LOAD"]: "24" }
	]) assert.throws(() => inheritedCheckedRecordWitSelection(environment));
	for(const mode of inheritedCheckedRecordWitModes)
	{
		const expected = inheritedCheckedRecordWitCounts[mode];
		assert.deepEqual(parseInheritedCheckedRecordWitResult(
			JSON.stringify(expected), mode), expected);
		for(const key of Object.keys(expected)) assert.throws(() =>
			parseInheritedCheckedRecordWitResult(JSON.stringify({
				...expected, [key]: expected[key] + 1
			}), mode)
		);
	}
});

export const inheritedCheckedRecordWitResultFaults = Object.freeze([
	"produce-offset", "produce-stamped-mark", "accept-noncanonical"
	, "accept-wrong-kind", "wrong-host-diagnostic", "changed-field-name"
	, "input-mutation"
]);
export const inheritedCheckedRecordWitInputFaults = Object.freeze([
	"missing-normalization", "missing-span", "missing-word", "missing-ticket"
	, "conflated-constructor", "wrong-path", "diagnostic-suffix", "missing-fin"
	, "missing-stamped", "mutate-rejected-input", "mutate-accepted-input"
	, "echo-raw"
]);

for(const route of inheritedCheckedRecordWitRoutes)
	for(const mode of inheritedCheckedRecordWitModes)
		test(`inherited checked-record WIT independent C caller rejects semantic faults ${route} ${mode}`
			, { skip: !callerControls, timeout: 300_000 }, async t => {
				assert.ok(isAbsolute(cc) && isAbsolute(capi));
				const root = await mkdtemp(join(tmpdir()
					, "lean-bridge-inherited-wit-model-"));
				let complete = false;
				t.after(async () => {
					if(complete) await rm(root, { recursive: true });
					else t.diagnostic(`Retained failed WIT model inputs: ${root}`);
				});
				const commands = [];
				const environment = { PATH: "/usr/bin:/bin", LC_ALL: "C" };
				const run = async (command, args, extra = {}) => {
					const env = { ...environment, ...extra };
					const result = spawnSync(command, args, {
						cwd: root, env, encoding: "utf8"
						, maxBuffer: 4 * 1024 ** 2, timeout: 60_000
					});
					const { status, signal, stdout, stderr } = result;
					commands.push({
						command, args, environment: env, status, signal, stdout, stderr
					});
					await saveLakeFile(root, "commands.json", canonicalJson(commands));
					assert.equal(result.error, undefined);
					assert.equal(result.signal, null);
					return commands.at(-1);
				};
				const projection = compileCopiedWitModel(
					inheritedCheckedRecordWitReview(mode)
					, { ...inheritedCheckedRecordWitTarget }, { callables: true }
				);
				await saveLakeFile(root, "inheritedcheckedrecords_wasmtime.h"
					, renderWitHostHeader(projection));
				await saveLakeFile(root, "consumer.c"
					, await inheritedCheckedRecordWitCaller(route, mode));
				await saveLakeFile(root, "wit-values.h", await readFile(
					"tests/fixtures/inherited-checked-record-consumers/wit-values.h"
				));
				const modelSource = inheritedCheckedRecordWitCallerDirectives(route, mode)
					+ await readFile(
						"tests/helpers/inherited-checked-record-wit-model.c", "utf8"
					);
				await saveLakeFile(root, "model.c", modelSource);
				const compile = await run(cc, [
					"-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG"
					, `-I${join(capi, "include")}`, "consumer.c", "model.c"
					, `-L${join(capi, "lib")}`
					, `-Wl,-rpath,${join(capi, "lib")}`
					, "-lwasmtime", "-o", "consumer"
				]);
				assert.equal(compile.status, 0, compile.stderr);
				assert.equal(compile.stderr, "");
				const baseline = await run(join(root, "consumer"), []);
				assert.equal(baseline.status, 0, baseline.stderr);
				assert.equal(baseline.stderr, "");
				parseInheritedCheckedRecordWitResult(baseline.stdout, mode);
				const faults = [
					...inheritedCheckedRecordWitResultFaults
					, ...mode === "full" ? inheritedCheckedRecordWitInputFaults : []
				];
				for(const fault of faults)
				{
					const changed = await run(join(root, "consumer"), [], {
						INHERITED_WIT_FAULT: fault
					});
					assert.equal(changed.status, 1, fault);
					assert.equal(changed.stdout, "");
					assert.match(changed.stderr, /inherited WIT check failed/u, fault);
				}
				t.diagnostic(`${faults.length} incorrect stand-ins rejected; `
					+ "no compiled Lean or installed Component Model claim");
				complete = true;
			}
		);
