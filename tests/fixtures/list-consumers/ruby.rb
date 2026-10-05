# Independent public consumer of the prepared gem. No native adapter access.
require "json"
require "digest"
require "lean_bridge/lists"
API = LeanBridge::Lists
Some, Ok, Err = API::Some, API::Ok, API::Err
$checks = 0
def check(value)
  $checks += 1
  raise "check #{$checks} failed" unless value
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
    %i[sequences branches buffers arrays].each { |field| same(actual.public_send(field), expected.public_send(field)) }
  else
    check(actual == expected)
  end
end
def rejects(kind)
  begin
    yield
  rescue kind => error
    check(true)
    return error
  end
  raise "Expected #{kind}"
end

huge = (1 << 5120) + (1 << 255) + 17
cases = {
  unit: [API::UNIT], bool: [false, true],
  nat: [0, 1, 1 << 32, (1 << 53) + 1, 1 << 64, huge],
  int: [0, -1, -(1 << 32), (1 << 53) + 1, -(1 << 64), huge, -huge],
  float32: [0.0, -0.0, 1.0 / 3, 2.0 ** -149, -(2.0 ** -149), 1e300, Float::INFINITY, -Float::INFINITY, Float::NAN],
  float64: [0.0, -0.0, 1.0 / 3, 2.0 ** -1074, -(2.0 ** -1074), Float::INFINITY, -Float::INFINITY, Float::NAN],
  string: ["", "a\0λ🌿", "\0", "\u{10ffff}", "e\u0301"],
  bytes: ["".b, "\0\xff\x80".b, (0..255).to_a.pack("C*")],
  char: ["\0", "\x7f", "\u{d7ff}", "\u{e000}", "\u{ffff}", "🌿", "\u{10ffff}"]
}
[8, 16, 32, 64].each do |bits|
  cases["uint#{bits}".to_sym] = [0, 1, (1 << bits) - 1]
  cases["int#{bits}".to_sym] = [-(1 << (bits - 1)), -1, 0, (1 << (bits - 1)) - 1]
end
cases[:usize] = cases[:uint64]; cases[:isize] = cases[:int64]
check(cases.length == 19)
cases.each do |name, values|
  reverse = API.method("reverse_#{name}")
  normalize = name == :float32 ? ->(value) { [value].pack("e").unpack1("e") } : ->(value) { value }
  same(reverse.call([]), [])
  128.times do |index|
    input = [values[index % values.length], values[(index + 1) % values.length], values[index % values.length], values[(index + 2) % values.length]].freeze
    same(reverse.call(input), input.reverse.map(&normalize))
  end
  same(reverse.call([values.first]), [normalize.call(values.first)])
  rejects(TypeError) { reverse.call(nil) }
end

same(API.join(["a\0", "", "🌿"]), "a\0🌱🌱🌿"); same(API.join([]), "")
same(API.mix([[1, 2, 3], [], [4]]), [[4], [], [3, 2, 1]])
20.times do |index|
  packet = API::Packet.new(sequences: [[1, 2, 3], [], [index]],
    branches: [nil, Some.new(Ok.new([huge, API::UNIT])), Some.new(Err.new("oops\0"))],
    buffers: ["\0\xff".b, "".b], arrays: [[[true, "🌿"], [false, "\0"]], []])
  output = API.transform(packet)
  same(output, API::Packet.new(sequences: [[index], [], [3, 2, 1]],
    branches: [Some.new(Err.new("oops\0!")), Some.new(Ok.new([huge + 1, API::UNIT])), nil],
    buffers: ["".b, "\0\xff".b], arrays: [[], [[false, "\0"], [true, "🌿"]]]))
  check(output.frozen?)
  output.buffers[1].setbyte(0, 9); check(packet.buffers[0].getbyte(0) == 0)
  packet.sequences[0][0] = 99; packet.arrays[0][0] = [false, "x"]; packet.branches[1] = nil
  same(output.sequences[2], [3, 2, 1]); same(output.arrays[1][1], [true, "🌿"])
  same(output.branches[1], Some.new(Ok.new([huge + 1, API::UNIT])))
end
same(API.nest(nil), nil); same(API.nest(Some.new([])), Some.new([]))
same(API.nest(Some.new([Ok.new([API::UNIT, API::UNIT]), Err.new("bad\0"), Ok.new([])])), Some.new([Ok.new([]), Err.new("bad\0!"), Ok.new([API::UNIT, API::UNIT])]))
same(API.swap(Err.new(["first", "last"])), Ok.new(["last", "first"]))
same(API.swap(Ok.new([[huge, 42], [1, 2, 3]])), Err.new([[42, huge], [3, 2, 1]]))
25.times do |depth|
  value = depth == 24 ? 42 : []; depth.times { value = [value] }; same(API.deep(value), value)
end
input = "\0\xff".b; copies = API.duplicate(input)
same(copies, [input, input]); copies[0].setbyte(0, 7); check(copies[1] == input && input.getbyte(0) == 0)
same(API.duplicate("".b), ["".b, "".b])
shared = [1, 2]; copied = API.mix([shared, shared]); copied[0][0] = 9; same(copied[1], [2, 1]); same(shared, [1, 2])

class PretendArray < Array; end
class PretendSome < Some; end
class CoercionTrap
  def to_ary; raise "to_ary called"; end
  def to_int; raise "to_int called"; end
  def to_f; raise "to_f called"; end
  def to_str; raise "to_str called"; end
end
[nil, false, 42, "1", {}, (1..3).each, PretendArray.new([1]), CoercionTrap.new].each { |value| rejects(TypeError) { API.reverse_uint32(value) } }
[CoercionTrap.new, true, false, nil, "1", 1.0].each { |value| rejects(TypeError) { API.reverse_nat([0, value]) } }
rejects(TypeError) { API.reverse_string(["copied", CoercionTrap.new]) }
rejects(TypeError) { API.reverse_float64([0.0, CoercionTrap.new]) }
rejects(TypeError) { API.nest(PretendSome.new([])) }
rejects(TypeError) { API.nest(Some.new([Ok.new([]), nil])) }
rejects(TypeError) { API.nest(Some.new([Ok.new([nil])])) }
rejects(TypeError) { API.mix([[1], PretendArray.new([2])]) }
rejects(TypeError) { API.transform({sequences: []}) }
[[], [1], [[], [], []]].each { |value| rejects(ArgumentError) { API.swap(Ok.new(value)) } }
[
  [:unit, nil, TypeError], [:unit, 0, TypeError], [:bool, 1, TypeError],
  [:nat, -1, RangeError], [:int, 1.0, TypeError], [:float32, 1, TypeError], [:float64, true, TypeError],
  [:char, "ab", RangeError], [:char, "", RangeError], [:char, "\xed\xa0\x80".force_encoding("UTF-8"), EncodingError],
  [:string, "\xff".force_encoding("UTF-8"), EncodingError], [:bytes, [1], TypeError], [:bytes, nil, TypeError]
].each { |name, bad, kind| rejects(kind) { API.public_send("reverse_#{name}", [cases.fetch(name).first, bad]) } }
[8, 16, 32, 64].each do |bits|
  [-1, 1 << bits].each { |value| rejects(RangeError) { API.public_send("reverse_uint#{bits}", [0, value]) } }
  [-(1 << (bits - 1)) - 1, 1 << (bits - 1)].each { |value| rejects(RangeError) { API.public_send("reverse_int#{bits}", [0, value]) } }
end
[-1, 1 << 64].each { |value| rejects(RangeError) { API.reverse_usize([0, value]) } }
[-(1 << 63) - 1, 1 << 63].each { |value| rejects(RangeError) { API.reverse_isize([0, value]) } }
cycle = []; cycle << cycle
rejects(TypeError) { API.reverse_uint32(cycle) }; rejects(TypeError) { API.deep(cycle) }
wrong_depth = 42; 25.times { wrong_depth = [wrong_depth] }; rejects(TypeError) { API.deep(wrong_depth) }
rejects(RangeError) { API.reverse_unit(Array.new((1 << 21) + 1, API::UNIT)) }
rejects(RangeError) { API.reverse_bytes(["x".b * (16 * 1024 * 1024)]) }
3.times { rejects(RangeError) { API.duplicate("x".b * (6 * 1024 * 1024)) }; same(API.duplicate(input), [input, input]) }
rejects(RangeError) { API.generate(2097153) }; same(API.generate(1), [7]); same(API.generate(30000), Array.new(30000, 7))
GC.start; GC.compact
same(API.reverse_nat([huge, 42]), [42, huge])
4.times.map { |thread| Thread.new { 64.times { |i| same(API.reverse_nat([huge + thread + i, 42]), [42, huge + thread + i]) } } }.each(&:value)

root = Gem.loaded_specs.fetch("lists-api").full_gem_path
libraries = File.read("/proc/self/maps").lines.filter_map { |line| file = line.split.last; file if file&.start_with?(root + "/") && file.end_with?(".so") }.uniq.sort
puts JSON.generate(checks: $checks, ruby: RUBY_DESCRIPTION, gem_root: root, api: API.method(:reverse_uint32).source_location.first,
  native_libraries: libraries.to_h { |file| [file.delete_prefix(root + "/"), Digest::SHA256.file(file).hexdigest] })
