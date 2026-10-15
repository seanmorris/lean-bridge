# Independent public Ruby checks. No generated equality or serialization oracle.
require "json"

def check_nominal_primitive_subtypes(api, result_only = false, rounds = 256, parameter_prefix = "arg")
  raise "invalid primitive caller options" unless [true, false].include?(result_only) && rounds.instance_of?(Integer) && rounds.between?(1, 1000)
  raise "invalid parameter prefix" unless ["arg", "value"].include?(parameter_prefix)
  checks = rejections = snapshot_controls = 0
  unit = api.const_get(:UNIT)
  packet_class, raw_class, pair_class = [:Packet, :RawPacket, :Pair].map { |name| api.const_get(name) }
  some, ok, err = [:Some, :Ok, :Err].map { |name| api.const_get(name) }
  empty, box, choices = [:Empty, :Box, :Choices].map { |name| api.const_get(:Event).const_get(name) }
  names = [:unit_value, :bool_value, :uint8_value, :uint16_value, :uint32_value,
           :uint64_value, :int8_value, :int16_value, :int32_value, :int64_value,
           :nat_value, :int_value, :float32_value, :float64_value, :text_value,
           :bytes_value, :char_value, :usize_value, :isize_value, :digit]
  fields = {packet_class => names, raw_class => names, pair_class => [:left, :right],
            empty => [], box => [:value], choices => [:values]}
  diagnostic_field = ->(name) { name.to_s.sub(/_value\z/, "Value") }
  snapshot = lambda do |value|
    kind = value.class
    if value.equal?(unit)
      [:unit, unit.object_id, unit.frozen?]
    elsif [NilClass, TrueClass, FalseClass, Integer].include?(kind)
      [kind, value]
    elsif kind == Float
      [Float, value.nan? ? :nan : [value].pack("G")]
    elsif kind == String
      [String, value.encoding.name, value.frozen?, value.bytes]
    elsif kind == Array
      [Array, value.frozen?, value.map { |item| snapshot.call(item) }]
    elsif [some, ok, err].include?(kind)
      raise "unexpected wrapper members" unless value.members == [:value]
      [kind, value.frozen?, snapshot.call(value.value)]
    elsif fields.key?(kind)
      members = fields.fetch(kind)
      raise "unexpected record fields" unless value.instance_variables.sort == members.map { |name| :"@#{name}" }.sort
      [kind, value.frozen?, members.map { |name| [name, snapshot.call(value.instance_variable_get(:"@#{name}"))] }]
    else
      raise "unexpected public value type: #{kind}"
    end
  end
  check = lambda do |condition, label|
    raise "failed: #{label}" unless condition
    checks += 1
  end
  copied_ids = lambda do |value|
    kind = value.class
    if kind == String
      [value.object_id]
    elsif kind == Array
      [value.object_id] + value.flat_map { |item| copied_ids.call(item) }
    elsif [some, ok, err].include?(kind)
      copied_ids.call(value.value)
    elsif fields.key?(kind)
      fields.fetch(kind).flat_map { |name| copied_ids.call(value.instance_variable_get(:"@#{name}")) }
    else
      []
    end
  end
  call = lambda do |name, args, expected|
    before = snapshot.call(args)
    result = api.public_send(name, *args)
    check.call(snapshot.call(result) == snapshot.call(expected), "#{name} exact result")
    check.call(snapshot.call(args) == before, "#{name} complete inputs unchanged")
    check.call((copied_ids.call(result) & copied_ids.call(args)).empty?, "#{name} copied strings and arrays do not alias inputs")
    result
  end
  refuse = lambda do |name, args, path, constructor = nil, bound = nil|
    before = snapshot.call(args)
    message = bound ? "#{path} is not below its Fin #{bound} bound" : "#{path} was rejected by NominalPrimitiveSubtypes.#{constructor}"
    begin
      api.public_send(name, *args)
      raise "accepted invalid input: #{message}"
    rescue RangeError => error
      check.call(error.instance_of?(RangeError) && error.message == message, "exact refusal: #{message}; got #{error.message}")
    end
    check.call(snapshot.call(args) == before, "#{name} refused inputs unchanged")
    rejections += 1
  end
  packet = lambda do |kind = packet_class, **changes|
    values = {unit_value: unit, bool_value: true, uint8_value: 42, uint16_value: 42,
              uint32_value: 42, uint64_value: 42, int8_value: -42, int16_value: -42,
              int32_value: -42, int64_value: -42, nat_value: 42, int_value: -42,
              float32_value: 1.5, float64_value: 1.5, text_value: "a",
              bytes_value: [0, 128, 255].pack("C*"), char_value: "a",
              usize_value: 42, isize_value: -42, digit: 2}
    kind.new(**values.merge(changes))
  end
  normalized = lambda do |**changes|
    packet.call(**{uint8_value: 44, uint16_value: 44, uint32_value: 44, uint64_value: 44,
                  int8_value: -40, int16_value: -40, int32_value: -40, int64_value: -40,
                  nat_value: 44, int_value: -40, float32_value: -1.5, float64_value: -1.5,
                  text_value: "a!", bytes_value: [0, 128, 255, 255].pack("C*"),
                  char_value: "b", usize_value: 44, isize_value: -40}.merge(changes))
  end
  produced = lambda do |kind = packet_class, **changes|
    packet.call(kind, **{uint8_value: 200, uint16_value: 200, uint32_value: 200, uint64_value: 200,
                        int8_value: 120, int16_value: 120, int32_value: 120, int64_value: 120,
                        nat_value: 2**100, int_value: -(2**100), float32_value: 12.5,
                        float64_value: 12.5, text_value: "long λ text",
                        bytes_value: [0, 1, 2, 3, 4, 5, 128, 254, 255].pack("C*"),
                        char_value: "λ", usize_value: 200, isize_value: 200}.merge(changes))
  end
  [:echo_a, :echo_b, :refuse_unit, :combine, :echo_pair, :echo_event_a, :echo_event_b, :aliases].each do |name|
    check.call(api.respond_to?(name) != result_only, "input export selection: #{name}")
  end
  a, b, n, out, raw_out = packet.call, packet.call(bool_value: false), normalized.call, produced.call, produced.call(raw_class)
  [[unit, nil], [false, 0], [0, 0.0], [0.0, -0.0], ["\x00".b, "\x01".b],
   ["a\0λ😀", "aλ😀"], [[nil, some.new(out)], [some.new(out), nil]],
   [box.new(value: out), choices.new(values: [some.new(ok.new(out))])],
   [packet.call, packet.call(raw_class)], ["abc".b, "abc"],
   ["abc", "abc".freeze], [[nil], [nil].freeze]].each do |left, right|
    check.call(snapshot.call(left) != snapshot.call(right), "independent snapshot mutation")
    snapshot_controls += 1
  end
  call.call(:word_bits, [], 64)
  group = [nil, some.new(out)]
  call.call(:produce, [raw_out], some.new(out))
  call.call(:produce_group, [raw_out], group)
  call.call(:produce_pair, [raw_out], pair_class.new(left: group, right: group))
  call.call(:produce_event, [raw_out], box.new(value: out))
  call.call(:produce_choices, [raw_out], choices.new(values: [nil, some.new(ok.new(out)), some.new(err.new(out))]))
  invalid = {bool_value: false, uint8_value: 43, uint16_value: 43, uint32_value: 43,
             uint64_value: 43, int8_value: -43, int16_value: -43, int32_value: -43,
             int64_value: -43, nat_value: 43, int_value: -43,
             float32_value: Float::INFINITY, float64_value: Float::INFINITY,
             text_value: "", bytes_value: "".b, char_value: "\0", usize_value: 43,
             isize_value: -43, digit: 3}
  constructors = {bool_value: "boolA", uint8_value: "uint8A", uint16_value: "uint16A",
                  uint32_value: "uint32A", uint64_value: "uint64A", int8_value: "int8A",
                  int16_value: "int16A", int32_value: "int32A", int64_value: "int64A",
                  nat_value: "natA", int_value: "intA", float32_value: "float32A",
                  float64_value: "float64A", text_value: "textA", bytes_value: "bytesA",
                  char_value: "charA", usize_value: "usizeA", isize_value: "isizeA"}
  invalid.each do |field, value|
    call.call(:produce, [packet.call(raw_class, **{field => value})], nil)
    unless result_only
      refuse.call(:echo_a, [packet.call(**{field => value})], parameter_prefix + "0." + diagnostic_field.call(field),
                  constructors[field], field == :digit ? 3 : nil)
    end
  end
  absent = packet.call(raw_class, nat_value: 43)
  call.call(:produce_group, [absent], [nil])
  call.call(:produce_pair, [absent], pair_class.new(left: [nil], right: [nil]))
  call.call(:produce_event, [absent], empty.new)
  call.call(:produce_choices, [absent], choices.new(values: [nil]))
  if result_only
    rounds.times do |round|
      value = 2**100 + round * 2
      call.call(:produce, [produced.call(raw_class, nat_value: value)], some.new(produced.call(nat_value: value)))
    end
    return {checks: checks, rejections: rejections, snapshotControls: snapshot_controls, rounds: rounds, wordBits: 64}
  end
  call.call(:echo_a, [a], a)
  call.call(:echo_b, [b], n)
  strict_values = {uint8_value: 100, uint16_value: 100, uint32_value: 100, uint64_value: 100,
                   int8_value: 100, int16_value: 100, int32_value: 100, int64_value: 100,
                   nat_value: 100, int_value: 100, float32_value: 12.5, float64_value: 12.5,
                   text_value: "long λ text", bytes_value: (0..7).to_a.pack("C*"),
                   char_value: "λ", usize_value: 100, isize_value: 100}
  strict_values.each do |field, value|
    call.call(:produce, [packet.call(raw_class, **{field => value})], some.new(packet.call(**{field => value})))
    refuse.call(:echo_a, [packet.call(**{field => value})], parameter_prefix + "0." + diagnostic_field.call(field), constructors.fetch(field))
  end
  refuse.call(:refuse_unit, [a], parameter_prefix + "0.unitValue", "unitReject")
  call.call(:combine, [a, b], [a, n])
  call.call(:echo_pair, [pair_class.new(left: [nil, some.new(a)], right: [some.new(b)])],
            pair_class.new(left: [nil, some.new(a)], right: [some.new(n)]))
  call.call(:aliases, [[nil, some.new(a)], [some.new(b), nil]], [nil, some.new(a), some.new(n), nil])
  [:echo_event_a, :echo_event_b].each { |name| call.call(name, [empty.new], empty.new) }
  call.call(:echo_event_a, [box.new(value: a)], box.new(value: a))
  call.call(:echo_event_b, [box.new(value: b)], box.new(value: n))
  call.call(:echo_event_a, [choices.new(values: [nil, some.new(ok.new(a)), some.new(err.new(b))])],
            choices.new(values: [nil, some.new(ok.new(a)), some.new(err.new(n))]))
  call.call(:echo_event_b, [choices.new(values: [nil, some.new(ok.new(b)), some.new(err.new(a))])],
            choices.new(values: [nil, some.new(ok.new(n)), some.new(err.new(a))]))
  [:echo_event_a, :echo_event_b].each_with_index do |name, second|
    first_input, last_input = second == 0 ? [a, b] : [b, a]
    first_output, last_output = second == 0 ? [a, n] : [n, a]
    invalid_box = box.new(value: packet.call(bool_value: first_input.bool_value, nat_value: 43))
    refuse.call(name, [invalid_box], parameter_prefix + "0.box.value.natValue", second == 0 ? "natA" : "natB")
    call.call(name, [box.new(value: first_input)], box.new(value: first_output))
    2.times do |branch|
      items = [nil, some.new(ok.new(first_input)), some.new(err.new(last_input))]
      selected = branch == 0 ? first_input : last_input
      invalid_packet = packet.call(bool_value: selected.bool_value, nat_value: 43)
      items[branch + 1] = some.new((branch == 0 ? ok : err).new(invalid_packet))
      refuse.call(name, [choices.new(values: items)],
                  "#{parameter_prefix}0.choices.values[#{branch + 1}]?.#{branch == 0 ? 'ok' : 'error'}.natValue",
                  second == branch ? "natA" : "natB")
      call.call(name, [choices.new(values: [nil, some.new(ok.new(first_input)), some.new(err.new(last_input))])],
                choices.new(values: [nil, some.new(ok.new(first_output)), some.new(err.new(last_output))]))
    end
  end
  [[:uint8_value, 254, 0], [:uint16_value, 65534, 0], [:uint32_value, 2**32 - 2, 0], [:uint64_value, 2**64 - 2, 0],
   [:int8_value, 126, -128], [:int16_value, 32766, -32768], [:int32_value, 2**31 - 2, -(2**31)],
   [:int64_value, 2**63 - 2, -(2**63)], [:usize_value, 2**64 - 2, 0], [:isize_value, 2**63 - 2, -(2**63)],
   [:nat_value, 2**100, 2**100 + 2], [:int_value, -(2**100), -(2**100) + 2],
   [:float32_value, 0.0, -0.0], [:float64_value, 0.0, -0.0], [:float32_value, -0.0, 0.0], [:float64_value, -0.0, 0.0],
   [:text_value, "a\0λ😀", "a\0λ😀!"], [:bytes_value, "".b, "\xff".b], [:char_value, "😀", "😀"]].each do |field, value, expected|
    call.call(:echo_b, [packet.call(bool_value: false, **{field => value})], normalized.call(**{field => expected}))
  end
  [[:float32_value, "float32B"], [:float64_value, "float64B"]].each do |field, constructor|
    [Float::NAN, Float::INFINITY, -Float::INFINITY].each do |value|
      refuse.call(:echo_b, [packet.call(bool_value: false, **{field => value})], parameter_prefix + "0." + diagnostic_field.call(field), constructor)
      call.call(:produce, [packet.call(raw_class, **{field => value})], nil)
    end
  end
  refuse.call(:combine, [packet.call(nat_value: 43), packet.call(bool_value: false, digit: 3)], parameter_prefix + "1.digit", nil, 3)
  rounds.times do |round|
    items = [some.new(b), nil, some.new(b)]
    items[round % 3] = some.new(packet.call(bool_value: false, nat_value: 43))
    refuse.call(:echo_pair, [pair_class.new(left: [some.new(a)], right: items)],
                "#{parameter_prefix}0.right[#{round % 3}]?.natValue", "natB")
    call.call(:echo_b, [b], n)
  end
  {checks: checks, rejections: rejections, snapshotControls: snapshot_controls, rounds: rounds, wordBits: 64}
end

if $PROGRAM_NAME == __FILE__
  allowed = [[], ["--result-only"], ["--reviewed"], ["--result-only", "--reviewed"]]
  abort "usage: consumer.rb [--result-only] [--reviewed]" unless allowed.include?(ARGV)
  require "lean_bridge/nominalprimitivesubtypes"
  puts JSON.generate(check_nominal_primitive_subtypes(LeanBridge::Nominalprimitivesubtypes,
                     ARGV.include?("--result-only"), 256, ARGV.include?("--reviewed") ? "value" : "arg"))
end
