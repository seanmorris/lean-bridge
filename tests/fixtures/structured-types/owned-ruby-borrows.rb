require_relative "probe"

module Probe
  HANDOFFS = native("owned_test_handoffs")
  class << self
    alias dispose_children dispose
    def dispose(value)
      value.instance_of?(API::Value) ? value.close : dispose_children(value)
    end
    def ticket(number = 17); API.new_ticket(number, "native\0🙂"); end
    def bundle(first)
      API::Bundle.new(primary: first, spare: API::Some.new(first), peers: [first],
        history: [first], payload: API::Payload.new(count: -(1 << 180), bytes: "\x00\x7f\x80\xff".b))
    end
    def semantic(value)
      case value
      when API::Ticket then [:ticket, API.serial(value), API.label(value)]
      when Array then value.map { |item| semantic(item) }
      when Data then [value.class.name, value.deconstruct.map { |item| semantic(item) }]
      else
        value.respond_to?(:deconstruct_keys) ? [value.class.name, value.deconstruct_keys(nil).transform_values { |item| semantic(item) }] : value
      end
    end
    def gc_borrow
      owner = ticket(37)
      [API.retain_ticket(owner), owner.get.dup]
    end
  end

  state
  empty_counts = counts
  check(empty_counts == [1, 1], "open-session baseline: #{empty_counts}")
  root = ticket
  raw = root.get
  alias_owner = root.dup
  frozen_owner = root.clone(freeze: true)
  borrowed = API.retain_ticket(root)
  transitive = API.retain_ticket(borrowed)
  independent = borrowed.retain
  resource_copy = raw.retain
  raw_alias = raw.dup
  check(raw == borrowed.get && raw.eql?(borrowed.get) && raw.same_identity?(independent.get))
  rejected(TypeError) { {raw => :invalid} }
  rejected(TypeError) { Marshal.dump(root) }
  rejected(TypeError) { API.retain_ticket(raw) }
  root.close
  check(API.serial(borrowed.get) == 17)
  alias_owner.close
  check(API.serial(transitive.get) == 17)
  frozen_owner.close
  check(borrowed.closed? && transitive.closed? && raw_alias.closed?)
  rejected(API::LeanBridgeError, 4) { borrowed.get }
  rejected(API::LeanBridgeError, 4) { raw == raw }
  rejected(API::LeanBridgeError, 4) { API.serial(raw_alias) }
  check(API.serial(independent.get) == 17 && API.serial(resource_copy) == 17)
  dispose([root, alias_owner, frozen_owner, borrowed, transitive, independent, resource_copy, raw_alias])
  check(counts == empty_counts, "closed results: #{counts}, expected #{empty_counts}")

  gc_view, gc_raw = gc_borrow
  collect
  check(gc_view.closed? && gc_raw.closed?, "GC releases the original whole owner")
  rejected(API::LeanBridgeError, 4) { gc_view.get }
  dispose([gc_view, gc_raw])
  exited = Thread.new {
    owner = ticket(41)
    [owner, API.retain_ticket(owner)]
  }.value
  check(exited.all?(&:closed?), "thread exit invalidates owned and borrowed results")
  rejected(API::LeanBridgeError, 4) { exited[1].get }
  dispose(exited)
  chain = [ticket(43)]
  bounded = false
  160.times do
    begin
      chain << API.retain_ticket(chain[-1])
    rescue API::LeanBridgeError => error
      check(error.status == 2)
      failures << error
      bounded = true
      break
    end
  end
  check(bounded && chain.length > 2, "borrow ancestry remains bounded")
  chain[0].close
  check(chain.all?(&:closed?))
  rejected(API::LeanBridgeError, 4) { chain[-1].get }
  dispose(chain)
  check(counts == empty_counts, "GC, thread exit and deep borrows release all owners")

  seed = ticket(29)
  raw = seed.get
  recursive = API::Tree::Leaf.new(ticket: raw)
  30.times { recursive = API::Tree::Branch.new(children: [recursive]) }
  cases = [
    [:echo_array, [raw, raw]], [:echo_array, []],
    [:echo_list, [raw]], [:echo_list, []],
    [:echo_option, API::Some.new(raw)], [:echo_option, nil],
    [:echo_result, API::Ok.new(bundle(raw))], [:echo_result, API::Err.new(raw)],
    [:echo_tuple, [raw, [API::Some.new(raw), API::Payload.new(count: -1, bytes: "p".b)]]],
    [:echo_record, bundle(raw)], [:echo_alias, bundle(raw)],
    [:echo_variant, API::Choice::Empty.new], [:echo_variant, API::Choice::One.new(ticket: raw)],
    [:echo_variant, API::Choice::Pair.new(first: raw, second: raw)],
    [:echo_variant, API::Choice::Many.new(tickets: [raw])], [:echo_variant, API::Choice::Many.new(tickets: [])],
    [:echo_row, [nil, API::Some.new(raw), nil]], [:echo_recursive, recursive],
    [:echo_recursive, API::Tree::Branch.new(children: [])],
    [:echo_nested, [[], [nil, API::Some.new(API::Ok.new(bundle(raw))), API::Some.new(API::Err.new(raw))]]]
  ]
  cases.each do |function, input|
    original = API.copy_value(input, result_of: function)
    expected = semantic(original.get)
    view = API.public_send(function, original)
    child = API.public_send(function, view)
    retained = child.retain
    check(semantic(view.get) == expected && semantic(child.get) == expected, function)
    original.close
    check(view.closed? && child.closed?, function)
    rejected(API::LeanBridgeError, 4) { view.get }
    rejected(API::LeanBridgeError, 4) { child.get }
    check(semantic(retained.get) == expected, function)
    dispose([original, view, child, retained])
  end
  rejected(TypeError) { API.copy_value([]) }
  rejected(TypeError) { API.copy_value(nil) }
  rejected(TypeError) { API.copy_value([], result_of: :serial) }
  cyclic = []
  cyclic << API::Tree::Branch.new(children: cyclic)
  rejected(ArgumentError) { API.copy_value(cyclic[0]) }
  cyclic.clear
  rejected(TypeError) { API.copy_value([], result_of: :echo_array, parameter_of: [:bundle, :arg2]) }
  peers = API.copy_value([raw], parameter_of: [:bundle, :arg2])
  built = API.bundle(raw, nil, peers, [], API::Payload.new(count: 1, bytes: "".b))
  check(API.serial(built.get.primary) == 29)
  peers.close
  rejected(API::LeanBridgeError, 4) { built.get }
  built.close
  owner = API.copy_value(bundle(raw))
  primary = API.primary(owner)
  closure = API.make_record(owner)
  closure_copy = closure.retain
  received = closure.call(true, owner.get)
  check(API.serial(received.get.primary) == 29)
  dispose(received)
  owner.close
  check(primary.closed? && closure.closed?)
  rejected(API::LeanBridgeError, 4) { closure.call(true, bundle(raw)) }
  received = closure_copy.call(true, bundle(raw))
  check(API.serial(received.get.primary) == 29)
  dispose([primary, closure, closure_copy, received])

  empty = API.copy_value([], result_of: :echo_array)
  empty_view = API.echo_array(empty)
  handoffs = HANDOFFS.call
  consumed = API.move_array(empty)
  check(empty.closed? && empty_view.closed? && consumed.get == [])
  check(HANDOFFS.call == handoffs + 1)
  dispose([empty, empty_view, consumed])
  original = ticket
  alias_owner = original.dup
  view = API.retain_ticket(original)
  rejected(API::LeanBridgeError, 1) { API.transfer_ticket(view) }
  check(!original.closed? && !view.closed?)
  rejected(API::LeanBridgeError, 1) { API.mixed_ticket(original, original) }
  rejected(API::LeanBridgeError, 1) { API.mixed_ticket(view, original) }
  check(!original.closed?)
  consumed = API.transfer_ticket(original)
  check(original.closed? && alias_owner.closed? && view.closed? && API.serial(consumed.get) == 17)
  dispose([original, alias_owner, view, consumed])

  original = API.copy_value(bundle(raw))
  view = API.echo_record(original)
  escaped, retained = [], []
  received = API.move_record(original, ->(incoming) {
    check(original.closed? && view.closed?)
    rejected(API::LeanBridgeError, 4) { original.get }
    escaped << incoming.primary.dup
    retained << incoming.primary.retain
    check(API.serial(incoming.primary) == 29)
    incoming
  })
  check(escaped[0].closed? && API.serial(retained[0]) == 29)
  check(API.serial(received.get.primary) == 29)
  dispose([original, view, escaped, retained, received])
  original = API.copy_value(bundle(raw))
  sentinel = Exception.new("preserved callback failure")
  error = rejected(Exception) { API.move_record(original, ->(_) { raise sentinel }) }
  check(error.equal?(sentinel) && original.closed?)
  original.close
  original = API.copy_value(bundle(raw))
  view = API.echo_record(original)
  thread = Thread.new { rejected(API::LeanBridgeError, 5) { view.get } }
  thread.join
  check(API.serial(view.get.primary) == 29)
  pid = Process.fork do
    begin
      view.get
      exit! 1
    rescue API::LeanBridgeError => error
      exit!(error.status == 6 ? 0 : 2)
    end
  end
  Process.wait(pid)
  check($?.success?)
  dispose([view, original])

  original = API.copy_value(bundle(raw))
  faults = sweep { API.echo_record(original) }
  original.close
  baseline = counts
  transfers = {rubyBefore: 0, rubyAfter: 0, nativeBefore: 0, nativeAfter: 0}
  [:ruby, :native].each do |allocator|
    succeeded = false
    1024.times do |point|
      original = API.copy_value(bundle(raw))
      alias_owner, independent = original.dup, original.retain
      view = API.echo_record(original)
      before = HANDOFFS.call
      result = nil
      invoke = -> { API.move_record(original, ->(incoming) {
        check(original.closed? && alias_owner.closed? && view.closed?)
        incoming
      }) }
      begin
        if allocator == :ruby
          result = fail_ruby_after(point) { invoke.call }
        else
          NATIVE_FAIL.call(point)
          result = invoke.call
        end
        succeeded = true
      rescue AllocationFault, Owned::Error => error
        check(error.instance_of?(AllocationFault) || error.status == 3)
        failures << error
        key = allocator.to_s + (HANDOFFS.call > before ? "After" : "Before")
        transfers[key.to_sym] += 1
      ensure
        NATIVE_FAIL.call(-1)
      end
      moved = HANDOFFS.call > before
      check(original.closed? == moved && alias_owner.closed? == moved && view.closed? == moved)
      check(API.serial(independent.get.primary) == 29)
      check(API.serial(result.get.primary) == 29) if succeeded
      dispose([result, original, alias_owner, independent, view])
      check(counts == baseline, "transfer #{allocator} point #{point}, moved #{moved}: #{counts}, expected #{baseline}")
      break if succeeded
    end
    check(succeeded, "no successful transfer after allocation sweep")
  end
  check(transfers.values.all?(&:positive?))
  seed.close
  check(counts == empty_counts, "closed results after fault sweep: #{counts}, expected #{empty_counts}")
  finish(faults.merge(transfers))
end
