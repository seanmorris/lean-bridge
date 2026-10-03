/**
 * Check original fault traces and coordinated false handoff/cleanup claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertOwnedPerlCallbackFaults } from "./owned-perl-callback-result-fault-evidence.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_EVIDENCE_TEST === "1";
const directory = process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_FAULT_REPORTS ?? "build/owned-perl-callback-result-faults";
const report = async mode => JSON.parse(await readFile(join(directory, mode + ".json"), "utf8"));
const observationMutation = mutate => item => {
	const observation = item.observations[0]; mutate(observation.observed);
	observation.execution.stdout = JSON.stringify(JSON.parse(canonicalJson(observation.observed)));
};

test("Perl callback fault evidence reconstructs both original four-ABI sweeps", { skip: !enabled }, async () => {
	for(const mode of ["ordinary", "reviewed"]) await assertOwnedPerlCallbackFaults(mode, await report(mode));
});

test("Perl callback fault evidence rejects forged transfer, cleanup and exception traces", { skip: !enabled }, async t => {
	const mutations = [
		item => { item.schemaVersion++; }
		, item => { item.finalAcceptance = true; }
		, item => { item.mode = item.mode === "ordinary" ? "reviewed" : "ordinary"; }
		, item => { item.kind = "owned-perl-callback-results-runtime"; }
		, item => { item.actualLean = false; }
		, item => { item.installedPackage = true; }
		, item => { item.options.transferredInputs = false; }
		, item => { item.input.sourceIdentity.extractorSha256 = "0".repeat(64); }
		, item => { item.nativeSourceSha256 = "0".repeat(64); }
		, item => { item.xsSha256 = "0".repeat(64); }
		, item => { item.probe = "print qq(ok);"; item.probeSha256 = sha256(item.probe); }
		, item => { item.observations.pop(); }
		, item => { item.observations[1] = structuredClone(item.observations[0]); }
		, item => { item.observations[0].build.code = 1; }
		, item => { item.observations[0].execution.code = 1; }
		, item => { item.observations[0].execution.signal = "SIGABRT"; }
		, item => { item.observations[0].execution.stderr = "unreleased ownership"; }
		, item => { item.observations[0].execution.stdout = "{}"; }
		, observationMutation(observed => { observed.acceptance = "passed"; })
		, observationMutation(observed => { observed.perlVersion = "v5.40.0"; })
		, observationMutation(observed => { observed.threaded = 1 - observed.threaded; })
		, observationMutation(observed => { observed.checks--; })
		, observationMutation(observed => { observed.heldErrors--; })
		, observationMutation(observed => { observed.baseline[1]++; })
		, ...[0, 1, 2, 3, 4, 5].map(index => observationMutation(observed => { observed.final[index]++; }))
		, observationMutation(observed => { observed.attempts.pop(); })
		, observationMutation(observed => { observed.sweeps.raw.allocator.before--; })
		, observationMutation(observed => { observed.sweeps.raw.native.replyEnteredFailures = 0; })
		, observationMutation(observed => { observed.attempts[1].index++; })
		, observationMutation(observed => { observed.attempts[0].handoffBefore++; })
		, observationMutation(observed => { observed.attempts[0].retainedSerial = 0; })
		, observationMutation(observed => { observed.attempts[0].cleanup[0]++; })
		, observationMutation(observed => { observed.attempts[0].calls = [0, 0]; })
		, observationMutation(observed => { observed.attempts[1].calls = [1, 0]; })
		, observationMutation(observed => { observed.attempts[1].closed = [1, 1, 1]; })
		, observationMutation(observed => { observed.attempts[1].injectionSnapshot[6] = 123; })
		, observationMutation(observed => { observed.attempts[1].injectionSnapshot[7] = 3; })
		, observationMutation(observed => {
			observed.attempts.find(item => item.domain === "allocator" && item.ok).injectionSnapshot[4] = 0;
		})
		, observationMutation(observed => {
			const final = observed.attempts.find(item => item.restoredAfter === "intentional-exception");
			observed.attempts = [
				...observed.attempts.filter(item => item.domain === "none" && item !== final)
				, ...observed.attempts.filter(item => item.domain !== "none"), final
			];
			let handoff = 0;
			for(const item of observed.attempts)
			{
				if(item === final)
				{
					observed.exception.handoffBefore = handoff;
					observed.exception.handoffAfter = ++handoff;
				}
				item.handoffBefore = handoff; handoff += item.handoffDelta;
				item.handoffAfter = handoff;
			}
		})
		, observationMutation(observed => {
			observed.attempts.find(item => !item.ok && item.handoffDelta).closed = [0, 0, 0];
		})
		, observationMutation(observed => {
			observed.attempts.find(item => item.kind === "whole-reply").independentSerial = null;
		})
		, observationMutation(observed => {
			const terminal = observed.attempts.find(item => item.domain === "allocator" && item.ok);
			terminal.injectionSnapshot[4] = terminal.index;
		})
		, observationMutation(observed => {
			observed.attempts.find(item => item.restoredAfter === "allocator").restoredAfter = "native";
		})
		, observationMutation(observed => { observed.exception.actualAddress++; })
		, observationMutation(observed => { observed.exception.actualClass = "ReplacementError"; })
		, observationMutation(observed => { observed.exception.cleanup[2]++; })
		, observationMutation(observed => { observed.exception.calls = [1, 1]; })
		, observationMutation(observed => { observed.exception.recoverySerial = 0; })
	];
	let rejected = 0;
	for(const mode of ["ordinary", "reviewed"])
	{
		const original = await report(mode);
		for(const [index, mutate] of mutations.entries())
		{
			const item = structuredClone(original); mutate(item);
			await assert.rejects(() => assertOwnedPerlCallbackFaults(mode, item), undefined, `${mode}: mutation ${index}`);
			rejected++;
		}
	}
	t.diagnostic(`${rejected} altered fault reports rejected, including coordinated stdout changes`);
});
