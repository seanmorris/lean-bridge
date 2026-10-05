/**
 * Compile resource-only Perl receiver APIs with no callback or anchor capability.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { ownedReceiverConfiguration, ownedReceiverSource } from "./helpers/owned-receiver-fixture.mjs";
import { ownedRustPlainReceiverReviewedIr } from "./helpers/owned-rust-receiver-fixture.mjs";
import { ownedPerlPlainReceiverProbe } from "./helpers/owned-perl-receiver-fixture.mjs";
import { prepareOwnedPerlNative } from "./helpers/owned-perl-native.mjs";
import { perlGraphCommands } from "./helpers/perl-graph-probes.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

for(const consuming of [false, true]) for(const mode of ["ordinary", "reviewed"])
	test(`Perl ${mode} resource receivers${consuming ? " consume without anchors" : " need no optional capabilities"}`, {
		skip: process.env.LEAN_BRIDGE_OWNED_PERL_RECEIVER_TEST !== "1"
		, timeout: 600000
	}, async t => {
		const configuration = await ownedReceiverConfiguration();
		const names = ["newTicket", "serial", "retainTicket", ...consuming ? ["transferTicket"] : []];
		configuration.exports = names.map(name => "Owned." + name); configuration.arities = {};
		const transfer = configuration.contracts["Owned.transferTicket"];
		configuration.contracts = { "Owned.serial": { receiver: "property" }
			, "Owned.retainTicket": { receiver: "method" }
			, ...consuming ? { "Owned.transferTicket": transfer } : {} };
		const name = `${mode}-${consuming ? "consuming" : "plain"}`;
		const compiled = await prepareOwnedPerlNative(t, {
			...mode === "ordinary" ? { configuration } : { reviewedIr: ownedRustPlainReceiverReviewedIr(consuming) }
			, sourceSuffix: ownedReceiverSource
			, receiverExports: true, hostCallbacks: false, transferredInputs: consuming
			, evidenceName: `perl-receiver-${name}-inputs.json`
		});
		assert.equal(compiled.c.values.anchoredResults, undefined);
		assert.equal(compiled.c.values.copies, undefined);
		assert.equal(compiled.callbackSource, undefined);
		assert.doesNotMatch(compiled.model.declarations + compiled.model.xs, /result_validate/u);
		const consumer = ownedPerlPlainReceiverProbe(consuming);
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
			assert.equal(observed.checks, consuming ? 11 : 8);
			for(const field of ["live", "identities", "managedLive"]) assert.equal(observed[field], 0);
			observations.push({ perl, observed }); t.diagnostic(JSON.stringify({ mode, consuming, perl, observed }));
		}
		await saveLakeFile("build/owned-perl-receiver-core", `${name}.json`, canonicalJson({
			mode, consuming, actualLean: true, installedPackage: false
			, hostCallbacks: false, resultAnchors: false, observations
			, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.c.layout.model.component }
			, nativeSourceSha256: sha256(compiled.native)
			, declarationsSha256: sha256(compiled.model.declarations)
			, valuesSha256: sha256(compiled.model.valuesSource)
			, xsSha256: sha256(compiled.xs), consumerSha256: sha256(consumer)
		}));
	});
