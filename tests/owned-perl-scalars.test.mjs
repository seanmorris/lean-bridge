/**
 * Execute every owned scalar field and boundary through fresh Perl XS consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { prepareOwnedPerlNative } from "./helpers/owned-perl-native.mjs";
import { perlGraphCommands } from "./helpers/perl-graph-probes.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

for(const reviewed of [false, true]) test(`Perl scalar records preserve exact native fields and reject malformed values (${reviewed ? "reviewed" : "ordinary"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await prepareOwnedPerlNative(t, { fixture: "owned-scalars"
		, witness: "import Owned\n"
		, ...(reviewed ? { reviewedIr: ownedPythonScalarsReviewedIr() } : {}) });
	const consumer = await readFile("tests/fixtures/structured-types/owned-perl-scalars.pl", "utf8");
	await saveLakeFile(compiled.directory, "consumer.pl", consumer);
	const observations = [];
	for(const perl of perlGraphCommands())
	{
		await runCopied(perl, ["build.pl"], compiled.directory, { ...compiled.environment, CC: "/usr/bin/cc", LD: "/usr/bin/cc" });
		const execution = await runCopied(perl, ["-I.", "consumer.pl"], compiled.directory, compiled.environment);
		assert.equal(execution.stderr, "");
		const observed = JSON.parse(execution.stdout);
		assert.equal(observed.scalarFields, 19);
		assert.deepEqual(observed.exports, compiled.model.functions.map(fn => fn.publicName).sort());
		assert.ok(observed.checks > 200); assert.ok(observed.allocatorFailures > 0);
		assert.ok(observed.exceptions > 0); assert.ok(observed.nativeFailures > 0);
		assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
		t.diagnostic(JSON.stringify(observed)); observations.push({ perl, observed });
	}
	await saveLakeFile(resolve("build/owned-perl-scalars"), `${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({
		observations, compiledLean: true, installedPackage: false
		, sourceIdentitySha256: sha256(canonicalJson(compiled.sourceIdentity))
		, nativeSourceSha256: sha256(compiled.native)
		, declarationsSha256: sha256(compiled.model.declarations)
		, valuesSha256: sha256(compiled.model.valuesSource)
		, xsSha256: sha256(compiled.xs), consumerSha256: sha256(consumer)
	}));
});
