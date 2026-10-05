/**
 * Reconstruct receiver code and require all four Perl lifetime configurations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedPerlXs } from "../../src/backends/perl/owned-xs.mjs";
import { ownedReceiverSource } from "./owned-receiver-fixture.mjs";
import { ownedRustReceiverSource } from "./owned-rust-receiver-fixture.mjs";
import { ownedPerlBorrowInstrumentedSources } from "./owned-perl-borrow-evidence.mjs";
import { ownedPerlReceiverProbe, ownedPerlPlainReceiverProbe, ownedPerlUnanchoredReceiverProbe } from "./owned-perl-receiver-fixture.mjs";

export const ownedPerlReceiverCommand = "LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-perl-receivers";
export const ownedPerlReceiverVariants = ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"];

/**
 * Match an actual interpreter path to one of the four pinned ABIs.
 *
 * @param perl - Selected interpreter executable.
 */
export const ownedPerlReceiverVariant = perl => {
	const name = perl.match(/\/perl\/([^/]+)\/bin\/perl$/u)?.[1];
	assert.ok(ownedPerlReceiverVariants.includes(name), perl); return name;
};

/**
 * Require each ABI exactly once, or once per installation mode.
 *
 * @param observations - Actual interpreter observations.
 * @param installed - Include both prebuilt and locally compiled XS consumers.
 */
export const assertOwnedPerlReceiverMatrix = (observations, installed = false) => {
	const modes = ["prebuilt-only", "build-xs"];
	assert.deepEqual(observations.map(item => ownedPerlReceiverVariant(item.perl) + (installed ? ":" + item.mode : "")).sort()
		, (installed ? ownedPerlReceiverVariants.flatMap(abi => modes.map(mode => abi + ":" + mode)) : ownedPerlReceiverVariants).slice().sort());
};

/**
 * Check ABI identity and the complete managed/native cleanup observation.
 *
 * @param item - Interpreter observation.
 * @param checks - Exact successful assertion count.
 * @param installed - Installed consumers expose the runtime identity ledger.
 */
export const assertOwnedPerlReceiverObservation = (item, checks, installed = false) => {
	const abi = ownedPerlReceiverVariant(item.perl);
	assert.equal(item.observed.checks, checks);
	assert.equal(item.observed.threaded, Number(!abi.endsWith("unthreaded")));
	assert.equal(item.observed.perlVersion, "v" + abi.split("-")[0]);
	for(const field of installed ? ["brokerIdentities"] : ["managedLive", "live", "identities"])
		assert.equal(item.observed[field], 0, field);
};

const mutations = (model, sources) => {
	const module = `${model.valuesSource}
package LeanBridge::OwnedProbe;
require DynaLoader; our @ISA = ('DynaLoader'); our $VERSION = '0.001';
__PACKAGE__->bootstrap($VERSION); 1;
`;
	const ticket = model.types.find(node => node.name === "Ticket");
	return [
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
	].map(([name, path, before, after]) => {
		const source = path === "Probe.xs" ? sources.xs : module;
		assert.equal(source.split(before).length, 2, name);
		return { name, path, compiled: true, sourceSha256: sha256(source.replace(before, after)) };
	});
};

/**
 * Regenerate every direct probe and require complete ordinary/reviewed matrices.
 *
 * @param record - Two complete cores and the six optional-capability reports.
 */
export const assertOwnedPerlReceiverInputs = async record => {
	assert.deepEqual(record.runtime.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.unanchored.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.plain.map(item => [item.mode, item.consuming]), [
		["ordinary", false], ["reviewed", false]
		, ["ordinary", true], ["reviewed", true]
	]);
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	for(const item of [...record.runtime, ...record.plain, ...record.unanchored])
	{
		assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
		const plain = record.plain.includes(item), anchored = record.runtime.includes(item);
		const options = { receiverExports: true, hostCallbacks: !plain
			, transferredInputs: plain ? item.consuming : true
			, anchoredResults: anchored };
		const model = createCompiledNativeModel(item.input, { ownedGraphs: true
			, ownedReceiverExports: true, ownedHostCallbacks: options.hostCallbacks
			, ownedInputTransfers: options.transferredInputs
			, ownedAnchoredResults: anchored });
		assert.equal(model.schemaVersion, 10); assert.equal(model.ownedGraph.schemaVersion, 5);
		assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(model.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256
			, sha256(lean + (plain ? ownedReceiverSource : ownedRustReceiverSource)));
		const xs = generateOwnedPerlXs(model.bindingIr, "LeanBridge::OwnedProbe", options);
		const c = generateOwnedCPackage({ ...item.input, ...options });
		const sources = await ownedPerlBorrowInstrumentedSources(c, xs, options.transferredInputs);
		assert.equal(item.nativeSourceSha256, sha256(sources.native));
		assert.equal(item.declarationsSha256, sha256(xs.declarations));
		assert.equal(item.valuesSha256, sha256(xs.valuesSource));
		assert.equal(item.xsSha256, sha256(sources.xs));
		const consumer = anchored ? await ownedPerlReceiverProbe()
			: plain ? ownedPerlPlainReceiverProbe(item.consuming) : ownedPerlUnanchoredReceiverProbe;
		assert.equal(item.consumerSha256, sha256(consumer));
		assertOwnedPerlReceiverMatrix(item.observations);
		if(anchored)
		{
			assert.equal(item.nominalMembers, true); assert.equal(model.exports.length, 27);
			assert.equal(model.ownedGraph.receiverExports.exports.length, 16);
			assert.equal(model.ownedGraph.resultAnchors.exports.length, 20);
			assert.equal(model.ownedGraph.inputTransfers.exports.length, 4);
			const expected = mutations(xs, sources);
			for(const observation of item.observations)
			{
				assertOwnedPerlReceiverObservation(observation, ownedPerlReceiverVariant(observation.perl).endsWith("unthreaded") ? 961 : 963);
				assert.equal(observation.restored, true);
				assert.deepEqual(observation.rejectedMutations, expected);
				assert.equal(observation.observed.heldErrors, 366);
				assert.deepEqual(observation.observed.faults, { allocator: { before: 19, after: 35 }
					, exception: { before: 23, after: 191 }
					, native: { before: 11, after: 86 } });
				assert.deepEqual(observation.observed.exports
					, [...xs.functions.map(fn => fn.publicName).filter(name => !["payload", "choose_ticket"].includes(name)), "copy_value"].sort());
			}
		}
		else
		{
			assert.equal(item.resultAnchors, false); assert.equal(model.ownedGraph.resultAnchors, undefined);
			assert.equal(Boolean(model.ownedGraph.hostCallbacks), !plain);
			assert.equal(Boolean(model.ownedGraph.inputTransfers), options.transferredInputs);
			for(const observation of item.observations)
				assertOwnedPerlReceiverObservation(observation, plain ? item.consuming ? 11 : 8 : 9);
		}
	}
};
