require_relative "probe"

module Probe
  ticket = API.new_ticket(42, "packet")
  large = (1 << 128) + 1
  scalars = API::Scalars.new(unit: API::UNIT, flag: true, char: "🌱", natural: large, integer: -large,
    u8: 255, u16: 65535, u32: (1 << 32) - 1, u64: (1 << 64) - 1,
    i8: -128, i16: -32768, i32: -(1 << 31), i64: -(1 << 63),
    word: (1 << 64) - 1, signed_word: -(1 << 63), f32: 1.5, f64: -2.25,
    text: "A\0🌱", bytes: "\0\xff\x01".b)
  packet = API::Packet.new(ticket: ticket, scalars: scalars, optional: API::Some.new(API::Some.new(API::UNIT)), empty: API::Empty.new)
  check(API.inspect(packet), "Lean independently checks all nineteen primitive fields")
  equal_call(packet) { API.make_packet(ticket) }
  equal_call(packet) { API.echo(packet) }
  check(scalars.deconstruct_keys(nil).length == 19)
  scalars.deconstruct_keys(nil).each do |name, expected|
    made = API.make_packet(ticket)
    check(made.scalars.public_send(name) == expected, "Lean-constructed #{name}")
    dispose(made)
  end
  [nil, API::Some.new(nil), API::Some.new(API::Some.new(API::UNIT))].each_with_index do |optional, index|
    changed = replace(packet, optional: optional)
    check(API.option_case(changed) == index)
    equal_call(changed) { API.echo(changed) }
  end
  change = ->(name, value) { replace(packet, scalars: replace(scalars, **{name => value})) }
  [[:u8, 0, 255], [:u16, 0, 65535], [:u32, 0, (1 << 32) - 1], [:u64, 0, (1 << 64) - 1],
   [:i8, -128, 127], [:i16, -32768, 32767], [:i32, -(1 << 31), (1 << 31) - 1],
   [:i64, -(1 << 63), (1 << 63) - 1], [:word, 0, (1 << 64) - 1],
   [:signed_word, -(1 << 63), (1 << 63) - 1]].each do |name, minimum, maximum|
    [minimum, maximum, 0, 1].each do |value|
      expected = change.call(name, value)
      equal_call(expected) { API.echo(expected) }
    end
    [minimum - 1, maximum + 1, true, 1.0].each { |bad| rejected([TypeError, RangeError]) { API.echo(change.call(name, bad)) } }
  end
  [:natural, :integer].each do |name|
    [0, 1, (1 << 2048) + 3].each do |value|
      expected = change.call(name, value)
      equal_call(expected) { API.echo(expected) }
    end
    rejected(TypeError) { API.echo(change.call(name, true)) }
  end
  expected = change.call(:integer, -(1 << 2048))
  equal_call(expected) { API.echo(expected) }
  rejected(RangeError) { API.echo(change.call(:natural, -1)) }
  [[:unit, nil], [:flag, 1], [:char, ""], [:char, "\xed\xbf\xbf".b.force_encoding(Encoding::UTF_8)],
   [:text, "\xed\xa0\x80".b.force_encoding(Encoding::UTF_8)], [:bytes, [0, 1]], [:f32, 1], [:f64, true]].each do |name, bad|
    rejected([TypeError, RangeError, EncodingError]) { API.echo(change.call(name, bad)) }
  end
  [0, 0xd7ff, 0xe000, 0x10ffff].each do |code|
    expected = change.call(:char, code.chr(Encoding::UTF_8))
    equal_call(expected) { API.echo(expected) }
  end
  [0.0, -0.0, 1.00000001, Float::INFINITY, -Float::INFINITY].each do |value|
    check(API.bits32(change.call(:f32, value)) == [value].pack("e").unpack1("L<"))
    check(API.bits64(change.call(:f64, value)) == [value].pack("E").unpack1("Q<"))
  end
  [:f32, :f64].each do |name|
    value = API.echo(change.call(name, Float::NAN))
    check(value.scalars.public_send(name).nan?)
    dispose(value)
  end
  equal_call([]) { API.units([]) }
  equal_call([API::UNIT] * 31) { API.units([API::UNIT] * 31) }
  faults = sweep { API.echo(packet) }
  check(API.inspect(packet))
  finish(faults.merge(primitives: 19))
end
