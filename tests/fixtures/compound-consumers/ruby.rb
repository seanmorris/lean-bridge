# Independent public consumer of the prepared gem. No native adapter access.
require "json"
require "digest"
require "lean_bridge/compounds"
API = LeanBridge::Compounds
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
    %i[choice products rows nested].each { |field| same(actual.public_send(field), expected.public_send(field)) }
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
  option, result, product = %w[option result tuple].map { |kind| API.method("#{kind}_#{name}") }
  normalize = name == :float32 ? ->(value) { [value].pack("e").unpack1("e") } : ->(value) { value }
  same(option.call(nil), nil)
  128.times do |index|
    a, b = values[index % values.length], values[(index + 1) % values.length]
    same(option.call(Some.new(a)), Some.new(normalize.call(a)))
    same(result.call(Ok.new(a)), Err.new(normalize.call(a)))
    same(result.call(Err.new(a)), Ok.new(normalize.call(a)))
    same(product.call([a, b]), [normalize.call(b), normalize.call(a)])
  end
end

states = [nil, Some.new(nil), Some.new(Some.new(API::UNIT))]
state = nil
30.times do |step|
  same(state, states[step % 3]); check(API.classify(state) == step % 3)
  state = API.next(state)
end
same(API.make, Some.new(Ok.new([(1 << 64) - 1, API::UNIT])))
same(API.flip(Ok.new([42, Some.new(API::UNIT)])), Err.new([42, Some.new(API::UNIT)]))
same(API.flip(Ok.new([0, nil])), Err.new([0, nil]))
same(API.flip(Err.new(Some.new("a\0λ"))), Ok.new(Some.new("a\0λ")))
same(API.flip(Err.new(nil)), Ok.new(nil))
same(API.duplicate(nil), Err.new("empty"))
same(API.duplicate(Some.new("\0\xff".b)), Ok.new(Some.new(["\0\xff".b, "\0\xff".b])))

choices = [nil, Some.new(Ok.new([huge, API::UNIT])), Some.new(Err.new("oops\0"))]
nested = [Ok.new(nil), Ok.new(Some.new(Ok.new([42, API::UNIT]))), Ok.new(Some.new(Err.new("bad"))), Err.new(nil), Err.new(Some.new(huge))]
choices.each do |choice|
  nested.each do |inside|
    rows = [nil, Some.new(Ok.new(["row\0🌿", (1 << 64) - 1])), Some.new(Err.new(["\0\xff".b, -huge]))]
    original = API::Packet.new(choice: choice, products: [[4, "a\0"], [true, "🌿"]], rows: rows, nested: inside)
    output = API.transform(original)
    expected = if choice.nil? then nil
      elsif choice.value.instance_of?(Ok) then Some.new(Ok.new([huge + 1, API::UNIT]))
      else Some.new(Err.new("oops\0!")) end
    same(output, API::Packet.new(choice: expected, products: [[5, "a\0!"], [false, "🌿"]], rows: rows.reverse, nested: inside))
    check(output.frozen?)
    output.rows[0].value.value[0].setbyte(0, 7)
    check(rows[2].value.value[0].getbyte(0) == 0)
    output.products[0][1].replace("changed"); check(original.products[0][1] == "a\0")
  end
end
25.times do |depth|
  value = depth == 24 ? Ok.new([42, API::UNIT]) : nil
  depth.times { value = Some.new(value) }
  same(API.deep(value), value)
end
deep_error = Err.new("deep\0λ")
24.times { deep_error = Some.new(deep_error) }
same(API.deep(deep_error), deep_error)
input = "\0\xff".b
copies = API.duplicate(Some.new(input)).value.value
copies[0].setbyte(0, 7); check(copies[1].getbyte(0) == 0 && input.getbyte(0) == 0)
copy = API.tuple_bytes([input, input]); copy[0].setbyte(0, 9); check(copy[1] == input)

# Ruby Data provides frozen branches, value semantics and positional/key patterns.
[Some, Ok, Err].each do |branch|
  check(branch.new(42).frozen? && branch.new(42) == branch.new(42))
  check(branch.new(42).eql?(branch.new(42)) && branch.new(42).hash == branch.new(42).hash)
  check(branch.new(42).deconstruct == [42] && branch.new(42).deconstruct_keys(nil) == {value: 42})
  rejects(FrozenError) { branch.new(42).instance_variable_set(:@extra, true) }
  rejects(ArgumentError) { branch.new }
  rejects(ArgumentError) { branch.new(1, 2) }
end
check(Some.new(nil) != nil && Some.new(false) != Some.new(nil) && Ok.new(42) != Err.new(42))
case API.result_string(Ok.new("message"))
in Err(value: "message") then check(true)
else raise "wrong result branch"
end
case API.option_unit(Some.new(API::UNIT))
in Some(value) then check(value.equal?(API::UNIT))
else raise "lost Unit presence"
end
class PretendSome < Some; end
class PretendArray < Array; end
[0, false, [], {}, {value: 1}, Ok.new(1), PretendSome.new(1)].each { |value| rejects(TypeError) { API.option_uint32(value) } }
[nil, 42, Some.new(42), [true, 42], {ok: 42}].each { |value| rejects(TypeError) { API.result_uint32(value) } }
[nil, "ab", {0 => 1, 1 => 2}, PretendArray.new([1, 2])].each { |value| rejects(TypeError) { API.tuple_uint32(value) } }
[[], [1], [1, 2, 3]].each { |value| rejects(ArgumentError) { API.tuple_uint32(value) } }
[
  [:unit, nil, TypeError], [:unit, 0, TypeError], [:bool, 1, TypeError], [:uint8, 256, RangeError],
  [:uint64, true, TypeError], [:uint64, 1 << 64, RangeError], [:int8, -129, RangeError], [:nat, -1, RangeError],
  [:int, 1.0, TypeError], [:float32, 1, TypeError], [:float64, true, TypeError],
  [:char, "ab", RangeError], [:char, "", RangeError], [:char, "\xed\xa0\x80".force_encoding("UTF-8"), EncodingError],
  [:string, "\xff".force_encoding("UTF-8"), EncodingError], [:bytes, [1], TypeError], [:bytes, nil, TypeError]
].each do |name, bad, kind|
  rejects(kind) { API.public_send("option_#{name}", Some.new(bad)) }
  rejects(kind) { API.public_send("result_#{name}", Ok.new(bad)) }
  rejects(kind) { API.public_send("result_#{name}", Err.new(bad)) }
  rejects(kind) { API.public_send("tuple_#{name}", [bad, bad]) }
end
cycle = []; cycle << cycle << cycle
rejects(TypeError) { API.tuple_uint32(cycle) }
wrong_depth = Some.new(nil); 24.times { wrong_depth = Some.new(wrong_depth) }
rejects(TypeError) { API.deep(wrong_depth) }
rejects(RangeError) { API.option_bytes(Some.new("x".b * (16 * 1024 * 1024))) }
rejects(RangeError) { API.duplicate(Some.new("x".b * (6 * 1024 * 1024))) }
same(API.duplicate(Some.new(input)), Ok.new(Some.new([input, input])))
4.times.map { |thread| Thread.new { 64.times { |i| same(API.option_nat(Some.new(huge + thread + i)), Some.new(huge + thread + i)) } } }.each(&:value)

root = Gem.loaded_specs.fetch("compounds-api").full_gem_path
libraries = File.read("/proc/self/maps").lines.filter_map { |line| file = line.split.last; file if file&.start_with?(root + "/") && file.end_with?(".so") }.uniq.sort
puts JSON.generate(checks: $checks, ruby: RUBY_DESCRIPTION, gem_root: root, api: API.method(:classify).source_location.first,
  native_libraries: libraries.to_h { |file| [file.delete_prefix(root + "/"), Digest::SHA256.file(file).hexdigest] })
