# Independent consumer of the installed public collection API, never its converters.
require "json"
require "digest"
require "lean_bridge/collections"

module CollectionConsumer
  extend self
  API = LeanBridge::Collections
  FIELDS = {
    API::Primitives => %i[unit flag u8 u16 u32 u64 i8 i16 i32 i64 natural integer f32 f64 text bytes char_ usize isize],
    API::Empty => [], API::Single => [:value], API::Count => [:value],
    API::Pair => %i[first second], API::Reversed => %i[second first],
    API::Packet => %i[label values empty single count pair reversed]
  }.freeze
  COUNTERS = Mutex.new
  $checks = $calls = $rejected = 0
  def check(value, message = "collection assertion")
    COUNTERS.synchronize { $checks += 1 }
    raise message unless value
  end
  def call(name, *args)
    COUNTERS.synchronize { $calls += 1 }
    API.public_send(name, *args)
  end
  def rejects(kind)
    failed = false
    begin; yield; rescue kind; failed = true; end
    check(failed, "expected #{kind}"); $rejected += 1
    check(call(:array_reverse_uint32, [[1, 2, 3]]) == [[3, 2, 1]], "recovery")
  end
  def leaf(type, actual, expected)
    check(actual.instance_of?(expected.class), "exact host type for #{type}")
    if type == :float32 || type == :float64
      expected = [expected].pack("e").unpack1("e") if type == :float32
      check(expected.nan? ? actual.nan? : [actual].pack("E") == [expected].pack("E"), "floating-point bits")
    elsif type == :unit
      check(actual.equal?(API::UNIT))
    else
      check(actual == expected, "value for #{type}")
      check(actual.encoding == (type == :bytes ? Encoding::BINARY : Encoding::UTF_8)) if actual.instance_of?(String)
    end
  end
  def same(actual, expected)
    check(actual.instance_of?(expected.class), "copied host type")
    if expected.instance_of?(API::Primitives)
      check(actual.frozen?)
      FIELDS.fetch(API::Primitives).zip(CASES).each { |field, spec| leaf(spec[0], actual.public_send(field), expected.public_send(field)) }
    elsif FIELDS.key?(expected.class)
      check(actual.frozen?)
      FIELDS.fetch(expected.class).each { |field| same(actual.public_send(field), expected.public_send(field)) }
    elsif expected.instance_of?(Array)
      check(actual.length == expected.length)
      actual.zip(expected).each { |left, right| same(left, right) }
    elsif expected.instance_of?(Float)
      leaf(:float64, actual, expected)
    else
      check(actual == expected)
      check(actual.encoding == expected.encoding) if expected.instance_of?(String)
    end
  end
  HUGE = (1 << 5120) + (1 << 255) + 17
  FLOATS32 = [0, 0x80000000, 1, 0x7fffff, 0x800000, 0x3f800000, 0x7f7fffff, 0x7f800000, 0xff800000, 0x7fc00000].map { |bits| [bits].pack("L<").unpack1("e") }
  FLOATS64 = [0, 0x8000000000000000, 1, 0xfffffffffffff, 0x10000000000000, 0x3ff0000000000000,
    0x7fefffffffffffff, 0x7ff0000000000000, 0xfff0000000000000, 0x7ff8000000000000].map { |bits| [bits].pack("Q<").unpack1("E") }
  BAD_TEXT = "\xed\xa0\x80".force_encoding(Encoding::UTF_8)
  CASES = [
    [:unit, [API::UNIT], [[TypeError, nil], [TypeError, 0], [TypeError, []]]],
    [:bool, [false, true], [[TypeError, 0], [TypeError, 1], [TypeError, "true"], [TypeError, nil]]],
    *[8, 16, 32, 64].map { |bits| ["uint#{bits}".to_sym, [0, 1, (1 << (bits - 1)), (1 << bits) - 1],
      [[RangeError, -1], [RangeError, 1 << bits], [TypeError, 1.5], [TypeError, "1"], [TypeError, true]]] },
    *[8, 16, 32, 64].map { |bits| ["int#{bits}".to_sym, [-(1 << (bits - 1)), -1, 0, (1 << (bits - 1)) - 1],
      [[RangeError, -(1 << (bits - 1)) - 1], [RangeError, 1 << (bits - 1)], [TypeError, 1.5], [TypeError, "1"]]] },
    [:nat, [0, 1, HUGE], [[RangeError, -1], [TypeError, 1.0], [TypeError, true]]],
    [:int, [-HUGE, 0, HUGE], [[TypeError, 1.0], [TypeError, true], [TypeError, "1"]]],
    [:float32, [*FLOATS32, 1.0000000596046448, 1e300], [[TypeError, 1], [TypeError, "1"], [TypeError, nil]]],
    [:float64, FLOATS64, [[TypeError, 1], [TypeError, "1"], [TypeError, nil]]],
    [:string, ["", "\0", "A\0B", "e\u0301🙂", "\u{10ffff}"], [[TypeError, nil], [TypeError, 1], [EncodingError, BAD_TEXT], [EncodingError, "abc".b]]],
    [:bytes, ["".b, "\0\xff".b, (0..255).to_a.pack("C*")], [[TypeError, nil], [TypeError, 1], [TypeError, []]]],
    [:char, [0, 65, 0x301, 0xd7ff, 0xe000, 0xffff, 0x1f642, 0x10ffff].map { |code| code.chr(Encoding::UTF_8) },
      [[RangeError, ""], [RangeError, "ab"], [EncodingError, BAD_TEXT], [EncodingError, "A".b], [TypeError, 65], [TypeError, nil]]],
    [:usize, [0, 1, (1 << 32) - 1, (1 << 53) + 1, (1 << 64) - 1], [[RangeError, -1], [RangeError, 1 << 64], [TypeError, "1"]]],
    [:isize, [-(1 << 63), -(1 << 53) - 1, -1, 0, (1 << 63) - 1], [[RangeError, -(1 << 63) - 1], [RangeError, 1 << 63], [TypeError, "1"]]]
  ].freeze
  def primitive(index)
    API::Primitives.new(**FIELDS.fetch(API::Primitives).zip(CASES.map { |_type, values, _bad| values[index % values.length] }).to_h)
  end
  FIELDS.each do |type, fields|
    check(type.instance_method(:initialize).parameters == fields.map { |field| [:keyreq, field] })
    rejects(ArgumentError) { type.new(extra: 1) }
  end
  primitives = CASES.map do |type, values, invalid|
    before = $checks
    same(call("array_reverse_#{type}", []), [])
    same(call("array_reverse_#{type}", [[], []]), [[], []])
    128.times do |index|
      row = [values[index % values.length], values[(index + 1) % values.length], values[(index + 2) % values.length], values[index % values.length]]
      input = [row, [], [values[0]], row]
      result = call("array_reverse_#{type}", input)
      check(result.instance_of?(Array) && result.length == input.length)
      result.zip(input.reverse).each do |actual, expected|
        check(actual.instance_of?(Array) && actual.length == expected.length)
        actual.zip(expected.reverse).each { |a, b| leaf(type, a, b) }
      end
    end
    rejects(TypeError) { call("array_reverse_#{type}", nil) }
    invalid.each { |kind, value| rejects(kind) { call("array_reverse_#{type}", [[values[0]], [values[0], value]]) } }
    {name: type, checks: $checks - before, rejected_cases: invalid.length + 1}
  end
  128.times do |index|
    a, b, c = primitive(index), primitive(index + 1), primitive(index + 2)
    same(call(:record_reverse, [a, b, c]), [c, b, a])
  end
  same(call(:record_reverse, []), [])
  interpreted = [API::UNIT, true, 255, 65535, (1 << 32) - 1, (1 << 64) - 1,
    -128, -32768, -(1 << 31), -(1 << 63), 1 << 200, -(1 << 200), -0.0, 3.25,
    "🌱\0", "\xff\0\x80".b, "🌱", (1 << 64) - 1, -(1 << 31)]
  fields = FIELDS.fetch(API::Primitives)
  record = API::Primitives.new(**fields.zip(interpreted).to_h)
  check(call(:array_check_elements, *interpreted.map { |value| [value] }))
  check(call(:record_inspect, record))
  (1...fields.length).each do |index|
    changed = interpreted.dup
    changed[index] = CASES[index][1].find { |value| value != interpreted[index] }
    check(!call(:array_check_elements, *changed.map { |value| [value] }))
    check(!call(:record_inspect, API::Primitives.new(**fields.zip(changed).to_h)))
  end
  same(call(:array_add, 7, [[-HUGE, HUGE], []]), [[-HUGE + 7, HUGE + 7], []])
  same(call(:array_total, [[HUGE, 1], [], [HUGE]]), 2 * HUGE + 1)
  same(call(:array_total, []), 0)
  same(call(:array_words), [["\uFEFFLean", "🌱\0"], []])
  same(call(:array_size, [API::UNIT, API::UNIT]), 2); same(call(:array_size, []), 0)
  same(call(:record_empty, API::Empty.new), API::Empty.new)
  same(call(:record_single, API::Single.new(value: (1 << 64) - 1)), API::Single.new(value: 0))
  same(call(:record_count, API::Count.new(value: HUGE)), API::Count.new(value: HUGE + 1))
  same(call(:record_make), API::Pair.new(first: 42, second: "\uFEFF🌱\0"))
  32.times do |index|
    packet = API::Packet.new(label: +"parcel\0", values: [[record], [], [record, record]], empty: API::Empty.new,
      single: API::Single.new(value: (1 << 64) - 1), count: API::Count.new(value: HUGE),
      pair: API::Pair.new(first: (1 << 32) - 1, second: "a"), reversed: API::Reversed.new(second: "b", first: index))
    out = call(:record_shuffle, packet)
    expected = API::Packet.new(label: "parcel\0!", values: [[record, record], [], [record]], empty: API::Empty.new,
      single: API::Single.new(value: 0), count: API::Count.new(value: HUGE + 7),
      pair: API::Pair.new(first: 0, second: "ap"), reversed: API::Reversed.new(second: "br", first: index + 2))
    same(out, expected)
    copies = call(:record_duplicate, packet); same(copies, [packet, packet])
    copies[0].values[0][0].bytes.setbyte(0, 7)
    same(copies[1], packet)
    packet.label.replace("changed"); packet.values[0][0] = primitive(1)
    same(out, expected)
  end
  original = "\0\xff".b; copies = call(:array_duplicate, [original]); same(copies, [original, original])
  copies[0].setbyte(0, 7); same(copies[1], original)
  shared = [1, 2]; result = call(:array_reverse_uint32, [shared, shared]); result[0][0] = 7
  same(result[1], [2, 1]); same(shared, [1, 2])
  (0..24).each do |depth|
    value = depth == 24 ? 42 : []; depth.times { value = [value] }
    same(call(:deep, value), value)
  end
  cycle = []; cycle << cycle; rejects(TypeError) { call(:deep, cycle) }
  rejects(TypeError) { call(:record_inspect, record.class.allocate) }
  rejects(TypeError) { call(:record_inspect, {}) }
  rejects(TypeError) { call(:record_inspect, Class.new(API::Primitives).new(**fields.zip(interpreted).to_h)) }
  rejects(FrozenError) { record.instance_variable_set(:@flag, false) }
  3.times do
    rejects(RangeError) { call(:array_reverse_bytes, [["x" * (16 * 1024 * 1024)]]) }
    rejects(RangeError) { call(:array_reverse_uint32, [[0] * 2_097_153]) }
    rejects(RangeError) { call(:array_duplicate, ["x" * (6 * 1024 * 1024)]) }
    rejects(RangeError) { call(:generate, 17 * 1024 * 1024) }
  end
  same(call(:generate, 30000), [API::UNIT] * 30000)

  # Builtin values retain their contents even when ordinary methods are overridden.
  text = +"abc"
  def text.bytesize; 1; end
  def text.length; 1; end
  def text.instance_of?(_); false; end
  same(call(:array_reverse_string, [[text]]), [["abc"]])
  values = [1, 2]
  def values.length; 1; end
  def values.[](_); 9; end
  def values.instance_of?(_); false; end
  same(call(:array_reverse_uint32, [values]), [[2, 1]])
  impostor = Object.new
  def impostor.instance_of?(_); true; end
  rejects(TypeError) { call(:array_reverse_uint32, impostor) }

  # Generated records provide ordinary deep value comparison and key patterns.
  a = API::Pair.new(first: 42, second: +"value")
  b = API::Pair.new(first: 42, second: +"value")
  check(a == b && a.eql?(b) && a.hash == b.hash)
  check({a => 7}.fetch(b) == 7)
  check(a.deconstruct_keys(nil) == {first: 42, second: "value"})
  check(a != API::Reversed.new(second: "value", first: 42))
  GC.start; GC.compact
  4.times.map { |thread| Thread.new { 64.times do |index|
    same(call(:array_reverse_uint32, [[thread, index], [], [index]]), [[index], [], [index, thread]])
  end } }.each(&:value)
  root = Gem.loaded_specs.fetch("collections-api").full_gem_path
  libraries = File.read("/proc/self/maps").lines.filter_map do |line|
    path = line.split.last
    path if path&.start_with?(root + "/") && path.end_with?(".so")
  end.uniq.sort.to_h { |path| [path.delete_prefix(root + "/"), Digest::SHA256.file(path).hexdigest] }
  check(libraries.length == 4)
  api = $LOADED_FEATURES.find { |path| path.end_with?("/lib/lean_bridge/collections.rb") }
  puts JSON.generate(checks: $checks, calls: $calls, rejected: $rejected, primitives: primitives,
    record_types: FIELDS.keys.map(&:name), ruby: RUBY_DESCRIPTION, gem_root: root, api: api, native_libraries: libraries)
end
