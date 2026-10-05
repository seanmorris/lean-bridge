/**
 * Receiver members compose with callbacks and closures without result anchors.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { ownedRustReceiverConfiguration, ownedRustReceiverReviewedIr, ownedRustReceiverSource } from "./helpers/owned-rust-receiver-fixture.mjs";
import { ownedPerlUnanchoredReceiverProbe as consumer } from "./helpers/owned-perl-receiver-fixture.mjs";
import { prepareOwnedPerlNative } from "./helpers/owned-perl-native.mjs";
import { perlGraphCommands } from "./helpers/perl-graph-probes.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

for(const mode of ["ordinary", "reviewed"]) test(`Perl receiver callables need no result anchors (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PERL_RECEIVER_TEST !== "1"
	, timeout: 600000
}, async t => {
	const configuration = await ownedRustReceiverConfiguration();
	for(const [name, contract] of Object.entries(configuration.contracts))
	{
		delete contract.result;
		if(Object.keys(contract).length === 0) delete configuration.contracts[name];
	}
	const ir = ownedRustReceiverReviewedIr();
	for(const fn of ir.declarations) if(fn.result.ownership === "borrow")
		Object.assign(fn.result, { ownership: "lease", lifetime: { scope: "explicit", anchor: null } });
	const compiled = await prepareOwnedPerlNative(t, {
		...mode === "ordinary" ? { configuration } : { reviewedIr: ir }
		, hostCallbacks: true, receiverExports: true, transferredInputs: true
		, sourceSuffix: ownedRustReceiverSource
		, evidenceName: `perl-receiver-${mode}-unanchored-inputs.json`
	});
	assert.equal(compiled.c.values.anchoredResults, undefined);
	assert.ok(!compiled.model.functions.some(fn => fn.anchor !== undefined));
	assert.doesNotMatch(compiled.model.declarations + compiled.model.xs, /result_validate/u);
	await saveLakeFile(compiled.directory, "consumer.pl", consumer);
	const observations = [];
	for(const perl of perlGraphCommands())
	{
		let execution;
		try
		{
			await runCopied(perl, ["build.pl"], compiled.directory, { ...compiled.environment, CC: "/usr/bin/cc", LD: "/usr/bin/cc" });
			execution = await runCopied(perl, ["-I.", "consumer.pl"], compiled.directory, compiled.environment);
		}
		catch(error)
		{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
		assert.equal(execution.stderr, ""); const observed = JSON.parse(execution.stdout);
		assert.equal(observed.checks, 9);
		for(const field of ["live", "identities", "managedLive"]) assert.equal(observed[field], 0);
		observations.push({ perl, observed }); t.diagnostic(JSON.stringify({ mode, perl, observed }));
	}
	await saveLakeFile("build/owned-perl-receiver-core", `${mode}-unanchored.json`, canonicalJson({
		mode, actualLean: true, installedPackage: false, resultAnchors: false
		, observations
		, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.c.layout.model.component }
		, nativeSourceSha256: sha256(compiled.native)
		, declarationsSha256: sha256(compiled.model.declarations)
		, valuesSha256: sha256(compiled.model.valuesSource)
		, xsSha256: sha256(compiled.xs), consumerSha256: sha256(consumer)
	}));
});
