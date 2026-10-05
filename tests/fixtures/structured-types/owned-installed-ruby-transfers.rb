require "lean_bridge/owned_aggregates"
require "json"

module Probe
  API = LeanBridge::OwnedAggregates
  @checks = 0
  class CallbackError < Exception; end
  class << self
    attr_reader :checks
    def check(value, label = nil)
      raise "Check #{@checks + 1} failed: #{label}" unless value
      @checks += 1
    end
    def rejected(kind, status = nil)
      begin
        yield
      rescue kind => error
        check(status.nil? || error.status == status)
        error
      else
        raise "Expected #{kind}"
      end
    end
    def dispose(value); resources(value).each(&:close); end
    def resources(value)
      return [value] if value.respond_to?(:close) && value.respond_to?(:retain)
      case value
      when Array then value.flat_map { |item| resources(item) }
      when Data then value.deconstruct.flat_map { |item| resources(item) }
      else
        value.respond_to?(:deconstruct_keys) ? value.deconstruct_keys(nil).values.flat_map { |item| resources(item) } : []
      end
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
    def ticket(number = 17); API.new_ticket(number, "native\0🙂"); end
    def bundle
      first, second = ticket, ticket(23)
      API::Bundle.new(primary: first, spare: API::Some.new(second), peers: [first, second],
                      history: [second], payload: API::Payload.new(count: -(1 << 180), bytes: "\x00\x7f\x80\xff".b))
    end
    def chain(depth = 30)
      value = API::Chain::Stop.new
      depth.times { |index| value = API::Chain::Link.new(ticket: ticket(index), next_: API::Some.new(value)) }
      value
    end
    def tree(depth = 40)
      value = API::Tree::Leaf.new(ticket: ticket)
      depth.times { value = API::Tree::Branch.new(children: [value]) }
      value
    end
    def mixed(error = false)
      first = ticket
      API::Mixed.new(ticket: first, markers: [nil, API::Some.new(nil), API::Some.new(API::Some.new(false)), API::Some.new(API::Some.new(true))],
                     unit: API::Some.new(API::UNIT), result: error ? API::Err.new(ticket(31)) : API::Ok.new(bundle),
                     signed: -(1 << 180), unsigned: 1 << 200, scalar: "🙂", precise: -0.0, approximate: Float::INFINITY,
                     bytes: "\x00\x7f\x80\xff".b, words: [0, (1 << 64) - 1],
                     product: [first, [API::Some.new(ticket(32)), API::Payload.new(count: -2, bytes: "tuple".b)]], chain: chain(3))
    end
    def nonlocal_callback(value)
      API.callback_record(value, proc { |item| return item })
    end
  end
end

module Probe
  first = ticket
  duplicate, clone, independent = first.dup, first.clone, first.retain
  received = API.retain_ticket(first)
  check(first.closed? && duplicate.closed? && clone.closed?)
  check(API.serial(received) == 17 && API.serial(independent) == 17)
  rejected(API::LeanBridgeError, 4) { API.serial(duplicate) }
  dispose([first, duplicate, clone, received, independent])

  original = API.echo_record(bundle)
  sibling = original.spare.value.dup
  independent = sibling.retain
  received = API.retain_ticket(original.primary)
  check(resources(original).all?(&:closed?))
  check(sibling.closed? && API.serial(independent) == 23)
  dispose([original, sibling, independent, received])

  cases = [
    [:echo_array, -> { [ticket, ticket(2)] }], [:echo_array, -> { [] }],
    [:echo_list, -> { [ticket, ticket(2)] }], [:echo_list, -> { [] }],
    [:echo_option, -> { API::Some.new(ticket) }], [:echo_option, -> { nil }],
    [:echo_result, -> { API::Ok.new(bundle) }], [:echo_result, -> { API::Err.new(ticket) }],
    [:echo_tuple, -> { [ticket, [API::Some.new(ticket(2)), API::Payload.new(count: -1, bytes: "p".b)]] }],
    [:echo_record, -> { bundle }], [:echo_alias, -> { bundle }],
    [:echo_variant, -> { API::Choice::Empty.new }], [:echo_variant, -> { API::Choice::One.new(ticket: ticket) }],
    [:echo_variant, -> { API::Choice::Pair.new(first: ticket, second: ticket(2)) }],
    [:echo_variant, -> { API::Choice::Many.new(tickets: [ticket, ticket(2)]) }],
    [:echo_variant, -> { API::Choice::Many.new(tickets: []) }],
    [:echo_row, -> { [nil, API::Some.new(ticket), nil] }],
    [:echo_recursive, -> { tree }], [:echo_recursive, -> { API::Tree::Branch.new(children: []) }],
    [:echo_nested, -> { [[], [nil, API::Some.new(API::Ok.new(bundle)), API::Some.new(API::Err.new(ticket))]] }],
    [:echo_chain, -> { chain }], [:echo_chain, -> { API::Chain::Stop.new }],
    [:echo_chain, -> { API::Chain::Link.new(ticket: ticket, next_: nil) }],
    [:echo_mixed, -> { mixed }], [:echo_mixed, -> { mixed(true) }]
  ]
  cases.each do |function, make|
    value = make.call
    before = semantic(value)
    leaves = resources(value)
    received = API.public_send(function, value)
    check(semantic(received) == before, function)
    check(leaves.all?(&:closed?))
    if function == :echo_mixed
      check(1.0 / received.precise == -Float::INFINITY)
      check(received.approximate.infinite? == 1)
      check(received.markers == [nil, API::Some.new(nil), API::Some.new(API::Some.new(false)), API::Some.new(API::Some.new(true))])
      check(received.unit.value.equal?(API::UNIT))
    end
    dispose([value, received])
  end

  first = ticket
  duplicate = first.dup
  received = API.echo_array([first, first, duplicate])
  check(first.closed? && duplicate.closed? && received.all? { |item| API.serial(item) == 17 })
  dispose([first, duplicate, received])
  first, second, borrowed = ticket, ticket(29), ticket(31)
  received = API.bundle(first, API::Some.new(borrowed), [second], [borrowed], API::Payload.new(count: 5, bytes: "two".b))
  check(first.closed? && second.closed? && !borrowed.closed?)
  check(API.serial(received.primary) == 17 && API.serial(received.peers[0]) == 29 && API.serial(borrowed) == 31)
  dispose([received, first, second, borrowed])

  first = ticket
  rejected(API::LeanBridgeError, 1) { API.bundle(first, nil, [first], [], API::Payload.new(count: 0, bytes: "".b)) }
  check(!first.closed?)
  rejected(TypeError) { API.bundle(first, nil, [], [], API::Payload.new(count: true, bytes: "".b)) }
  check(API.serial(first) == 17)
  rejected(TypeError) { API.echo_array([first, nil]) }
  check(!first.closed?)
  first.close
  value = tree(130)
  rejected(API::LeanBridgeError, 2) { API.echo_recursive(value) }
  check(resources(value).none?(&:closed?))
  dispose(value)
  cyclic = []
  cyclic << API::Tree::Branch.new(children: cyclic)
  rejected(ArgumentError) { API.echo_recursive(cyclic[0]) }
  cyclic.clear

  value = bundle
  aliases = resources(value).map(&:dup)
  escaped, retained = [], []
  received = API.callback_record(value, ->(incoming) {
    check(aliases.all?(&:closed?))
    check(API.serial(incoming.primary) == 17)
    escaped << incoming.primary.dup
    rejected(API::LeanBridgeError, 1) { API.retain_ticket(incoming.primary) }
    owned = incoming.primary.retain
    retained << API.retain_ticket(owned)
    check(owned.closed?)
    local = API.echo_record(bundle)
    check(API.serial(local.primary) == 17)
    dispose(local)
    incoming
  })
  check(escaped[0].closed? && API.serial(retained[0]) == 17)
  dispose([value, aliases, escaped, retained, received])

  value = bundle
  sentinel = CallbackError.new("same exception object")
  error = rejected(CallbackError) { API.callback_record(value, ->(_incoming) { check(value.primary.closed?); raise sentinel }) }
  check(error.equal?(sentinel) && value.primary.closed?)
  dispose(value)
  [->(value) { nonlocal_callback(value) },
   ->(value) { catch(:escape) { API.callback_record(value, proc { |item| throw :escape, item }) } },
   ->(value) { API.callback_record(value, proc { |item| break item }) }].each do |call|
    value = bundle
    rejected(LocalJumpError) { call.call(value) }
    check(resources(value).all?(&:closed?))
    dispose(value)
  end
  value = bundle
  rejected(FiberError) { API.callback_record(value, ->(incoming) { Fiber.new {}.resume; incoming }) }
  check(resources(value).all?(&:closed?))
  dispose(value)

  value = tree(3)
  received = API.callback_recursive(value, ->(item) { item })
  check(resources(value).all?(&:closed?))
  dispose([value, received])
  [[:make_record, -> { bundle }], [:make_recursive, -> { tree(3) }]].each do |create, make|
    value = make.call
    expected = semantic(value)
    closure = API.public_send(create, value)
    check(resources(value).all?(&:closed?))
    supplied = make.call
    received = closure.call(true, supplied)
    check(semantic(received) == expected && resources(supplied).none?(&:closed?))
    dispose([value, supplied, received, closure])
  end
  closure = API.new_record_callback
  duplicate, independent = closure.dup, closure.retain
  received = API.transfer_callback(closure)
  check(closure.closed? && duplicate.closed? && !independent.closed?)
  value = bundle
  result = received.call(value)
  check(semantic(result) == semantic(value))
  dispose([result, value, closure, duplicate, received, independent])

  value = ticket
  thread_status = Thread.new do
    begin
      API.retain_ticket(value)
      nil
    rescue API::LeanBridgeError => error
      error.status
    end
  end.value
  check(thread_status == 5 && !value.closed?)
  child = fork do
    begin
      API.retain_ticket(value)
    rescue API::LeanBridgeError => error
      exit!(error.status == 6 ? 0 : 2)
    end
    exit! 3
  end
  check(Process.wait2(child)[1].success?)
  value.close

  puts JSON.generate({checks: checks, ordinaryRequire: true})
end
