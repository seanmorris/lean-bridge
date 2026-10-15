# Synthetic caller controls only. No Lean compilation or installed acceptance.
require "json"
raise "expected caller path and optional generated values" unless [1, 2].include?(ARGV.length)
load ARGV.fetch(0)
if ARGV.length == 2
  source = File.read(ARGV.fetch(1), encoding: "UTF-8")
  require_line = 'require_relative "nominalprimitivesubtypes/native"' + "\n"
  private_line = 'LeanBridge::Nominalprimitivesubtypes.private_constant :Native' + "\n"
  raise "unexpected generated loader boundary" unless source.scan(require_line).length == 1 && source.scan(private_line).length == 1
  eval(source.sub(require_line, "").sub(private_line, ""), TOPLEVEL_BINDING, ARGV.fetch(1))
  GENERATED_PRIMITIVE_VALUES = LeanBridge::Nominalprimitivesubtypes
end

PRIMITIVE_FIELDS = [:unit_value, :bool_value, :uint8_value, :uint16_value, :uint32_value,
                    :uint64_value, :int8_value, :int16_value, :int32_value, :int64_value,
                    :nat_value, :int_value, :float32_value, :float64_value, :text_value,
                    :bytes_value, :char_value, :usize_value, :isize_value, :digit].freeze
PRIMITIVE_WIDTHS = {uint8_value: [8, false], uint16_value: [16, false], uint32_value: [32, false],
                    uint64_value: [64, false], int8_value: [8, true], int16_value: [16, true],
                    int32_value: [32, true], int64_value: [64, true],
                    usize_value: [64, false], isize_value: [64, true]}.freeze
PRIMITIVE_NUMBERS = (PRIMITIVE_WIDTHS.keys + [:nat_value, :int_value]).freeze

def primitive_record(owner, name, fields, parent = Object)
  owner.const_set(name, Class.new(parent) do
    attr_reader(*fields)
    define_method(:initialize) do |**values|
      raise "unexpected constructor fields" unless values.keys.sort == fields.sort
      fields.each { |field| instance_variable_set(:"@#{field}", values.fetch(field)) }
      freeze
    end
  end)
end

def primitive_model(result_only = false, prefix = "arg")
  api = Module.new
  if defined?(GENERATED_PRIMITIVE_VALUES)
    [:UNIT, :Packet, :RawPacket, :Pair, :Some, :Ok, :Err, :Event].each do |name|
      api.const_set(name, GENERATED_PRIMITIVE_VALUES.const_get(name))
    end
    packet, pair = [:Packet, :Pair].map { |name| api.const_get(name) }
    some, ok, err = [:Some, :Ok, :Err].map { |name| api.const_get(name) }
    empty, box, choices = [:Empty, :Box, :Choices].map { |name| api.const_get(:Event).const_get(name) }
  else
    api.const_set(:UNIT, Object.new.freeze)
    packet = primitive_record(api, :Packet, PRIMITIVE_FIELDS)
    primitive_record(api, :RawPacket, PRIMITIVE_FIELDS)
    pair = primitive_record(api, :Pair, [:left, :right])
    some, ok, err = [:Some, :Ok, :Err].map { |name| api.const_set(name, Data.define(:value)) }
    event = api.const_set(:Event, Class.new)
    empty = primitive_record(event, :Empty, [], event)
    box = primitive_record(event, :Box, [:value], event)
    choices = primitive_record(event, :Choices, [:values], event)
  end
  values = ->(item) { PRIMITIVE_FIELDS.to_h { |field| [field, item.instance_variable_get(:"@#{field}")] } }
  valid = lambda do |item|
    item.bool_value.equal?(true) && PRIMITIVE_NUMBERS.all? { |field| item.public_send(field).even? } &&
      item.float32_value.finite? && item.float64_value.finite? &&
      !item.text_value.empty? && !item.bytes_value.empty? && item.char_value != "\0" && item.digit < 3
  end
  project = lambda do |item|
    fields = values.call(item).transform_values { |value| value.instance_of?(String) ? value.dup : value }
    packet.new(**fields)
  end
  group_result = ->(item) { valid.call(item) ? [nil, some.new(project.call(item))] : [nil] }
  api.define_singleton_method(:word_bits) { 64 }
  api.define_singleton_method(:produce) { |item| valid.call(item) ? some.new(project.call(item)) : nil }
  api.define_singleton_method(:produce_group, &group_result)
  api.define_singleton_method(:produce_pair) { |item| pair.new(left: group_result.call(item), right: group_result.call(item)) }
  api.define_singleton_method(:produce_event) { |item| valid.call(item) ? box.new(value: project.call(item)) : empty.new }
  api.define_singleton_method(:produce_choices) do |item|
    choices.new(values: valid.call(item) ? [nil, some.new(ok.new(project.call(item))), some.new(err.new(project.call(item)))] : [nil])
  end
  return api if result_only

  fin = lambda do |item, path|
    if item.instance_of?(packet)
      raise RangeError, "#{path}.digit is not below its Fin 3 bound" if item.digit >= 3
    elsif item.instance_of?(Array)
      item.each_with_index { |value, index| fin.call(value, "#{path}[#{index}]") }
    elsif item.instance_of?(pair)
      fin.call(item.left, path + ".left"); fin.call(item.right, path + ".right")
    elsif item.instance_of?(some)
      fin.call(item.value, path + "?")
    elsif item.instance_of?(ok) || item.instance_of?(err)
      fin.call(item.value, path + (item.instance_of?(ok) ? ".ok" : ".error"))
    elsif item.instance_of?(box)
      fin.call(item.value, path + ".box.value")
    elsif item.instance_of?(choices)
      fin.call(item.values, path + ".choices.values")
    end
  end
  convert = lambda do |item, choice, path|
    fields = values.call(item)
    if choice == "B"
      fields[:bool_value] = !fields[:bool_value]
      PRIMITIVE_NUMBERS.each do |field|
        value = fields[field] + 2
        if PRIMITIVE_WIDTHS.key?(field)
          bits, signed = PRIMITIVE_WIDTHS.fetch(field)
          value %= 2**bits
          value -= 2**bits if signed && value >= 2**(bits - 1)
        end
        fields[field] = value
      end
      fields[:float32_value] = -fields[:float32_value]
      fields[:float64_value] = -fields[:float64_value]
      fields[:text_value] += "!"
      fields[:bytes_value] += "\xff".b
      fields[:char_value] = "b" if fields[:char_value] == "a"
    end
    PRIMITIVE_FIELDS[0...-1].each do |field|
      value = fields.fetch(field)
      accepted = case field
      when :unit_value then value.equal?(api.const_get(:UNIT))
      when :bool_value then value.equal?(true)
      when *PRIMITIVE_NUMBERS then value.even?
      when :float32_value, :float64_value then value.finite?
      when :text_value, :bytes_value then !value.empty?
      when :char_value then value != "\0"
      end
      if choice == "A"
        accepted &&= if PRIMITIVE_NUMBERS.include?(field)
          value < 100
        elsif [:float32_value, :float64_value].include?(field)
          value < 10
        elsif field == :text_value
          value.length < 8
        elsif field == :bytes_value
          value.bytesize < 8
        elsif field == :char_value
          value.ord < 128
        else
          true
        end
      end
      unless accepted
        constructor = field.to_s.sub(/_value\z/, "") + choice
        diagnostic = field.to_s.sub(/_value\z/, "Value")
        raise RangeError, "#{path}.#{diagnostic} was rejected by NominalPrimitiveSubtypes.#{constructor}"
      end
    end
    packet.new(**fields.transform_values { |value| value.instance_of?(String) ? value.dup : value })
  end
  checked = lambda do |name, &function|
    api.define_singleton_method(name) do |*args|
      args.each_with_index { |item, index| fin.call(item, prefix + index.to_s) }
      function.call(*args)
    end
  end
  group = lambda do |items, choice, path|
    items.each_with_index.map { |item, index| item.nil? ? nil : some.new(convert.call(item.value, choice, "#{path}[#{index}]?")) }
  end
  checked.call(:echo_a) { |item| convert.call(item, "A", prefix + "0") }
  checked.call(:echo_b) { |item| convert.call(item, "B", prefix + "0") }
  checked.call(:refuse_unit) { |_item| raise RangeError, "#{prefix}0.unitValue was rejected by NominalPrimitiveSubtypes.unitReject" }
  checked.call(:combine) { |left, right| [convert.call(left, "A", prefix + "0"), convert.call(right, "B", prefix + "1")] }
  checked.call(:aliases) { |left, right| group.call(left, "A", prefix + "0") + group.call(right, "B", prefix + "1") }
  checked.call(:echo_pair) do |item|
    pair.new(left: group.call(item.left, "A", prefix + "0.left"), right: group.call(item.right, "B", prefix + "0.right"))
  end
  {echo_event_a: ["A", "B"], echo_event_b: ["B", "A"]}.each do |name, (first, second)|
    checked.call(name) do |item|
      if item.instance_of?(empty)
        empty.new
      elsif item.instance_of?(box)
        box.new(value: convert.call(item.value, first, prefix + "0.box.value"))
      else
        selected = item.values.each_with_index.map do |value, index|
          next nil if value.nil?
          success = value.value.instance_of?(ok)
          path = "#{prefix}0.choices.values[#{index}]?.#{success ? 'ok' : 'error'}"
          some.new((success ? ok : err).new(convert.call(value.value.value, success ? first : second, path)))
        end
        choices.new(values: selected)
      end
    end
  end
  api
end

results = []
[false, true].each do |result_only|
  ["arg", "value"].each do |prefix|
    actual = check_nominal_primitive_subtypes(primitive_model(result_only, prefix), result_only, 256, prefix)
    expected = {checks: result_only ? 875 : 1664, rejections: result_only ? 0 : 306,
                snapshotControls: 12, rounds: 256, wordBits: 64}
    raise "wrong baseline: #{actual.inspect}" unless actual == expected
    results << actual.merge(resultOnly: result_only, parameterPrefix: prefix)
  end
end
detected = []
reject_mutation = lambda do |label, expected_failure, &mutate|
  api = primitive_model
  mutate.call(api)
  begin
    check_nominal_primitive_subtypes(api, false, 1)
  rescue RuntimeError => error
    raise "wrong failure for #{label}: #{error.message}" unless error.message.include?(expected_failure)
    detected << label
  else
    raise "undetected mutation: #{label}"
  end
end
PRIMITIVE_FIELDS.each do |field|
  reject_mutation.call("field-#{field}", "echo_a exact result") do |api|
    original = api.method(:echo_a)
    api.define_singleton_method(:echo_a) do |item|
      output = original.call(item)
      values = PRIMITIVE_FIELDS.to_h { |name| [name, output.public_send(name)] }
      values[field] = "wrong"
      api.const_get(:Packet).new(**values)
    end
  end
end
reject_mutation.call("word-width", "word_bits exact result") { |api| api.define_singleton_method(:word_bits) { 32 } }
reject_mutation.call("normalization-bypass", "echo_b exact result") { |api| api.define_singleton_method(:echo_b) { |item| item } }
reject_mutation.call("unit-refusal-bypass", "accepted invalid input") { |api| api.define_singleton_method(:refuse_unit) { |item| item } }
reject_mutation.call("result-event-tag", "produce_event exact result") do |api|
  api.define_singleton_method(:produce_event) { |_item| api.const_get(:Event).const_get(:Empty).new }
end
reject_mutation.call("input-output-alias", "echo_a copied strings and arrays do not alias inputs") do |api|
  original = api.method(:echo_a)
  api.define_singleton_method(:echo_a) { |item| original.call(item); item }
end
reject_mutation.call("generated-equality-bypass", "produce exact result") do |api|
  record = api.const_get(:Packet)
  record.define_method(:==) { |_other| true }
  original = api.method(:produce)
  api.define_singleton_method(:produce) do |item|
    output = original.call(item)
    next output if output.nil?
    values = PRIMITIVE_FIELDS.to_h { |name| [name, output.value.public_send(name)] }
    values[:nat_value] &= (2**64 - 1)
    api.const_get(:Some).new(record.new(**values))
  end
end
[:left, :right].each do |side|
  reject_mutation.call("rejected-input-#{side}", "echo_pair refused inputs unchanged") do |api|
    original = api.method(:echo_pair)
    api.define_singleton_method(:echo_pair) do |item|
      index = item.right.index { |value| !value.nil? && value.value.nat_value == 43 }
      unless index.nil?
        item.public_send(side).clear
        raise RangeError, "arg0.right[#{index}]?.natValue was rejected by NominalPrimitiveSubtypes.natB"
      end
      original.call(item)
    end
  end
end
[:echo_event_a, :echo_event_b].each do |name|
  [:box, :ok, :error].each do |branch|
    reject_mutation.call("variant-refusal-#{name}-#{branch}", "accepted invalid input: arg0.") do |api|
      original = api.method(name)
      box = api.const_get(:Event).const_get(:Box)
      choices = api.const_get(:Event).const_get(:Choices)
      wrapper = api.const_get(branch == :ok ? :Ok : :Err)
      api.define_singleton_method(name) do |item|
        selected = if branch == :box && item.instance_of?(box)
          item.value
        elsif branch != :box && item.instance_of?(choices)
          item.values.filter_map { |entry| entry.value.value if !entry.nil? && entry.value.instance_of?(wrapper) }
                     .find { |value| value.nat_value == 43 }
        end
        selected && selected.nat_value == 43 ? item : original.call(item)
      end
    end
  end
  reject_mutation.call("variant-refused-input-#{name}", "#{name} refused inputs unchanged") do |api|
    original = api.method(name)
    choices = api.const_get(:Event).const_get(:Choices)
    api.define_singleton_method(name) do |item|
      begin
        original.call(item)
      rescue RangeError
        item.values.clear if item.instance_of?(choices)
        raise
      end
    end
  end
end
strict_values = {uint8_value: 100, uint16_value: 100, uint32_value: 100, uint64_value: 100,
                 int8_value: 100, int16_value: 100, int32_value: 100, int64_value: 100,
                 nat_value: 100, int_value: 100, float32_value: 12.5, float64_value: 12.5,
                 text_value: "long λ text", bytes_value: (0..7).to_a.pack("C*"),
                 char_value: "λ", usize_value: 100, isize_value: 100}
strict_values.each do |field, value|
  diagnostic = field.to_s.sub(/_value\z/, "Value")
  reject_mutation.call("weak-predicate-instead-of-constructor-#{field}", "accepted invalid input: arg0.#{diagnostic}") do |api|
    original = api.method(:echo_a)
    api.define_singleton_method(:echo_a) { |item| item.public_send(field) == value ? item : original.call(item) }
  end
end
raise "wrong mutation count" unless detected.length == 53
puts JSON.generate(results: results, rejectedMutations: detected,
                   generatedValueClasses: !!defined?(GENERATED_PRIMITIVE_VALUES), installedAcceptance: false)
