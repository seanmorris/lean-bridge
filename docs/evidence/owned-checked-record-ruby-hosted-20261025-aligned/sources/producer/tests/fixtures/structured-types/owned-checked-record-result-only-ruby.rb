# Installed-gem result-only consumer for owned checked records.
require "lean_bridge/owned_checked_records"

API = LeanBridge::OwnedCheckedRecords
$checks = 0

def check(value, message)
  $checks += 1
  raise message unless value
end

ticket = API.new_ticket(20, "result-only")
produced = API.claim_for(ticket)
check(produced.is_a?(API::Some), "claim is present")
check(produced.value.quota == 0, "proof is erased")
check(API.serial(produced.value.holder) == 20, "resource is usable")
check(!API.respond_to?(:echo_claim), "input constructor surface is absent")
produced.value.holder.close
ticket.close
check(ticket.closed?, "owner closes")
puts "owned-checked-record-result-only-ruby:#{$checks}"
