# Synthetic caller controls only. This file does not execute Lean or install a gem.
require "json"
load ARGV.fetch(0)
PREFIX = ARGV.fetch(1)

def make_api
  api = Module.new
  some, ok, err = [:Some, :Ok, :Err].map { |name| api.const_set(name, Data.define(:value)) }
  arg = PREFIX + "0"
  refusal = ->(path, constructor) { raise RangeError, "#{path} was rejected by StructuralSubtypes.#{constructor}" }
  positive = lambda do |value, path, normalize = false|
    refusal.call(path, normalize ? "normalizePositive" : "checkedPositive") if value <= 0
    value + (normalize ? 1 : 0)
  end
  word = lambda do |value, path|
    refusal.call(path, "checkedWord") if value.empty?
    value
  end
  bound = lambda do |value, path, limit|
    raise RangeError, "#{path} is not below its Fin #{limit} bound" if value >= limit
  end
  group = lambda do |values, path, normalize = false|
    values.each_with_index.map { |item, i| item.nil? ? nil : some.new(positive.call(item.value, "#{path}[#{i}]?", normalize)) }
  end
  api.define_singleton_method(:scalar) { |value| positive.call(value, arg) }
  [:arrays, :lists, :specialized].each do |name|
    api.define_singleton_method(name) { |values| values.each_with_index.map { |value, i| positive.call(value, "#{arg}[#{i}]") } }
  end
  api.define_singleton_method(:options) { |value| value.nil? ? nil : some.new(positive.call(value.value, arg + "?")) }
  api.define_singleton_method(:product) { |value| [positive.call(value[0], arg + ".0"), word.call(value[1], arg + ".1")] }
  api.define_singleton_method(:branch) { |value| value.instance_of?(ok) ? ok.new(positive.call(value.value, arg + ".ok")) : err.new(word.call(value.value, arg + ".error")) }
  api.define_singleton_method(:byte_branches) do |values|
    values.each_with_index.map do |value, i|
      next nil if value.nil?
      byte, nat = value.value
      refusal.call("#{arg}[#{i}]?.0", "checkedByte") if byte == 0
      some.new([byte, positive.call(nat, "#{arg}[#{i}]?.1")])
    end
  end
  api.define_singleton_method(:nested) do |rows|
    rows.each_with_index { |row, i| row.each_with_index { |value, j| bound.call(value.value[1], "#{arg}[#{i}][#{j}]?.1", 184467440737095516170) unless value.nil? } }
    rows.each_with_index { |row, i| row.each_with_index { |value, j| positive.call(value.value[0], "#{arg}[#{i}][#{j}]?.0") unless value.nil? } }
    rows.length
  end
  api.define_singleton_method(:plain_fin) do |values|
    values.each_with_index { |value, i| bound.call(value.value, "#{arg}[#{i}]?", 10) unless value.nil? }
    values.length
  end
  api.define_singleton_method(:alias_pair) { |pair| [group.call(pair[0], arg + ".0"), group.call(pair[1], arg + ".1", true)] }
  api.define_singleton_method(:alias_arguments) { |left, right| group.call(left, arg) + group.call(right, PREFIX + "1", true) }
  api
end

expected = {checks: 4119, rejections: 1042, snapshotControls: 6}
raise "wrong baseline" unless check_structural_subtypes(make_api) == expected
mutations = [
  [:scalar, ->(value) { value }],
  [:arrays, ->(values) { values }],
  [:product, ->(pair) { [pair[0], pair[1].split("\0")[0]] }],
  [:alias_pair, ->(pair) { pair }],
  [:nested, ->(rows) { rows.length }],
  [:branch, ->(value) { value }]
]
controls = 0
mutations.each do |name, replacement|
  api = make_api
  api.define_singleton_method(name, &replacement)
  detected = false
  begin
    check_structural_subtypes(api)
  rescue RuntimeError
    detected = true
  end
  raise "undetected mutant: #{name}" unless detected
  controls += 1
end
2.times do |position|
  api = make_api
  original_call = api.method(:alias_arguments)
  api.define_singleton_method(:alias_arguments) do |left, right|
    index = right.index { |value| !value.nil? && value.value == 0 }
    if index
      [left, right][position][0] = api.const_get(:Some).new(999)
      raise RangeError, "#{PREFIX}1[#{index}]? was rejected by StructuralSubtypes.normalizePositive"
    end
    original_call.call(left, right)
  end
  detected = false
  begin
    check_structural_subtypes(api)
  rescue RuntimeError
    detected = true
  end
  raise "undetected input mutation: #{position}" unless detected
  controls += 1
end
puts JSON.generate(expected.merge(callerMutationControls: controls))
