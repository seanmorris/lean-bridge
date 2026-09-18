/**
 * Bind primitive callable claims to the exact installed callers and archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { callablePrimitives, callableSignatures } from "./helpers/callable-fixture.mjs";

test("Perl callable evidence covers both source paths on each pinned interpreter ABI", async () => {
	const record = JSON.parse(await readFile("docs/evidence/perl-callables-20260918.json", "utf8"));
	assert.equal(record.sourceSha256, sha256(await readFile("tests/fixtures/onboarding/callables/Callables.lean")));
	assert.equal(record.consumerSha256, sha256(await readFile("tests/fixtures/callable-consumers/perl.pl")));
	assert.deepEqual(record.signatures, callableSignatures);
	assert.equal(record.executions.length, 8);
	assert.equal(new Set(record.executions.map(run => `${run.configuration}/${run.path}`)).size, 8);
	assert.equal(new Set(record.executions.map(run => run.result.abiKey)).size, 4);
	for(const configuration of ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"])
		for(const path of ["ordinary-source", "reviewed-ir"])
		{
			const run = record.executions.find(run => run.configuration === configuration && run.path === path);
			assert.ok(run, `${configuration}/${path}`);
			assert.equal(run.profile, "perl"); assert.equal(run.checks, 8756);
			assert.equal(run.result.wordBits, 64);
			assert.equal(run.result.hostVersion, configuration.split("-")[0]);
			assert.equal(Boolean(run.result.abi.useithreads), configuration.endsWith("-threaded"));
			assert.deepEqual(run.result.primitives.map(item => item.primitive), callablePrimitives.map(([, type]) => type));
			assert.ok(run.result.primitives.every(item => item.checks > 100 && item.validCases >= 1 && item.rejectedCases >= 3));
			assert.equal(run.consumerSha256, record.consumerSha256);
			assert.equal(run.offlineInstall, true); assert.equal(run.compilerFreePath, true);
			assert.equal(run.sourceRemovedBeforeInstallation, true);
			for(const field of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) assert.match(run[field], /^[a-f0-9]{64}$/);
			assert.deepEqual(run.packages.map(pkg => pkg.role).sort(), ["component", "runtime"]);
			for(const pkg of run.packages) for(const archive of pkg.artifacts) assert.match(archive.sha256, /^[a-f0-9]{64}$/);
		}
});
