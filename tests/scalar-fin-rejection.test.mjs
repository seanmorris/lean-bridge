/**
 * Out-of-bound top-level scalar Fin fails installed npm calls on every private ABI, never defaulting.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { canonicalJson } from "../src/capsule/node.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { checkScalarFinRejection, scalarFinRejectionAbis } from "./helpers/scalar-fin-rejection-packages.mjs";
import { refinementEngineTransport } from "./helpers/refinement-engine.mjs";
import "./helpers/refinement-engine-tests.mjs";
import { scalarFinSourceEntryProbe, sourceEntryInstrumentation } from "./helpers/scalar-fin-source-entry.mjs";
import "./helpers/scalar-fin-source-entry-tests.mjs";

const enabled = process.env.LEAN_BRIDGE_LAKE_WASM_TEST === "1";
const engineRoot = process.cwd();
const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix", LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot };
const fixture = async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-scalar-fin-rejection-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const root = join(directory, "project");
	await cp("tests/fixtures/documentation/lean-author", root, { recursive: true });
	return { directory, root };
};
const build = (root, outputRoot) => buildCanonicalProject({ projectRoot: root, outputRoot, engineRoot, environment, targets: ["npm"], runner: refinementEngineTransport() });

test("installed scalar Fin rejects through the public API and the internal runtime on every non-structured private ABI", { skip: !enabled, timeout: 3_600_000 }, async t => {
	const observations = [];
	for(const abi of scalarFinRejectionAbis) observations.push(await checkScalarFinRejection(t, { fixture, build, runtimeRoot }, abi));
	assert.deepEqual(observations.map(item => item.privateAbi), [2, 3, 4, 5, 6, 7]);
	for(const item of observations) assert.ok(item.checks > 100 && item.rejections > 2000, item.abi);
	const reportPath = resolve(process.env.LEAN_BRIDGE_SCALAR_FIN_REJECTION_REPORT ?? "build/scalar-fin-rejection/report.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, observations }));
});

const sourceEntry = enabled && process.env.LEAN_BRIDGE_SCALAR_FIN_SOURCE_ENTRY === "1";

test("installed scalar Fin rejections never enter the Lean source on any private ABI", { skip: !sourceEntry, timeout: 3_600_000 }, async t => {
	const observations = [], reportPath = resolve(process.env.LEAN_BRIDGE_SCALAR_FIN_SOURCE_ENTRY_REPORT ?? "build/scalar-fin-source-entry/report.json");
	const probe = scalarFinSourceEntryProbe(join(dirname(reportPath), "calls"));
	for(const abi of scalarFinRejectionAbis) observations.push(await checkScalarFinRejection(t, { fixture, build, runtimeRoot }, abi, probe));
	assert.deepEqual(observations.map(item => item.privateAbi), [2, 3, 4, 5, 6, 7]);
	for(const item of observations) assert.ok(item.checks > 100 && item.rejections > 2000 && item.sourceEntry.rejected === item.rejections, item.abi);
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, instrumentation: sourceEntryInstrumentation, observations }));
});
