# Installed-gem consumer for owned proof-erased checked records.
require "lean_bridge/owned_checked_records"

API = LeanBridge::OwnedCheckedRecords
$checks = 0

def check(value, message)
  $checks += 1
  raise "owned checked-record Ruby check #{$checks}: #{message}" unless value
end

def rejected(status = 1)
  yield
  raise "expected checked-record rejection"
rescue API::LeanBridgeError => error
  check(error.status == status, "expected status #{status}, got #{error.status}")
  error
end

def resources(value)
  return [value] if value.is_a?(API::Ticket)
  return value.flat_map { |item| resources(item) } if value.is_a?(Array)
  return value.deconstruct_keys(nil).values.flat_map { |item| resources(item) } if value.respond_to?(:deconstruct_keys)
  []
end

def release(value)
  resources(value).each(&:close)
end

def claim(ticket, quota)
  API::Claim.new(holder: ticket, quota: quota)
end

def booking(ticket, lo, hi)
  API::Booking.new(holder: ticket, window: API::Window.new(lo: lo, hi: hi))
end

def serial_is(ticket, expected, message)
  check(API.serial(ticket) == expected, message)
end

def owning_state(ticket)
  guard = ticket.instance_variable_get(:@guard)
  check(!guard.nil?, "lifecycle probe requires an open owner")
  guard.lease.state
end

ticket = API.new_ticket(41, "ruby\0checked")
retained = ticket.retain
serial_is(ticket, 41, "fresh resource is usable")
serial_is(retained, 41, "explicit retain is independent")
valid = claim(ticket, 7)
valid_booking = booking(ticket, 3, 8)

25.times do
  echoed = API.echo_claim(valid)
  check(echoed.quota == 7, "selected constructor accepts the claim")
  serial_is(echoed.holder, 41, "claim preserves its resource")
  echoed_booking = API.echo_booking(valid_booking)
  check(echoed_booking.window.hi == 8, "nested copied record preserves fields")
  serial_is(echoed_booking.holder, 41, "booking preserves its resource")
  release(echoed)
  release(echoed_booking)
end

invalid = claim(ticket, 99)
rejected { API.echo_claim(invalid) }
rejected { API.pair_claim(valid_booking, invalid) }
check(!ticket.closed?, "early and late borrowed rejection preserve input")
serial_is(ticket, 41, "borrowed rejection recovers")

moving = API.new_ticket(51, "moving")
kept = moving.retain
rejected_transfer = claim(moving, 99)
rejected { API.transfer_claim(rejected_transfer) }
check(!moving.closed? && !rejected_transfer.holder.closed?,
      "transfer rejection precedes movement")
serial_is(moving, 51, "rejected transfer leaves input usable")
serial_is(kept, 51, "rejected transfer leaves retain usable")
accepted_transfer = claim(moving, 9)
moved = API.transfer_claim(accepted_transfer)
check(moving.closed? && accepted_transfer.holder.closed?,
      "successful transfer consumes the shared owner")
check(moved.quota == 9, "successful transfer preserves payload")
serial_is(moved.holder, 51, "transferred result is usable")
serial_is(kept, 51, "independent retain survives transfer")

$calls = 0
reply = proc do |incoming|
  $calls += 1
  check(incoming.quota == 7, "callback receives a proof-free claim")
  claim(incoming.holder, 10)
end
callback_result = API.with_claim_callback(valid, API.with_recovery(reply, valid))
check($calls == 1 && callback_result.quota == 10,
      "valid host callback reply accepted")
serial_is(callback_result.holder, 41, "host reply resource retained")
release(callback_result)
before = $calls
bare_result = API.with_claim_callback(valid, reply)
check($calls == before + 1 && bare_result.quota == 10,
      "successful callback needs no failure-path recovery")
release(bare_result)
before = $calls
rejected { API.with_claim_callback(valid, API.with_recovery(reply, invalid)) }
check($calls == before, "invalid recovery stops callback")
rejected do
  API.with_claim_callback(valid, API.with_recovery(
    proc { |incoming| claim(incoming.holder, 99) }, valid
  ))
end
serial_is(ticket, 41, "invalid host reply recovers")

sentinel = Class.new(StandardError).new("owned checked callback")
caught = begin
  API.with_claim_callback(valid, API.with_recovery(proc { raise sentinel }, valid))
  nil
rescue StandardError => error
  error
end
check(caught.equal?(sentinel), "callback exception identity preserved")

closure = API.claim_closure
from_closure = closure.call(valid)
check(from_closure.quota == 7, "returned closure accepts valid claim")
serial_is(from_closure.holder, 41, "closure result resource retained")
release(from_closure)
rejected { closure.call(invalid) }
reused = closure.call(claim(ticket, 6))
check(reused.quota == 6, "returned closure recovers and reuses")
release(reused)
closure.close
closure.close
check(closure.closed?, "closure closes idempotently")

produced = API.claim_for(retained)
check(produced.is_a?(API::Some), "Lean-produced claim is present")
check(produced.value.quota == 0, "Lean-produced claim erases its proof")
serial_is(produced.value.holder, 41, "Lean-produced resource is usable")
release(produced)

anchor = API.new_ticket(61, "finalizer-anchor")
state = owning_state(anchor)
baseline = state.slots.length
finalized = API.new_ticket(62, "finalized")
survivor = finalized.retain
check(state.slots.length == baseline + 2, "finalizer probe owns two results")
finalized = nil
3.times { GC.start(full_mark: true, immediate_sweep: true) }
serial_is(survivor, 62, "GC preserves an independent retain")
check(state.slots.length == baseline + 1, "GC releases abandoned owner")
survivor.close
check(state.slots.length == baseline, "cleanup restores slot baseline")
anchor.close

release(valid)
release(invalid)
release(valid_booking)
release(moved)
ticket.close
retained.close
moving.close
kept.close
check([ticket, retained, moving, kept].all?(&:closed?),
      "cleanup is explicit and idempotent")

puts "owned-checked-record-ruby:#{$checks}"
