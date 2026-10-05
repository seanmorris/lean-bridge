require "lean_bridge/owned_aggregates"
require "json"

module Installed
  API = LeanBridge::OwnedAggregates
  @checks = 0
  class << self
    attr_reader :checks
    def check(value)
      @checks += 1
      raise "Installed Ruby check #{@checks} failed" unless value
    end
    def rejected(*classes)
      yield
    rescue *classes.flatten => error
      check(true)
      error
    else
      raise "Expected #{classes}"
    end
    def replace(value, **fields)
      value.class.new(**value.deconstruct_keys(nil).merge(fields))
    end
    def dispose(value)
      if value.respond_to?(:close) && value.respond_to?(:closed?)
        value.close
      elsif value.is_a?(Array)
        value.each { |child| dispose(child) }
      elsif value.respond_to?(:deconstruct_keys)
        value.deconstruct_keys(nil).each_value { |child| dispose(child) }
      elsif value.is_a?(Data)
        value.deconstruct.each { |child| dispose(child) }
      end
    end
    def equal_call(expected)
      actual = yield
      check(actual == expected)
      dispose(actual)
    end
  end

  huge = (1 << 521) + (1 << 255) + 19
  first = API.new_ticket(huge, "a\0雪🙂")
  second = API.new_ticket(27, "second")
  check(API.serial(first) == huge)
  check(API.label(first) == "a\0雪🙂")
  payload = API::Payload.new(count: -huge, bytes: "\0\xffpayload".b)
  bundle = API::Bundle.new(primary: first, spare: API::Some.new(second), peers: [first, second], history: [second, first], payload: payload)
  tree = API::Tree::Branch.new(children: [API::Tree::Leaf.new(ticket: first), API::Tree::Branch.new(children: [API::Tree::Leaf.new(ticket: second)])])
  chain = API::Chain::Link.new(ticket: first, next_: API::Some.new(API::Chain::Link.new(ticket: second, next_: nil)))
  mixed = API::Mixed.new(ticket: first, markers: [nil, API::Some.new(nil), API::Some.new(API::Some.new(false)), API::Some.new(API::Some.new(true))],
    unit: API::Some.new(API::UNIT), result: API::Ok.new(bundle), signed: -huge, unsigned: huge, scalar: "🙂", precise: -0.0, approximate: 1.5,
    bytes: "\xff\0bytes".b, words: [0, (1 << 64) - 1], product: [second, [API::Some.new(first), payload]], chain: chain)
  equal_call(bundle) { API.echo_record(bundle) }
  equal_call(bundle) { API.echo_alias(bundle) }
  equal_call(bundle) { API.bundle(first, API::Some.new(second), [first, second], [second, first], payload) }
  equal_call(first) { API.primary(bundle) }
  equal_call(payload) { API.payload(bundle) }
  equal_call([first, second]) { API.echo_array([first, second]) }
  equal_call([second, first]) { API.echo_list([second, first]) }
  equal_call([]) { API.echo_array([]) }
  equal_call([]) { API.echo_list([]) }
  equal_call(nil) { API.echo_option(nil) }
  equal_call(API::Some.new(first)) { API.echo_option(API::Some.new(first)) }
  equal_call(API::Ok.new(bundle)) { API.echo_result(API::Ok.new(bundle)) }
  equal_call(API::Err.new(second)) { API.echo_result(API::Err.new(second)) }
  equal_call([first, [nil, payload]]) { API.echo_tuple([first, [nil, payload]]) }
  [API::Choice::Empty.new, API::Choice::One.new(ticket: first), API::Choice::Pair.new(first: first, second: second), API::Choice::Many.new(tickets: [first, second])].each do |value|
    equal_call(value) { API.echo_variant(value) }
  end
  equal_call([nil, API::Some.new(first)]) { API.echo_row([nil, API::Some.new(first)]) }
  equal_call(tree) { API.echo_recursive(tree) }
  equal_call(chain) { API.echo_chain(chain) }
  equal_call(API::Chain::Stop.new) { API.echo_chain(API::Chain::Stop.new) }
  nested = [[nil, API::Some.new(API::Ok.new(bundle)), API::Some.new(API::Err.new(first))], []]
  equal_call(nested) { API.echo_nested(nested) }
  equal_call(mixed) { API.echo_mixed(mixed) }
  copied = API.echo_mixed(mixed)
  check(!copied.equal?(mixed) && !copied.product.equal?(mixed.product))
  check(!copied.ticket.equal?(first) && copied.ticket == first)
  copied.ticket.close
  check(API.serial(first) == huge)
  copied.bytes.replace("mutated")
  copied.product[1][1].bytes.replace("mutated payload")
  check(mixed.bytes == "\xff\0bytes".b && payload.bytes == "\0\xffpayload".b)
  dispose(copied)
  rounded = API.echo_mixed(replace(mixed, approximate: 1.00000001))
  check(rounded.approximate == [1.00000001].pack("e").unpack1("e"))
  check([rounded.precise].pack("E").unpack1("Q<") == (1 << 63))
  dispose(rounded)
  escaped = retained = duplicate = nil
  equal_call(bundle) do
    API.callback_record(bundle, ->(value) {
      escaped = value.primary
      duplicate = escaped.dup
      retained = escaped.retain
      check(API.serial(escaped) == huge)
      value
    })
  end
  check(escaped.closed? && duplicate.closed?)
  rejected(API::LeanBridgeError) { API.serial(escaped) }
  check(API.serial(retained) == huge)
  retained.close
  equal_call(tree) { API.callback_recursive(tree, ->(value) { value }) }
  calls = 0
  equal_call(bundle) { API.twice(bundle, ->(value) { calls += 1; value }) }
  check(calls == 2)
  equal_call(bundle) { API.repeatedly(bundle, ->(value) { value }, 3) }
  sentinel = RuntimeError.new("original callback error")
  error = rejected(RuntimeError) { API.callback_record(bundle, ->(_value) { raise sentinel }) }
  check(error.equal?(sentinel))
  rejected(LocalJumpError) { catch(:escape) { API.callback_record(bundle, ->(_value) { throw :escape }) } }
  rejected(FiberError) { API.callback_record(bundle, ->(value) { Fiber.new {}.resume; value }) }
  equal_call(bundle) { API.callback_record(bundle, ->(value) { value }) }
  equal_call(first) { API.factory(API.with_recovery(->(_unit) { first }, first)) }
  equal_call(bundle) { API.construct(first, API.with_recovery(->(_ticket) { bundle }, bundle)) }
  identity = API.identity_closure(API::UNIT)
  dispatcher = API.dispatch(bundle)
  equal_call(bundle) { dispatcher.call(identity) }
  equal_call(bundle) { dispatcher.call(->(value) { value }) }
  dispatcher.close
  identity.close
  closure = API.make_record(bundle)
  changed = replace(bundle, primary: second)
  equal_call(bundle) { closure.call(true, changed) }
  equal_call(changed) { closure.call(false, changed) }
  retained = closure.retain
  closure.close
  equal_call(bundle) { retained.call(true, bundle) }
  retained.close
  rejected(API::LeanBridgeError) { retained.call(true, bundle) }
  copy = first.clone(freeze: true)
  check(copy.frozen? && copy == first)
  copy.close
  check(copy.closed? && !first.closed?)
  rejected(TypeError) { Marshal.dump(first) }
  rejected(TypeError) { first.hash }
  [-> { API.new_ticket(true, "bad") }, -> { API.new_ticket(-1, "bad") },
   -> { API.new_ticket(1, "\xed\xa0\x80".b.force_encoding(Encoding::UTF_8)) },
   -> { API.echo_record({}) }, -> { API.echo_result(bundle) }, -> { API.echo_option(first) },
   -> { API.echo_tuple([first]) }, -> { API.serial(closure) },
   -> { API.echo_mixed(replace(mixed, scalar: "ab")) },
   -> { API.echo_mixed(replace(mixed, precise: 1)) },
   -> { API.echo_mixed(replace(mixed, words: [1 << 64])) }].each do |action|
    rejected(TypeError, RangeError, ArgumentError, EncodingError, API::LeanBridgeError, &action)
  end
  children = []
  cyclic = API::Tree::Branch.new(children: children)
  children << cyclic
  rejected(ArgumentError) { API.echo_recursive(cyclic) }
  deep = API::Chain::Stop.new
  130.times { deep = API::Chain::Link.new(ticket: first, next_: API::Some.new(deep)) }
  rejected(API::LeanBridgeError) { API.echo_chain(deep) }
  rejected(API::LeanBridgeError) { API.echo_array([first] * 262145) }
  rejected(API::LeanBridgeError) { API.new_ticket(1, "x" * (16 * 1024 * 1024 + 1)) }
  equal_call(bundle) { API.echo_record(bundle) }
  checks_from_thread = Thread.new do
    cross_thread = begin API.serial(first); false; rescue API::LeanBridgeError => error; error.status == 5; end
    escaped = API.new_ticket(123, "thread")
    local = API.serial(escaped) == 123
    [cross_thread && local, escaped]
  end.value
  check(checks_from_thread[0])
  check(checks_from_thread[1].closed?)
  first.close
  second.close
  check(first.closed? && second.closed?)
  puts JSON.generate({ checks: checks, ordinaryRequire: true })
end
