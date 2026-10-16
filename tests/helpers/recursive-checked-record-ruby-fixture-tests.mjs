/**
 * Source-only controls for the recursive checked-record Ruby caller. No compiled Lean
 * library or installed gem executes here; the caller runs against a Ruby oracle.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateCopiedRubyGraphPackage } from "../../src/backends/ruby/copied-graph-package.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { recursiveCheckedRecordReview } from "./recursive-checked-record-fixture.mjs";

export const recursiveCheckedRecordRubyCaller
	= "tests/fixtures/recursive-checked-record-consumers/ruby.rb";
export const recursiveCheckedRecordRubyCounts = Object.freeze({
	checks: 1083, hostRejections: 78, module: "recursive", recoveries: 64
	, rejections: 144, rounds: 64, snapshotControls: 8, snapshots: 495
});
export const recursiveCheckedRecordRubyFaults = Object.freeze([
	"produce-offset", "produce-single", "produce-digits", "accept-bool"
	, "wrong-host-exception", "alias-constant", "missing-fin"
	, "missing-normalization", "conflated-constructor", "diagnostic-suffix"
	, "wrong-status", "wrong-path", "root-only", "echo-unnormalized"
	, "echo-drops-tail", "cycle-as-lean", "depth-unbounded", "shared-as-cycle"
	, "groups-drop-none", "echo-groups-drops-none", "poison-after-reject"
	, "second-normalizes-root-only"
]);
const ruby = resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby");

test("recursive checked-record Ruby caller detects every result, input and cycle fault in an oracle", async t => {
	if(await access(ruby).then(() => false, () => true))
	{
		t.skip(`Ruby 3.3 is unavailable at ${ruby}`);
		return;
	}
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-recursive-ruby-model-"));
	t.after(() => rm(root, { recursive: true }));
	const caller = await readFile(recursiveCheckedRecordRubyCaller, "utf8");
	await saveLakeFile(root, "consumer.rb", caller);
	const files = generateCopiedRubyGraphPackage(recursiveCheckedRecordReview(), null
		, { refinementDiagnostics: true });
	await saveLakeFile(root, "public.rb", files["lib/lean_bridge/recursivecheckedrecords.rb"]);
	const model = resolve("tests/helpers/recursive-checked-record-ruby-model.rb");
	const run = await runCopied(ruby, [model, join(root, "consumer.rb"), join(root, "public.rb")], root);
	assert.equal(run.stderr, "");
	const result = JSON.parse(run.stdout);
	assert.equal(result.installedAcceptance, false);
	assert.deepEqual(result.result, recursiveCheckedRecordRubyCounts);
	assert.deepEqual(result.rejectedFaults, recursiveCheckedRecordRubyFaults);
	assert.equal(await readFile(join(root, "consumer.rb"), "utf8"), caller);
	t.diagnostic("A Ruby runtime double exercises the caller with generated value classes; no installed Lean library executes.");
});
