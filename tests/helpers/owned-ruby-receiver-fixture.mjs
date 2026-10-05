/**
 * Independent Ruby callers over the shared compiler-authenticated receiver API.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
export { ownedRustReceiverConfiguration as ownedRubyReceiverConfiguration
	, ownedRustReceiverReviewedIr as ownedRubyReceiverReviewedIr
	, ownedRustPlainReceiverReviewedIr as ownedRubyPlainReceiverReviewedIr
	, ownedRustReceiverSource as ownedRubyReceiverSource } from "./owned-rust-receiver-fixture.mjs";

/** Exercise every member before the unchanged lifetime and allocation probes. */
export const ownedRubyReceiverProbe = async () => {
	const prior = await readFile("tests/fixtures/structured-types/owned-ruby-borrows.rb", "utf8");
	const receivers = await readFile("tests/fixtures/structured-types/owned-ruby-receivers.rb", "utf8");
	const marker = "  state\n  empty_counts = counts\n";
	if(prior.split(marker).length !== 2) throw new Error("Expected one independent Ruby owner probe");
	return prior.replace(marker, receivers + marker);
};

/**
 * Exercise ordinary owner operations when optional transport capabilities are absent.
 *
 * @param consuming - Include an original-owner consuming method.
 */
export const ownedRubyPlainReceiverProbe = consuming => `require_relative "runtime"
require_relative "values"
require_relative "native"
require "json"
api = LeanBridge::OwnedAggregates
native, owned = api.const_get(:Native, false), api.const_get(:Owned, false)
library = Fiddle.dlopen(ARGV.fetch(0))
identities = Fiddle::Function.new(library["receiver_identity_count"], [], Fiddle::TYPE_SIZE_T, need_gvl: true)
checks = 0
check = ->(value) { raise "Plain Ruby receiver assertion failed" unless value; checks += 1 }
check.call(identities.call.zero?)
runtime = owned::Runtime.new(library)
native.bind(runtime)
state = runtime.current_state
check.call(identities.call == 1)
root = api.new_ticket(42, "plain")
alias_owner, kept = root.dup, root.retain_ticket
independent, copied, raw = root.retain, api.copy_value(root.get), root.get
check.call(root.serial == root.get.serial && independent.serial == 42 && copied.serial == 42)
root.close
check.call(root.closed? && alias_owner.serial == 42 && raw.serial == 42)
alias_owner.close
check.call(raw.closed? && kept.serial == 42 && independent.serial == 42 && copied.serial == 42)
check.call(api::Value.instance_method(:serial).bind_call(kept) == 42)
${consuming ? `old = kept.dup
moved = kept.transfer_ticket
check.call(kept.closed? && old.closed? && moved.serial == 42)
moved.close
old.close` : "kept.close"}
[root, alias_owner, kept, independent, copied].each(&:close)
3.times { GC.start(full_mark: true, immediate_sweep: true) }
state.require_open
check.call(identities.call == 1)
state.close
check.call(identities.call.zero?)
puts JSON.generate(checks: checks, identities: identities.call)
`;
