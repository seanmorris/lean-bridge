# Independent consumer of only the installed public Ruby API.
require "json"
require "digest"
require "lean_bridge/variants"
module VariantConsumer
  extend self
  API = LeanBridge::Variants
  Signal, Mode, Nested, Scalars = API::Signal, API::Mode, API::Nested, API::Scalars
  Anonymous, One, Buffers = API::Anonymous, API::One, API::Buffers
  Some, Ok, Err = API::Some, API::Ok, API::Err
  FIELDS = {
    Signal::Idle => [], Signal::Stopped => [], Signal::Data => [:count, :label], Signal::Marker => [:value],
    Mode::First => [], Mode::Second => [], Mode::Third => [], Nested::Empty => [],
    Nested::Packet => [:value], Nested::Outcome => [:value], Scalars::Absent => [],
    Scalars::All => [:unit, :bool_, :u8, :u16, :u32, :u64, :i8, :i16, :i32, :i64,
      :natural, :integer, :f32, :f64, :text, :bytes, :char_, :word, :signed_word],
    Anonymous::Number => [:arg0], Anonymous::Pair => [:arg0, :arg1], Anonymous::Collision => [:arg1, :arg1_],
    One::Only => [:value], Buffers::Empty => [], Buffers::Pair => [:first, :second],
    API::Packet => [:current, :events, :fallback, :modes]
  }.freeze
  COUNTERS = Mutex.new
  $checks = $calls = $rejected = 0
  def check(value)
    COUNTERS.synchronize { $checks += 1 }
    raise "variant assertion" unless value
  end
  def call(name, *args)
    COUNTERS.synchronize { $calls += 1 }
    API.public_send(name, *args)
  end
  def same(actual, expected)
    check(actual.instance_of?(expected.class))
    if FIELDS.key?(expected.class)
      check(actual.frozen?)
      FIELDS.fetch(expected.class).each { |field| same(actual.public_send(field), expected.public_send(field)) }
    elsif expected.instance_of?(Array)
      check(actual.length == expected.length)
      actual.zip(expected).each { |left, right| same(left, right) }
    elsif [Some, Ok, Err].include?(expected.class)
      check(actual.frozen?); same(actual.value, expected.value)
    elsif expected.instance_of?(Float)
      check(expected.nan? ? actual.nan? : [actual].pack("E") == [expected].pack("E"))
    else
      check(actual == expected)
      check(actual.encoding == expected.encoding) if expected.instance_of?(String)
    end
  end
  def rejects(kind)
    failed = false
    begin; yield; rescue kind; failed = true; end
    check(failed); $rejected += 1
    same(call(:next, Signal::Idle.new), Signal::Stopped.new)
  end
  def describe(value)
    case value
    in Signal::Idle then "idle"
    in Signal::Stopped then "stopped"
    in Signal::Data(count:, label:) then "#{count}:#{label}"
    in Signal::Marker(value:) then value.equal?(API::UNIT) ? "marker" : raise("not Unit")
    else raise "unknown constructor"
    end
  end
  families = {Signal => %i[Idle Stopped Data Marker], Mode => %i[First Second Third],
    Nested => %i[Empty Packet Outcome], Scalars => %i[Absent All],
    Anonymous => %i[Number Pair Collision], One => %i[Only], Buffers => %i[Empty Pair]}
  families.each do |family, cases|
    check(family.constants(false).sort == cases.sort)
    rejects(NoMethodError) { family.new }
    cases.each do |name|
      constructor = family.const_get(name, false)
      check(constructor.superclass == family)
      check(constructor.instance_method(:initialize).parameters == FIELDS.fetch(constructor).map { |field| [:keyreq, field] })
    end
  end
  %i[echo echo_mode echo_nested echo_scalars echo_anonymous echo_one echo_buffers signals next code make inspect_scalars duplicate produce].each do |name|
    check(API.method(name).arity == 1)
  end
  scalar_fields = {unit: API::UNIT, bool_: true, u8: 255, u16: 65535, u32: (1 << 32) - 1, u64: (1 << 64) - 1,
    i8: -128, i16: -32768, i32: -(1 << 31), i64: -(1 << 63), natural: (1 << 5120) + 19,
    integer: -((1 << 5120) + 31), f32: 1.5, f64: -2.25, text: "A\0🌱", bytes: "\0\xff\1".b,
    char_: "🌱", word: (1 << 32) - 1, signed_word: -(1 << 31)}
  scalar = Scalars::All.new(**scalar_fields)
  check(call(:inspect_scalars, scalar))
  changed = {bool_: false, u8: 0, u16: 0, u32: 0, u64: 0, i8: 0, i16: 0, i32: 0, i64: 0,
    natural: 0, integer: 0, f32: 0.0, f64: 0.0, text: "", bytes: "".b, char_: "A", word: 0, signed_word: 0}
  changed.each { |field, value| check(!call(:inspect_scalars, Scalars::All.new(**scalar_fields.merge(field => value)))) }
  constructors = [Signal::Idle.new, Signal::Stopped.new, Signal::Data.new(count: 42, label: "A\0🌱"), Signal::Marker.new(value: API::UNIT)]
  128.times do |index|
    constructors.each do |value|
      result = call(:echo, value); same(result, value); check(!result.equal?(value))
      same(result.deconstruct_keys(nil), value.deconstruct_keys(nil)) if value.is_a?(Signal::Idle)
    end
    same(call(:next, constructors[0]), Signal::Stopped.new)
    same(call(:next, constructors[1]), Signal::Marker.new(value: API::UNIT))
    same(call(:next, constructors[2]), Signal::Data.new(count: 43, label: "A\0🌱!"))
    same(call(:next, constructors[3]), Signal::Data.new(count: 42, label: "ready"))
    constructors.zip([7, 13, 48, 29]).each { |value, code| same(call(:code, value), code) }
    [Mode::First.new, Mode::Second.new, Mode::Third.new].each { |value| same(call(:echo_mode, value), value) }
    events = constructors.dup
    packet = API::Packet.new(current: constructors[2], events: events, fallback: Some.new(constructors[3]), modes: [Mode::First.new, Mode::Third.new])
    result = call(:echo_nested, Nested::Packet.new(value: packet))
    same(result, Nested::Packet.new(value: packet))
    events[0] = Signal::Data.new(count: 99, label: "changed")
    same(result.value.events[0], Signal::Idle.new)
    packet = API::Packet.new(current: Signal::Idle.new, events: [], fallback: nil, modes: [])
    same(call(:echo_nested, Nested::Packet.new(value: packet)), Nested::Packet.new(value: packet))
    [Nested::Empty.new, Nested::Outcome.new(value: Ok.new([Signal::Marker.new(value: API::UNIT), Mode::Second.new])),
      Nested::Outcome.new(value: Err.new("A\0🌱"))].each { |value| same(call(:echo_nested, value), value) }
    same(call(:signals, [[], constructors, [constructors[2], constructors[2]]]), [[], constructors.reverse, [constructors[2], constructors[2]]])
    same(call(:echo_scalars, scalar), scalar); same(call(:echo_scalars, Scalars::Absent.new), Scalars::Absent.new)
    [Anonymous::Number.new(arg0: 13), Anonymous::Pair.new(arg0: 17, arg1: "A\0🌱"),
      Anonymous::Collision.new(arg1: 19, arg1_: "A\0🌱")].each { |value| same(call(:echo_anonymous, value), value) }
    same(call(:echo_one, One::Only.new(value: index)), One::Only.new(value: index + 1))
    [Buffers::Empty.new, Buffers::Pair.new(first: "".b, second: "".b),
      Buffers::Pair.new(first: "\0\xff".b, second: "abc".b)].each { |value| same(call(:echo_buffers, value), value) }
    same(call(:duplicate, "\0\xff\1".b), Buffers::Pair.new(first: "\0\xff\1".b, second: "\0\xff\1".b))
  end
  same(constructors.map { |value| describe(value) }, ["idle", "stopped", "42:A\0🌱", "marker"])
  same(constructors[2].deconstruct_keys([:count]), {count: 42, label: "A\0🌱"})
  [-0.0, Float::INFINITY, -Float::INFINITY, Float::NAN, 1.0 / 3, Float::MIN, -Float::MIN].each do |special|
    fields = scalar_fields.merge(f32: special, f64: special, word: (1 << 64) - 1, signed_word: -(1 << 63))
    expected = fields.merge(f32: [special].pack("e").unpack1("e"))
    same(call(:echo_scalars, Scalars::All.new(**fields)), Scalars::All.new(**expected))
  end
  [0, 0xd7ff, 0xe000, 0x10ffff].each do |code|
    value = Scalars::All.new(**scalar_fields.merge(char_: code.chr(Encoding::UTF_8)))
    same(call(:echo_scalars, value), value)
  end
  {u8: 8, u16: 16, u32: 32, u64: 64, word: 64}.each do |field, bits|
    [-1, 1 << bits].each { |bad| rejects(RangeError) { call(:echo_scalars, Scalars::All.new(**scalar_fields.merge(field => bad))) } }
    [true, 1.0].each { |bad| rejects(TypeError) { call(:echo_scalars, Scalars::All.new(**scalar_fields.merge(field => bad))) } }
  end
  {i8: 8, i16: 16, i32: 32, i64: 64, signed_word: 64}.each do |field, bits|
    [-(1 << (bits - 1)) - 1, 1 << (bits - 1)].each { |bad| rejects(RangeError) { call(:echo_scalars, Scalars::All.new(**scalar_fields.merge(field => bad))) } }
    [false, 1.0].each { |bad| rejects(TypeError) { call(:echo_scalars, Scalars::All.new(**scalar_fields.merge(field => bad))) } }
  end
  [[TypeError, :unit, nil], [TypeError, :bool_, 1], [RangeError, :natural, -1], [TypeError, :integer, true],
    [TypeError, :f32, 1], [TypeError, :f64, 2], [TypeError, :text, 7], [EncodingError, :text, "\xff".force_encoding("UTF-8")],
    [TypeError, :bytes, []], [RangeError, :char_, ""], [RangeError, :char_, "ab"],
    [EncodingError, :char_, "\xed\xa0\x80".force_encoding("UTF-8")]].each do |kind, field, value|
    rejects(kind) { call(:echo_scalars, Scalars::All.new(**scalar_fields.merge(field => value))) }
  end
  [nil, {}, {kind: :idle}, Mode::First.new, Signal::Marker.new(value: nil),
    Signal::Data.new(count: true, label: "x"), Signal::Data.new(count: 1, label: nil), Signal.allocate].each do |bad|
    rejects(TypeError) { call(:echo, bad) }
  end
  class FakeSignal < Signal::Data; end
  rejects(TypeError) { call(:echo, FakeSignal.new(count: 3, label: "fake")) }
  rejects(ArgumentError) { Signal::Data.new(count: 1) }
  rejects(ArgumentError) { Signal::Idle.new(value: API::UNIT) }
  rejects(FrozenError) { constructors[2].instance_variable_set(:@count, 3) }
  cycle = []; cycle << cycle; rejects(TypeError) { call(:signals, cycle) }
  3.times do
    rejects(RangeError) { call(:echo, Signal::Data.new(count: 0, label: "x" * (16 * 1024 * 1024 + 1))) }
    blob = "x".b * (8 * 1024 * 1024)
    rejects(RangeError) { call(:echo_buffers, Buffers::Pair.new(first: blob, second: blob)) }
    rejects(RangeError) { call(:produce, 17 * 1024 * 1024) }
  end
  same(call(:produce, 30000), Buffers::Pair.new(first: "\21".b * 30000, second: "\1".b))
  same(call(:make, 0), Signal::Idle.new); same(call(:make, 7), Signal::Data.new(count: 7, label: "made"))
  original = +"\0\xff".b; result = call(:duplicate, original)
  original.setbyte(0, 9); result.first.setbyte(1, 7)
  same(result.second, "\0\xff".b); same(original, "\11\xff".b)
  GC.start; GC.compact
  4.times.map { |thread| Thread.new { 64.times do |index|
    value = thread * 64 + index
    same(call(:next, Signal::Data.new(count: value, label: "thread")), Signal::Data.new(count: value + 1, label: "thread!"))
  end } }.each(&:value)
  root = Gem.loaded_specs.fetch("variants-api").full_gem_path
  libraries = File.read("/proc/self/maps").lines.filter_map { |line| path = line.split.last; path if path&.start_with?(root + "/") && path.end_with?(".so") }.uniq.sort
  check(libraries.length == 4)
  puts JSON.generate(checks: $checks, calls: $calls, rejected: $rejected, ruby: RUBY_DESCRIPTION,
    gem_root: root, api: API.method(:make).source_location.first,
    native_libraries: libraries.to_h { |path| [path.delete_prefix(root + "/"), Digest::SHA256.file(path).hexdigest] })
end
