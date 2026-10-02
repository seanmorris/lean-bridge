/**
 * Break one Ruby callback lifetime rule without changing the public consumer.
 *
 * @file
 */
import assert from "node:assert/strict";

/**
 * Each source mutation must parse and then fail its named semantic assertion.
 *
 * @param generated - Checked Ruby API, conversions and runtime.
 * @param hostCallbacks - Include host frame and whole-reply mutations.
 */
export const ownedRubyCallbackMutations = (generated, hostCallbacks) => {
	const runtime = generated.files[`lib/${generated.requirePath}/owned.rb`];
	const cases = [
		["retained-exited-creator-thread", "runtime.rb", runtime
			, "      @thread = nil", "      nil"
			, "closed owners do not retain exited creator threads"]
		, ["closure-owner-instead-of-argument", "native.rb", generated.source
			, "anchor = owner2.owner(state)"
			, "anchor = arg0.instance_variable_get(:@guard).lease.owner(state)"
			, "Invalid argument"]
		, ["unchecked-whole-owner", "runtime.rb", runtime
			, "      guard.lease.require_open\n      payload"
			, "      payload", "Expected LeanBridge::OwnedAggregates::Owned::Error"]
		, ["late-whole-payload-read", "runtime.rb", runtime
			, "      guard.lease.require_open\n      payload"
			, "      guard.lease.require_open\n      guard.payload"
			, "foreign-close get lost the captured owner"]
		, ["late-retain-payload-read", "runtime.rb", runtime
			, "      payload[1].call(payload[0], whole: true)"
			, "      @guard.payload[1].call(payload[0], whole: true)"
			, "foreign-close retain lost the captured owner"]
		, ["late-duplicate-payload-read", "runtime.rb", runtime
			, "        install(guard.lease, payload)"
			, "        install(guard.lease, guard.payload)"
			, "foreign-close dup lost the captured owner"]
		, ...hostCallbacks ? [
			["escaped-host-frame", "runtime.rb", runtime
				, "    def close; @scope.active = false; end"
				, "    def close; @scope.active = true; end", "Ruby check"]
			, ["missing-whole-host-reply", "native.rb", generated.source
				, "reply = VALUE_GET.bind_call(reply) if exact?(reply, Owned::Value)"
				, "nil", "Expected exact Bundle"]
			, ["missing-whole-host-recovery", "native.rb", generated.source
				, "recovery = VALUE_GET.bind_call(recovery) if wrapped && exact?(recovery, Owned::Value)"
				, "nil", "Expected exact Bundle"]
			, ["reply-converted-after-expiration", "native.rb", generated.source
				, "reply_scope = ValueScope.new(state, false, frame.scope.budget)"
				, "borrowed.close; reply_scope = ValueScope.new(state, false, frame.scope.budget)"
				, "Resource is closed"]
		] : []
	];
	return cases.map(([name, path, original, before, after, diagnostic]) => {
		const occurrences = original.split(before).length - 1;
		assert.ok(occurrences > 0, name);
		return { name, path, original, occurrences
			, source: original.replaceAll(before, after), diagnostic };
	});
};
