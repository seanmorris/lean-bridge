# Independent public consumer of a prepared alias gem. No native adapter access.
require "json"
require "digest"
require "lean_bridge/aliases"
API = LeanBridge::Aliases
Some, Ok, Err = API::Some, API::Ok, API::Err
$checks = 0
def check(value)
  $checks += 1
  raise "alias check #{$checks} failed" unless value
end
def same(actual, expected)
  check(actual.class == expected.class)
  case expected
  when Float
    check(expected.nan? ? actual.nan? : [actual].pack("E") == [expected].pack("E"))
  when Some, Ok, Err
    same(actual.value, expected.value)
  when Array
    check(actual.length == expected.length)
    actual.zip(expected) { |left, right| same(left, right) }
  when String
    check(actual.encoding == expected.encoding && actual == expected)
  when API::Packet
    %i[count text rows maybe outcome].each { |field| same(actual.public_send(field), expected.public_send(field)) }
  else
    check(actual == expected)
  end
end
def rejects(kind)
  begin
    yield
  rescue kind => error
    check(true)
    same(API.make, 41)
    return error
  end
  raise "Expected #{kind}"
end

cases = {
  unit: [API::UNIT], bool: [false, true],
  nat: [0, 1, (1 << 53) + 1, (1 << 5120) + 19],
  int: [0, -1, (1 << 53) + 1, (1 << 5120) + 31, -((1 << 5120) + 31)],
  float32: [0.0, -0.0, 1.0 / 3, 2.0 ** -149, -(2.0 ** -149), 1e300, Float::INFINITY, -Float::INFINITY, Float::NAN],
  float64: [0.0, -0.0, 1.0 / 3, 2.0 ** -1074, -(2.0 ** -1074), Float::INFINITY, -Float::INFINITY, Float::NAN],
  string: ["", "A\0🌱", "\u{10ffff}", "e\u0301"],
  bytes: ["".b, "\0\xff\1".b, (0..255).to_a.pack("C*")],
  char: ["\0", "\u{d7ff}", "\u{e000}", "🌱", "\u{10ffff}"]
}
[8, 16, 32, 64].each do |bits|
  cases["uint#{bits}".to_sym] = [0, 1, (1 << bits) - 1]
  cases["int#{bits}".to_sym] = [-(1 << (bits - 1)), -1, 0, (1 << (bits - 1)) - 1]
end
cases[:usize] = cases[:uint64]; cases[:isize] = cases[:int64]
check(cases.length == 19)
cases.each do |name, values|
  echo = API.method("echo_#{name}"); check(echo.arity == 1)
  16.times do
    values.each do |value|
      expected = name == :float32 ? [value].pack("e").unpack1("e") : value
      same(echo.call(value), expected)
    end
  end
end
check(API::UNIT.frozen?)
check(API.make == 41 && API.method(:make).arity == 0)
same(API.increment(41), 42); same(API.increment((1 << 32) - 1), 0)
same(API.label, "alias🌱")

# Lean checks the nineteen fields independently; a changed non-Unit field fails.
fields = {v_unit: API::UNIT, v_bool: true, v_uint8: 255, v_uint16: 65535,
  v_uint32: (1 << 32) - 1, v_uint64: (1 << 64) - 1, v_int8: -128,
  v_int16: -32768, v_int32: -(1 << 31), v_int64: -(1 << 63),
  v_nat: (1 << 5120) + 19, v_int: -((1 << 5120) + 31),
  v_float32: 1.5, v_float64: -2.25, v_string: "A\0🌱",
  v_bytes: "\0\xff\1".b, v_char: "🌱", v_usize: (1 << 32) - 1, v_isize: -(1 << 31)}
original = API::Scalars.new(**fields)
check(API.inspect_scalars(original))
copy = API.echo_scalars(original); check(!copy.equal?(original) && copy.frozen?)
fields.each do |name, value|
  same(copy.public_send(name), value)
  next if name == :v_unit
  alternative = case value
  when TrueClass then false
  when Integer then 0
  when Float then 0.0
  when String then name == :v_char ? "x" : name == :v_bytes ? "".b : ""
  end
  check(API.inspect_scalars(API::Scalars.new(**fields.merge(name => alternative))) == false)
end
rejects(FrozenError) { copy.instance_variable_set(:@v_uint32, 1) }
rejects(TypeError) { API.echo_scalars(API::Scalars.new(**fields.merge(v_unit: nil))) }
rejects(RangeError) { API.echo_scalars(API::Scalars.new(**fields.merge(v_nat: -1))) }
same(API.echo_scalars(API::Scalars.new(**fields.merge(v_int: -1))).v_int, -1)
copy.v_string.replace("changed"); copy.v_bytes.setbyte(0, 5)
same(original.v_string, "A\0🌱"); same(original.v_bytes, "\0\xff\1".b)

[nil, Some.new(nil), Some.new(Some.new(API::UNIT))].each { |value| same(API.echo_maybe(value), value) }
[Ok.new([0, "".b]), Ok.new([(1 << 32) - 1, "\0\xff".b]), Err.new(""), Err.new("oops\0🌱")].each { |value| same(API.echo_outcome(value), value) }
24.times do |index|
  rows = [[1, 2, 3], [], [index]]
  packet = API::Packet.new(count: index, text: "a\0🌱", rows: rows, maybe: Some.new(Some.new(API::UNIT)), outcome: Ok.new([7, "\0\xff".b]))
  changed = API.change_packet(packet)
  check(!changed.equal?(packet) && changed.frozen?)
  same(changed.count, index + 1); same(changed.rows, [[1, 2, 3], [], [index]])
  same(changed.maybe, Some.new(Some.new(API::UNIT))); same(changed.outcome, Ok.new([7, "\0\xff".b]))
  packets = API.reverse_packets([packet, changed])
  check(packets.length == 2 && !packets[0].equal?(changed) && !packets[1].equal?(packet))
  same(packets.map(&:count), [index + 1, index])
  rows[0].clear(); packet.text.replace("changed"); packet.outcome.value[1].setbyte(0, 9)
  same(changed.rows[0], [1, 2, 3]); same(packets[1].rows[0], [1, 2, 3])
  same(changed.text, "a\0🌱"); same(packets[1].outcome, Ok.new([7, "\0\xff".b]))
end
same(API.reverse_rows([[1, 2], [], [3]]), [[2, 1], [], [3]])
same(API.reverse_rows([]), []); same(API.reverse_packets([]), [])
shared = [1, 2]; copies = API.reverse_rows([shared, shared]); copies[0][0] = 7
same(copies[1], [2, 1]); same(shared, [1, 2])
same(API.duplicate("\0\xff".b), Ok.new([7, "\0\xff\0\xff".b]))

class CoercionTrap
  def to_ary; raise "to_ary called"; end
  def to_int; raise "to_int called"; end
  def to_f; raise "to_f called"; end
  def to_str; raise "to_str called"; end
end
class PretendArray < Array; end
class PretendSome < Some; end
class PretendPacket < API::Packet; end
class PretendString < String; end
rejects(TypeError) { API.reverse_rows(PretendArray.new) }
rejects(TypeError) { API.echo_maybe(PretendSome.new(nil)) }
rejects(TypeError) { API.change_packet(PretendPacket.allocate) }
rejects(TypeError) { API.echo_string(PretendString.new("hello")) }
%i[nat float64 string bytes].each { |name| rejects(TypeError) { API.public_send("echo_#{name}", CoercionTrap.new) } }
[
  [:unit, nil, TypeError], [:unit, 0, TypeError], [:bool, 1, TypeError],
  [:nat, -1, RangeError], [:int, 1.0, TypeError], [:float32, 1, TypeError], [:float64, true, TypeError],
  [:char, "ab", RangeError], [:char, "", RangeError], [:char, "\xed\xa0\x80".force_encoding("UTF-8"), EncodingError],
  [:string, "\xff".force_encoding("UTF-8"), EncodingError], [:bytes, [1], TypeError], [:bytes, nil, TypeError]
].each { |name, bad, kind| rejects(kind) { API.public_send("echo_#{name}", bad) } }
[8, 16, 32, 64].each do |bits|
  [-1, 1 << bits].each { |value| rejects(RangeError) { API.public_send("echo_uint#{bits}", value) } }
  [-(1 << (bits - 1)) - 1, 1 << (bits - 1)].each { |value| rejects(RangeError) { API.public_send("echo_int#{bits}", value) } }
end
[-1, 1 << 64].each { |value| rejects(RangeError) { API.echo_usize(value) } }
[-(1 << 63) - 1, 1 << 63].each { |value| rejects(RangeError) { API.echo_isize(value) } }
rejects(TypeError) { API.reverse_rows([[true]]) }
rejects(TypeError) { API.echo_maybe(Some.new(0)) }
rejects(TypeError) { API.echo_outcome(Ok.new([true, "x".b])) }
rejects(TypeError) { API.echo_outcome(Err.new(7)) }
rejects(TypeError) { API.change_packet(fields) }
rejects(ArgumentError) { API.echo_outcome(Ok.new([])) }
rejects(ArgumentError) { API.echo_outcome(Ok.new([1, "".b, 2])) }
cycle = []; cycle << cycle; rejects(TypeError) { API.reverse_rows(cycle) }
rejects(RangeError) { API.echo_bytes("x".b * (16 * 1024 * 1024 + 1)) }
3.times do
  rejects(RangeError) { API.produce(16 * 1024 * 1024 + 1) }
  same(API.produce(3), "\7\7\7".b)
end
GC.start; GC.compact
check(API.inspect_scalars(original))
4.times.map { |thread| Thread.new { 32.times { |i| same(API.echo_nat((1 << 5120) + thread + i), (1 << 5120) + thread + i) } } }.each(&:value)

root = Gem.loaded_specs.fetch("aliases-api").full_gem_path
libraries = File.read("/proc/self/maps").lines.filter_map { |line| file = line.split.last; file if file&.start_with?(root + "/") && file.end_with?(".so") }.uniq.sort
puts JSON.generate(checks: $checks, ruby: RUBY_DESCRIPTION, gem_root: root, api: API.method(:make).source_location.first,
  native_libraries: libraries.to_h { |file| [file.delete_prefix(root + "/"), Digest::SHA256.file(file).hexdigest] })
