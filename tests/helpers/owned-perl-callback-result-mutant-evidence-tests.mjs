/**
 * Verify original compiled negatives without accepting crashes or renamed defects.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertOwnedPerlCallbackMutants } from "./owned-perl-callback-result-mutant-evidence.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_EVIDENCE_TEST === "1";
const directory = process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_MUTANT_REPORTS ?? "build/owned-perl-callback-result-mutants";
const report = async mode => JSON.parse(await readFile(join(directory, mode + ".json"), "utf8"));
const mutant = item => item.observations[0].rejectedMutations[0];

test("Perl callback mutant evidence reconstructs all 32 compiled negative controls", { skip: !enabled }, async () => {
	for(const mode of ["ordinary", "reviewed"]) await assertOwnedPerlCallbackMutants(mode, await report(mode));
});

test("Perl callback mutant evidence rejects relabelled defects, crashes and missing restoration", { skip: !enabled }, async t => {
	const mutations = [
		item => { item.complete = false; }
		, item => { item.complete = "true"; }
		, item => { item.acceptance = "passed"; }
		, item => { item.installedPackage = true; }
		, item => { item.variant = "no-host"; }
		, item => { item.mode = item.mode === "ordinary" ? "reviewed" : "ordinary"; }
		, item => { item.input.sourceIdentity.leanCompilerSha256 = "0".repeat(64); }
		, item => { item.xsSha256 = "0".repeat(64); }
		, item => { item.probe = "print qq(ok);"; item.probeSha256 = sha256(item.probe); }
		, item => { item.observations.pop(); }
		, item => { item.observations[1] = structuredClone(item.observations[0]); }
		, item => { item.observations[0].rejectedMutations.pop(); }
		, item => { item.observations[0].rejectedMutations.reverse(); }
		, item => { mutant(item).name = "unrelated-defect"; }
		, item => { mutant(item).before = "wrong-source"; }
		, item => { mutant(item).after = mutant(item).before; }
		, item => { mutant(item).occurrences++; }
		, item => { mutant(item).sourceSha256 = "0".repeat(64); }
		, item => { mutant(item).semantic.pattern = ".*"; }
		, item => { mutant(item).compiled = false; }
		, item => { mutant(item).semanticRejected = false; }
		, item => { mutant(item).compilation.code = 1; }
		, item => { mutant(item).execution.code = 0; }
		, item => { mutant(item).execution.code = 139; }
		, item => { mutant(item).execution.signal = "SIGSEGV"; }
		, item => { mutant(item).execution.stderr = "unrelated error\n"; }
		, item => { mutant(item).execution.stderr += "other failure\n"; }
		, item => { mutant(item).execution.stderr += "unreleased native ownership\n"; }
		, item => { mutant(item).restorationCompilation.code = 1; }
		, item => { delete mutant(item).restored; }
		, item => { mutant(item).restored.execution.code = 1; }
		, item => { delete item.observations[0].final; }
		, item => {
			const control = mutant(item).restored;
			control.observed.owners = 1;
			control.execution.stdout = JSON.stringify(JSON.parse(canonicalJson(control.observed))) + "\n";
		}
		, item => {
			const control = item.observations[0].final;
			control.observed.checks--; control.observed.phases.combined--;
			control.execution.stdout = JSON.stringify(JSON.parse(canonicalJson(control.observed))) + "\n";
		}
	];
	let rejected = 0;
	for(const mode of ["ordinary", "reviewed"])
	{
		const original = await report(mode);
		for(const [index, mutate] of mutations.entries())
		{
			const item = structuredClone(original); mutate(item);
			await assert.rejects(() => assertOwnedPerlCallbackMutants(mode, item), undefined, `${mode}: mutation ${index}`);
			rejected++;
		}
	}
	t.diagnostic(`${rejected} false compiled-mutant claims rejected`);
});
