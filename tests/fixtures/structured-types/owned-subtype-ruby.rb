# Independent installed-gem consumer for checked owned aggregates.
require "lean_bridge/owned_subtypes"

API = LeanBridge::OwnedSubtypes
$checks = 0

def check(value, message)
  $checks += 1
  raise "owned Subtype Ruby check #{$checks}: #{message}" unless value
end

def rejected
  yield
  raise "expected checked-constructor rejection"
rescue API::LeanBridgeError => error
  check(error.status == 1, "expected invalid argument, got status #{error.status}")
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

def bundle(ticket, count)
  API::Bundle.new(
    primary: ticket,
    spare: nil,
    peers: [ticket],
    history: [ticket],
    payload: API::Payload.new(count: count, bytes: "\x00\xff".b)
  )
end

def serial_is(ticket, expected, message)
  check(API.serial(ticket) == expected, message)
end

def owning_state(ticket)
  guard = ticket.instance_variable_get(:@guard)
  check(!guard.nil?, "lifecycle probe requires an open owner")
  guard.lease.state
end

ticket = API.new_ticket(41, "ruby\x00checked")
retained = ticket.retain
serial_is(ticket, 41, "fresh resource is usable")
serial_is(retained, 41, "explicit retain is independent")

valid = bundle(ticket, 7)
25.times do
  echoed = API.echo_record(valid)
  check(echoed.payload.count == 7, "selected constructor accepts a valid value")
  serial_is(echoed.primary, 41, "selected constructor preserves the resource")
  alternate = API.echo_record_alternate(valid)
  check(alternate.payload.bytes == "\x00\xff".b, "alternate constructor preserves bytes")
  serial_is(alternate.primary, 41, "alternate constructor preserves the resource")
  release(echoed)
  release(alternate)
end
check(!ticket.closed?, "borrowed calls do not consume the input owner")

invalid = bundle(ticket, -1)
rejected { API.echo_record(invalid) }
rejected { API.echo_record_alternate(invalid) }
check(!ticket.closed?, "borrowed rejection preserves the input owner")
serial_is(ticket, 41, "borrowed rejection leaves the resource usable")

moving = API.new_ticket(51, "moving")
kept = moving.retain
rejected { API.transfer_record(bundle(moving, -1)) }
check(!moving.closed?, "transfer rejection happens before ownership movement")
serial_is(moving, 51, "rejected transfer leaves the original usable")
serial_is(kept, 51, "rejected transfer leaves the retain usable")

moved = API.transfer_record(bundle(moving, 9))
check(moving.closed?, "successful transfer consumes the selected owner")
serial_is(kept, 51, "successful transfer preserves an independent retain")
check(moved.payload.count == 9, "successful transfer preserves the checked field")
serial_is(moved.primary, 51, "successful transfer returns a usable resource")

finalizer_anchor = API.new_ticket(61, "finalizer-anchor")
finalizer_state = owning_state(finalizer_anchor)
baseline_slots = finalizer_state.slots.length
finalized = API.new_ticket(62, "finalized")
finalizer_survivor = finalized.retain
check(finalizer_state.slots.length == baseline_slots + 2,
      "finalizer probe owns two independent native results")
finalized = nil
3.times { GC.start(full_mark: true, immediate_sweep: true) }
serial_is(finalizer_survivor, 62,
          "garbage collection preserves an independent retain")
check(finalizer_state.slots.length == baseline_slots + 1,
      "garbage collection releases the abandoned native owner")
finalizer_survivor.close
serial_is(finalizer_anchor, 61, "runtime remains usable after finalizer cleanup")
check(finalizer_state.slots.length == baseline_slots,
      "explicit survivor cleanup restores the owning-slot baseline")
finalizer_anchor.close

release(moved)
ticket.close
retained.close
moving.close
kept.close
check([ticket, retained, moving, kept].all?(&:closed?), "cleanup is explicit and idempotent")

puts "owned-subtype-ruby:#{$checks}"
