# Synthetic caller controls only. No Lean compilation or installed acceptance.
require "json"
load ARGV.fetch(0)
PREFIX = ARGV.fetch(1)
RESULT_ONLY = ARGV.fetch(2) == "result-only"

def nominal_record(owner, name, fields, parent = Object)
  owner.const_set(name, Class.new(parent) do
    attr_reader(*fields)
    define_method(:initialize) do |**values|
      raise "unexpected constructor fields" unless values.keys.sort == fields.sort
      fields.each { |field| instance_variable_set(:"@#{field}", values.fetch(field)) }
      freeze
    end
  end)
end

def make_api
  api = Module.new
  some, ok, err = [:Some, :Ok, :Err].map { |name| api.const_set(name, Data.define(:value)) }
  envelope = nominal_record(api, :Envelope, [:payload, :digit])
  pair = nominal_record(api, :Pair, [:left, :right]) unless RESULT_ONLY
  alias_pair = nominal_record(api, :AliasPair, [:left, :right])
  event = api.const_set(:Event, Class.new)
  empty = nominal_record(event, :Empty, [], event)
  box = nominal_record(event, :Box, [:value], event)
  choices = nominal_record(event, :Choices, [:values], event)
  wrap = ->(value, digit = 2) { envelope.new(payload: value, digit: digit) }
  values = ->(value) { [nil, some.new(wrap.call(value + 1))] }
  api.define_singleton_method(:scalar) { |value| value + 1 }
  api.define_singleton_method(:produce_envelope) { |value| wrap.call(value + 1) }
  [:array_values, :list_values, :product].each do |name|
    api.define_singleton_method(name) { |value| [value + 1, value + 2] }
  end
  api.define_singleton_method(:optional) { |value| value.zero? ? nil : some.new(value + 1) }
  api.define_singleton_method(:branch) { |value| value.zero? ? err.new(value + 1) : ok.new(value + 1) }
  api.define_singleton_method(:group_values) { |value| values.call(value) }
  api.define_singleton_method(:pair_values) { |value| alias_pair.new(left: values.call(value), right: values.call(value + 1)) }
  api.define_singleton_method(:event_value) { |value| box.new(value: wrap.call(value + 1)) }
  api.define_singleton_method(:event_empty) { |_value| empty.new }
  api.define_singleton_method(:event_choices) { |value| choices.new(values: [nil, some.new(ok.new(value + 1)), some.new(err.new(value + 2))]) }
  api.define_singleton_method(:no_items) { |_value| [] }
  return api if RESULT_ONLY

  first, second = PREFIX + "0", PREFIX + "1"
  fin = lambda do |value, path|
    raise RangeError, "#{path} is not below its Fin 3 bound" if value >= 3
  end
  check_envelope = ->(value, path) { fin.call(value.digit, path + ".digit") }
  check_group = lambda do |items, path|
    items.each_with_index { |item, index| check_envelope.call(item.value, "#{path}[#{index}]?") unless item.nil? }
  end
  normalize = lambda do |value, path, amount|
    constructor, limit = amount == 1 ? ["plusOne", 100] : ["plusTwo", 90]
    raise RangeError, "#{path} was rejected by NominalSubtypes.#{constructor}" if value >= limit
    value + amount
  end
  transform = ->(item, path, amount) { wrap.call(normalize.call(item.payload, path + ".payload", amount), item.digit) }
  transform_group = lambda do |items, path, amount|
    items.each_with_index.map { |item, index| item.nil? ? nil : some.new(transform.call(item.value, "#{path}[#{index}]?", amount)) }
  end
  [:first, :second, :echo].each do |name|
    api.define_singleton_method(name) do |item|
      check_envelope.call(item, first)
      result = transform.call(item, first, name == :second ? 2 : 1)
      name == :echo ? result : result.payload
    end
  end
  api.define_singleton_method(:combine) do |left, right|
    check_envelope.call(left, first); check_envelope.call(right, second)
    transform.call(left, first, 1).payload * 100 + transform.call(right, second, 2).payload
  end
  api.define_singleton_method(:nested) do |item|
    check_envelope.call(item.left, first + ".left"); check_envelope.call(item.right, first + ".right")
    transform.call(item.left, first + ".left", 1).payload * 100 + transform.call(item.right, first + ".right", 2).payload
  end
  group_sum = ->(items) { items.sum { |item| item.nil? ? 0 : item.value.payload } }
  api.define_singleton_method(:aliases) do |left, right|
    check_group.call(left, first); check_group.call(right, second)
    group_sum.call(transform_group.call(left, first, 1)) + group_sum.call(transform_group.call(right, second, 2))
  end
  [:inspect_alias_pair, :echo_pair].each do |name|
    api.define_singleton_method(name) do |item|
      check_group.call(item.left, first + ".left"); check_group.call(item.right, first + ".right")
      left = transform_group.call(item.left, first + ".left", 1)
      right = transform_group.call(item.right, first + ".right", 2)
      name == :echo_pair ? alias_pair.new(left: left, right: right) : group_sum.call(left) + group_sum.call(right)
    end
  end
  api.define_singleton_method(:echo_groups) do |items|
    check_group.call(items, first)
    transform_group.call(items, first, 1)
  end
  [:event_first, :event_second, :echo_event].each do |name|
    api.define_singleton_method(name) do |item|
      one, two = name == :event_second ? [2, 1] : [1, 2]
      if item.instance_of?(empty)
        name == :echo_event ? empty.new : 0
      elsif item.instance_of?(box)
        check_envelope.call(item.value, first + ".box.value")
        result = transform.call(item.value, first + ".box.value", one)
        name == :echo_event ? box.new(value: result) : result.payload
      else
        result = item.values.each_with_index.map do |value, index|
          next nil if value.nil?
          branch = value.value
          good = branch.instance_of?(ok)
          path = "#{first}.choices.values[#{index}]?.#{good ? 'ok' : 'error'}"
          some.new((good ? ok : err).new(normalize.call(branch.value, path, good ? one : two)))
        end
        name == :echo_event ? choices.new(values: result) : result.sum { |value| value.nil? ? 0 : value.value.value }
      end
    end
  end
  api.define_singleton_method(:plain_fin) { |value| fin.call(value, first); value }
  api
end

expected = RESULT_ONLY ? {checks: 2086, rejections: 0, snapshotControls: 8} : {checks: 4212, rejections: 1032, snapshotControls: 8}
raise "wrong baseline" unless check_nominal_subtypes(make_api, RESULT_ONLY) == expected
mutations = [
  [:scalar, ->(value) { value }],
  [:array_values, ->(value) { [value + 1] }],
  [:pair_values, ->(_value) { nil }],
  [:event_choices, ->(_value) { nil }],
  [:event_value, ->(_value) { nil }]
]
unless RESULT_ONLY
  mutations.concat([
    [:first, ->(value) { value.payload }],
    [:second, ->(value) { value.payload + 1 }],
    [:combine, ->(left, right) { left.payload * 100 + right.payload }],
    [:nested, ->(value) { value.left.payload + value.right.payload }],
    [:plain_fin, ->(value) { value }]
  ])
end
controls = 0
mutations.each do |name, replacement|
  api = make_api
  api.define_singleton_method(name, &replacement)
  detected = false
  begin
    check_nominal_subtypes(api, RESULT_ONLY)
  rescue RuntimeError
    detected = true
  end
  raise "undetected mutant: #{name}" unless detected
  controls += 1
end
[:produce_envelope, :event_choices, :pair_values].each do |name|
  api = make_api
  # A generated == that always succeeds must not conceal incorrect payloads.
  api.const_get(:Envelope).define_method(:==) { |_other| true }
  api.const_get(:AliasPair).define_method(:==) { |_other| true }
  original = api.method(name)
  api.define_singleton_method(name) do |value|
    result = original.call(value)
    case name
    when :produce_envelope
      api.const_get(:Envelope).new(payload: result.payload & ((1 << 64) - 1), digit: result.digit)
    when :event_choices
      bad = result.values.dup
      bad[2] = api.const_get(:Some).new(api.const_get(:Ok).new(bad[2].value.value))
      api.const_get(:Event).const_get(:Choices).new(values: bad)
    else
      api.const_get(:AliasPair).new(left: result.right, right: result.left)
    end
  end
  detected = false
  begin
    check_nominal_subtypes(api, RESULT_ONLY)
  rescue RuntimeError
    detected = true
  end
  raise "undetected payload mutant: #{name}" unless detected
  controls += 1
end
unless RESULT_ONLY
  [:left, :right].each do |side|
    api = make_api
    original = api.method(:echo_pair)
    api.define_singleton_method(:echo_pair) do |item|
      index = item.right.index { |value| !value.nil? && value.value.payload == 90 }
      if index
        item.public_send(side)[0] = api.const_get(:Some).new(api.const_get(:Envelope).new(payload: 777, digit: 2))
        raise RangeError, "#{PREFIX}0.right[#{index}]?.payload was rejected by NominalSubtypes.plusTwo"
      end
      original.call(item)
    end
    detected = false
    begin
      check_nominal_subtypes(api, false)
    rescue RuntimeError
      detected = true
    end
    raise "undetected #{side} input mutation" unless detected
    controls += 1
  end
end
puts JSON.generate(expected.merge(callerMutationControls: controls))
