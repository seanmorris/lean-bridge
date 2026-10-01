/**
 * Compile checked Perl members over the original-owner lifetime regressions.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedPerlXs } from "../src/backends/perl/owned-xs.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedRustBorrowReviewedIr } from "./helpers/owned-rust-borrow-fixture.mjs";
import { ownedRustReceiverConfiguration, ownedRustReceiverReviewedIr, ownedRustReceiverSource
	, ownedRustPlainReceiverReviewedIr } from "./helpers/owned-rust-receiver-fixture.mjs";
import { prepareOwnedPerlNative } from "./helpers/owned-perl-native.mjs";
import { ownedPerlReceiverProbe } from "./helpers/owned-perl-receiver-fixture.mjs";
import { perlGraphCommands } from "./helpers/perl-graph-probes.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const options = { transferredInputs: true, anchoredResults: true, receiverExports: true };

test("Perl receiver members preserve original slots and nonreceiver generated APIs", () => {
	const ir = ownedRustReceiverReviewedIr(), original = structuredClone(ir);
	assert.throws(() => generateOwnedPerlXs(ir, "LeanBridge::OwnedProbe", { ...options, receiverExports: false }), /only synchronous function/u);
	const model = generateOwnedPerlXs(ir, "LeanBridge::OwnedProbe", options);
	assert.deepEqual(ir, original);
	assert.equal(model.functions.length, 27); assert.equal(model.functions.filter(fn => fn.receiver === 0).length, 16);
	assert.equal(model.functions.filter(fn => fn.anchor !== undefined).length, 20);
	assert.equal(model.functions.find(fn => fn.publicName === "choose_ticket").anchor, 1);
	assert.match(model.valuesSource, /choose_ticket\(\$self->get, @_\)/u);
	assert.match(model.valuesSource, /retain_ticket\(\$self, @_\)/u);
	for(const ir of [ownedAggregateReviewedIr(), ownedRustBorrowReviewedIr()])
	{
		const prior = generateOwnedPerlXs(ir, "LeanBridge::OwnedProbe", { ...options, receiverExports: false });
		const current = generateOwnedPerlXs(ir, "LeanBridge::OwnedProbe", options);
		for(const field of ["declarations", "xs", "valuesSource"]) assert.equal(current[field], prior[field]);
	}
	for(const consuming of [false, true])
	{
		const plain = generateOwnedPerlXs(ownedRustPlainReceiverReviewedIr(consuming), "LeanBridge::OwnedProbe", {
			receiverExports: true, hostCallbacks: false, transferredInputs: consuming
		});
		assert.equal(plain.c.anchoredResults, undefined); assert.equal(plain.wholeOwners, true);
		assert.doesNotMatch(plain.declarations, /result_validate/u);
		assert.match(plain.valuesSource, /package LeanBridge::OwnedProbe::TicketValue/u);
	}
});

for(const mode of ["ordinary", "reviewed"]) test(`Perl receiver members retain whole-owner regressions (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PERL_RECEIVER_TEST !== "1"
	, timeout: 1200000
}, async t => {
	const compiled = await prepareOwnedPerlNative(t, {
		...mode === "ordinary"
			? { configuration: await ownedRustReceiverConfiguration() }
			: { reviewedIr: ownedRustReceiverReviewedIr() }
		, ...options, sourceSuffix: ownedRustReceiverSource
		, evidenceName: `perl-receiver-${mode}-inputs.json`
	});
	const consumer = await ownedPerlReceiverProbe();
	await saveLakeFile(compiled.directory, "consumer.pl", consumer);
	const module = `${compiled.model.valuesSource}
package LeanBridge::OwnedProbe;
require DynaLoader; our @ISA = ('DynaLoader'); our $VERSION = '0.001';
__PACKAGE__->bootstrap($VERSION); 1;
`;
	const ticket = compiled.model.types.find(node => node.name === "Ticket");
	const mutations = [
		["receiver-used-as-parameter-anchor", "LeanBridge/OwnedProbe.pm"
			, "return LeanBridge::OwnedProbe::choose_ticket($self->get, @_);"
			, "return LeanBridge::OwnedProbe::choose_ticket($self->get, $self);"]
		, ["erased-nominal-share", "Probe.xs"
			, "wrapper->payload, wrapper->type, wrapper->package);"
			, 'wrapper->payload, wrapper->type, "LeanBridge::OwnedProbe::Value");']
		, ["unchecked-whole-value", "Probe.xs"
			, "if (lpo_closed(wrapper) || !wrapper->payload) lpo_status(aTHX_ 4);"
			, "if (!wrapper->payload) lpo_status(aTHX_ 4);"]
		, ["unchecked-empty-value", "Probe.xs"
			, "if (lpo_closed(wrapper) || !wrapper->payload) lpo_status(aTHX_ 4);"
			, "if (!wrapper->payload || (SvOK(wrapper->payload) && !(SvROK(wrapper->payload) && SvTYPE(SvRV(wrapper->payload)) == SVt_PVAV && av_len((AV *)SvRV(wrapper->payload)) < 0) && lpo_closed(wrapper))) lpo_status(aTHX_ 4);"]
		, ["discarded-whole-owner", "Probe.xs"
			, "    owner->valid = 0;\n    if (!owner->pins) lpo_release_native(aTHX_ owner);"
			, "    owner->valid = 1;"]
		, ["escaped-callback-frame", "Probe.xs"
			, "if (!owner->published || owner->borrowed) {"
			, "if (!owner->published && !owner->borrowed) {"]
		, ["pointer-equality", "Probe.xs"
			, `lpo_status(aTHX_ ${ticket.cName}_equal(lpo_state.session, left, right, &equal));`
			, "equal = left == right;"]
	];
	const observations = [];
	for(const perl of perlGraphCommands())
	{
		let run;
		try
		{
			await runCopied(perl, ["build.pl"], compiled.directory, { ...compiled.environment, CC: "/usr/bin/cc", LD: "/usr/bin/cc" });
			run = await runCopied(perl, ["-I.", "consumer.pl"], compiled.directory, compiled.environment);
		}
		catch(error)
		{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
		assert.equal(run.stderr, ""); const observed = JSON.parse(run.stdout);
		assert.ok(observed.checks > 100); assert.equal(observed.managedLive, 0);
		assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
		for(const domain of ["allocator", "exception", "native"])
			for(const phase of ["before", "after"]) assert.ok(observed.faults[domain][phase] > 0);
		const rejectedMutations = [];
		for(const [name, path, before, after] of mutations)
		{
			const original = path === "Probe.xs" ? compiled.xs : module;
			assert.equal(original.split(before).length, 2, name);
			const changed = original.replace(before, after);
			await saveLakeFile(compiled.directory, path, changed);
			try
			{
				await runCopied(perl, ["build.pl"], compiled.directory, { ...compiled.environment, CC: "/usr/bin/cc", LD: "/usr/bin/cc" });
				await assert.rejects(runCopied(perl, ["-I.", "consumer.pl"], compiled.directory, compiled.environment), error => {
					assert.match(error.details.stderr, /borrow check \d+/u, name);
					assert.doesNotMatch(error.details.stderr, /syntax error|Undefined subroutine|Can't locate/u);
					return true;
				});
				rejectedMutations.push({ name, path, compiled: true, sourceSha256: sha256(changed) });
			}
			finally
			{ await saveLakeFile(compiled.directory, path, original); }
		}
		await runCopied(perl, ["build.pl"], compiled.directory, { ...compiled.environment, CC: "/usr/bin/cc", LD: "/usr/bin/cc" });
		const replay = await runCopied(perl, ["-I.", "consumer.pl"], compiled.directory, compiled.environment);
		assert.equal(replay.stderr, ""); assert.deepEqual(JSON.parse(replay.stdout), observed);
		observations.push({ perl, observed, rejectedMutations, restored: true });
		t.diagnostic(JSON.stringify({ mode, perl, observed, rejectedMutations }));
	}
	await saveLakeFile("build/owned-perl-receiver-core", `${mode}.json`, canonicalJson({
		mode, actualLean: true, installedPackage: false, nominalMembers: true
		, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.c.layout.model.component }
		, observations, nativeSourceSha256: sha256(compiled.native)
		, declarationsSha256: sha256(compiled.model.declarations)
		, valuesSha256: sha256(compiled.model.valuesSource)
		, xsSha256: sha256(compiled.xs), consumerSha256: sha256(consumer)
	}));
});
