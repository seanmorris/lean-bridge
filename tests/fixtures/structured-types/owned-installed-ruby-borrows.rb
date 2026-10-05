require "lean_bridge/owned_aggregates"
require "json"

module Probe
  API = LeanBridge::OwnedAggregates
  @checks = 0
  @failures = []
  class << self
    attr_reader :checks, :failures
    def check(value, label = nil)
      raise "Installed Ruby borrow check #{@checks + 1} failed: #{label}" unless value
      @checks += 1
    end
    def rejected(kind, status = nil)
      begin
        yield
      rescue kind => error
        check(status.nil? || error.status == status)
        failures << error
        error
      else
        raise "Expected #{kind}"
      end
    end
    def dispose(value)
      if value.respond_to?(:close) && value.respond_to?(:retain)
        value.close
      elsif value.instance_of?(Array)
        value.each { |child| dispose(child) }
      elsif value.is_a?(Data)
        value.deconstruct.each { |child| dispose(child) }
      elsif value.respond_to?(:deconstruct_keys)
        value.deconstruct_keys(nil).each_value { |child| dispose(child) }
      end
    end
  end
end

module Probe
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
  end

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
  consumed = API.move_array(empty)
  check(empty.closed? && empty_view.closed? && consumed.get == [])
  dispose([empty, empty_view, consumed])
  original = ticket
  alias_owner = original.dup
  view = API.retain_ticket(original)
  rejected(API::LeanBridgeError, 1) { API.transfer_ticket(view) }
  check(!original.closed? && !view.closed?)
  rejected(API::LeanBridgeError, 1) { API.mixed_ticket(original, original) }
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

  seed.close
  puts JSON.generate({checks: checks, ordinaryRequire: true})
end
