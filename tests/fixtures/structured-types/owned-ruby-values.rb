require_relative "probe"

module Probe
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

  if ARGV[1] == "malformed"
    info = Native::TYPE_INFO.fetch("Mixed")
    ticket = info[:fields][0]
    original = Native.method(:"output#{info[:index]}")
    partials = []
    Native.define_singleton_method(:"output#{info[:index]}") do |value, scope, output, depth = 0|
      partials << __send__(:"output#{ticket[:index]}", value[ticket[:offset], 8].unpack1("Q<"), scope, output, depth + 1)
      value[info[:fields][1][:offset], 8] = [0].pack("Q<")
      original.call(value, scope, output, depth)
    end
    rejected(Native::Invalid, 9) { API.echo_mixed(mixed) }
    check(partials.length == 1 && partials[0].closed?)
    rejected(Owned::Error, 7) { API.serial(first) }
    finish
    exit
  end

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
  row = [nil, API::Some.new(first), API::Some.new(second)]
  equal_call(row) { API.echo_row(row) }
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

  closure = API.make_record(bundle)
  changed = replace(bundle, primary: second)
  equal_call(bundle) { closure.call(true, changed) }
  equal_call(changed) { closure.call(false, changed) }
  retained = closure.retain
  closure.close
  equal_call(bundle) { retained.call(true, bundle) }
  retained.close
  rejected(Owned::Error, 4) { retained.call(true, bundle) }
  recursive = API.make_recursive(tree)
  equal_call(tree) { recursive.call(true, API::Tree::Branch.new(children: [])) }
  recursive.close
  identity = API.identity_closure(API::UNIT)
  equal_call(bundle) { identity.call(bundle) }
  identity.close

  [-> { API.new_ticket(true, "bad") }, -> { API.new_ticket(-1, "bad") },
   -> { API.new_ticket(1, "\xed\xa0\x80".b.force_encoding(Encoding::UTF_8)) },
   -> { API.echo_record({}) }, -> { API.echo_result(bundle) }, -> { API.echo_option(first) },
   -> { API.echo_tuple([first]) }, -> { API.serial(closure) },
   -> { API.echo_mixed(replace(mixed, scalar: "ab")) },
   -> { API.echo_mixed(replace(mixed, precise: 1)) },
   -> { API.echo_mixed(replace(mixed, words: [1 << 64])) }].each do |action|
    rejected([TypeError, RangeError, ArgumentError, EncodingError], &action)
  end
  children = []
  cyclic = API::Tree::Branch.new(children: children)
  children << cyclic
  rejected(ArgumentError) { API.echo_recursive(cyclic) }
  deep = API::Chain::Stop.new
  130.times { deep = API::Chain::Link.new(ticket: first, next_: API::Some.new(deep)) }
  rejected(Native::Limit, 2) { API.echo_chain(deep) }
  rejected(Native::Limit, 2) { API.echo_array([first] * 262145) }
  rejected(Native::Limit, 2) { API.new_ticket(1, "x" * (16 * 1024 * 1024 + 1)) }

  def self.raw_rejection(name, value)
    scope = Native::ValueScope.new(state)
    begin
      info = Native::TYPE_INFO.fetch(name)
      raw = Native.__send__(:"input#{info[:index]}", value, scope)
      changed = yield raw
      rejected(Native::Invalid, 9) { Native.__send__(:"output#{info[:index]}", changed, scope, Native::Output.new(nil)) }
    ensure
      scope.close
    end
  end
  raw_rejection("bool", false) { 2 }
  raw_rejection("unit", API::UNIT) { 1 }
  raw_rejection("char", "a") { 0xd800 }
  raw_rejection("Choice", API::Choice::Empty.new) { |raw| raw[0, 4] = [999].pack("L<"); raw }
  raw_rejection("string", "x") { |raw| raw[0, 8] = [0].pack("Q<"); raw }
  raw_rejection("nat", 7) { |raw| Fiddle::Pointer.new(raw)[4, 4] = [-1].pack("l<"); raw }
  raw_rejection("int", 7) { |raw| Fiddle::Pointer.new(raw)[0, 4] = [-1].pack("l<"); raw }
  faults = sweep { API.echo_mixed(mixed) }
  equal_call(mixed) { API.echo_mixed(mixed) }
  finish(faults)
end
