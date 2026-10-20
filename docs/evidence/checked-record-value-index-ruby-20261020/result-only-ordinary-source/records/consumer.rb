# frozen_string_literal: true

# Independent Ruby caller for proof-erased checked records with closed value
# indices. It is deliberately package-agnostic: the installed gem only
# supplies the public namespace passed below.
require "json"

VALUE_INDEX_INPUTS = %i[
  true_bool_index false_bool_index ab_string_index empty_string_index
  unicode_string_index empty_sized_index zero_nat_index wide_nat_index
].freeze
VALUE_INDEX_RESULTS = %i[
  produce_true_bool produce_false_bool produce_ab produce_empty_string
  produce_unicode_string produce_empty_sized produce_zero_nat produce_wide_nat
].freeze

def check_value_index_records(api, result_only = false, parameter_prefix = "arg")
  unless [true, false].include?(result_only) && ["arg", "value"].include?(parameter_prefix)
    raise ArgumentError, "invalid value-index caller options"
  end

  checks = calls = rejections = recoveries = snapshots = 0
  classes = %i[On Off Ab EmptyToken UnicodeToken EmptySized ZeroToken WideToken]
            .to_h { |name| [name, api.const_get(name)] }
  field_names = {
    classes.fetch(:On) => %i[count], classes.fetch(:Off) => %i[count],
    classes.fetch(:Ab) => %i[size], classes.fetch(:EmptyToken) => %i[count],
    classes.fetch(:UnicodeToken) => %i[count], classes.fetch(:EmptySized) => %i[data],
    classes.fetch(:ZeroToken) => %i[count], classes.fetch(:WideToken) => %i[count]
  }

  snapshot = lambda do |value|
    case value
    when nil, true, false, Integer, String
      [value.class.name, value]
    when Array
      ["Array", value.frozen?, value.map { |item| snapshot.call(item) }]
    else
      fields = field_names[value.class]
      raise "unexpected public value type: #{value.class}" unless fields
      expected = fields.map { |name| :"@#{name}" }.sort
      raise "unexpected record fields: #{value.class}" unless value.instance_variables.sort == expected
      [value.class.name, value.frozen?, fields.map { |name| [name, snapshot.call(value.instance_variable_get(:"@#{name}"))] }]
    end
  end
  check = lambda do |condition, label|
    raise "value-index assertion failed: #{label}" unless condition
    checks += 1
  end
  invoke = lambda do |name, arguments, expected|
    before = snapshot.call(arguments)
    calls += 1
    result = api.public_send(name, *arguments)
    check.call(snapshot.call(result) == snapshot.call(expected), "#{name} exact result")
    check.call(snapshot.call(arguments) == before, "#{name} preserves caller input")
    snapshots += 1
    result
  end
  refused = lambda do |name, arguments, constructor, label|
    before = snapshot.call(arguments)
    calls += 1
    error = begin
      api.public_send(name, *arguments)
      nil
    rescue StandardError => raised
      raised
    end
    raise "accepted invalid value-index input: #{label}" unless error
    expected = "#{parameter_prefix}0 was rejected by CheckedRecordValueIndices.#{constructor}"
    check.call(error.instance_of?(RangeError) && error.message == expected,
               "#{label} checked-record refusal")
    check.call(snapshot.call(arguments) == before, "#{label} preserves rejected input")
    rejections += 1
    snapshots += 1
  end
  host_refused = lambda do |name, arguments, label|
    before = snapshot.call(arguments)
    calls += 1
    error = begin
      api.public_send(name, *arguments)
      nil
    rescue StandardError => raised
      raised
    end
    raise "accepted malformed value-index input: #{label}" unless error
    host_error = [TypeError, RangeError].include?(error.class)
    check.call(host_error && !error.message.start_with?("#{parameter_prefix}0 was rejected by"),
               "#{label} host refusal")
    check.call(snapshot.call(arguments) == before, "#{label} preserves rejected input")
    rejections += 1
    snapshots += 1
  end

  VALUE_INDEX_INPUTS.each do |name|
    check.call(api.respond_to?(name) != result_only, "input export selection: #{name}")
  end
  VALUE_INDEX_RESULTS.each do |name|
    check.call(api.respond_to?(name), "result export selection: #{name}")
  end

  on = ->(count) { classes.fetch(:On).new(count: count) }
  off = ->(count) { classes.fetch(:Off).new(count: count) }
  ab = ->(size) { classes.fetch(:Ab).new(size: size) }
  empty_token = ->(count) { classes.fetch(:EmptyToken).new(count: count) }
  unicode_token = ->(count) { classes.fetch(:UnicodeToken).new(count: count) }
  empty_sized = ->(data) { classes.fetch(:EmptySized).new(data: data) }
  zero_token = ->(count) { classes.fetch(:ZeroToken).new(count: count) }
  wide_token = ->(count) { classes.fetch(:WideToken).new(count: count) }
  huge = (1 << 128) + 1

  unless result_only
    invoke.call(:true_bool_index, [on.call(0)], 0)
    invoke.call(:false_bool_index, [off.call(1)], 1)
    invoke.call(:ab_string_index, [ab.call(2)], 2)
    invoke.call(:empty_string_index, [empty_token.call(9)], 9)
    invoke.call(:unicode_string_index, [unicode_token.call(10)], 10)
    invoke.call(:empty_sized_index, [empty_sized.call([])], 0)
    invoke.call(:zero_nat_index, [zero_token.call(11)], 11)
    invoke.call(:wide_nat_index, [wide_token.call(huge)], huge)
    refused.call(:ab_string_index, [ab.call(1)], "mkAb", "String index")
    invoke.call(:zero_nat_index, [zero_token.call(99)], 99); recoveries += 1
    refused.call(:empty_sized_index, [empty_sized.call([1])], "mkEmptySized", "Nat index")
    invoke.call(:zero_nat_index, [zero_token.call(99)], 99); recoveries += 1
    refused.call(:true_bool_index, [on.call(1)], "mkOn", "true Bool index")
    invoke.call(:zero_nat_index, [zero_token.call(99)], 99); recoveries += 1
    refused.call(:false_bool_index, [off.call(0)], "mkOff", "false Bool index")
    invoke.call(:zero_nat_index, [zero_token.call(99)], 99); recoveries += 1
    host_refused.call(:true_bool_index, [on.call(-1)], "negative true Nat")
    invoke.call(:zero_nat_index, [zero_token.call(99)], 99); recoveries += 1
    host_refused.call(:zero_nat_index, [zero_token.call(-1)], "negative token Nat")
    invoke.call(:zero_nat_index, [zero_token.call(99)], 99); recoveries += 1
  end

  produced = lambda do |name, arguments, expected|
    calls += 1
    check.call(snapshot.call(api.public_send(name, *arguments)) == snapshot.call(expected),
               "#{name} produced record")
  end
  produced.call(:produce_true_bool, [], on.call(0))
  produced.call(:produce_false_bool, [], off.call(1))
  produced.call(:produce_ab, [], ab.call(2))
  produced.call(:produce_empty_string, [23], empty_token.call(23))
  produced.call(:produce_unicode_string, [24], unicode_token.call(24))
  produced.call(:produce_empty_sized, [], empty_sized.call([]))
  produced.call(:produce_zero_nat, [25], zero_token.call(25))
  produced.call(:produce_wide_nat, [(1 << 100) + 17], wide_token.call((1 << 100) + 17))

  expected = result_only ? [8, 24, 0, 0, 0] : [28, 64, 6, 6, 20]
  check.call([calls, checks, recoveries, rejections, snapshots] == expected, "exact caller totals")
  { calls: calls, checks: checks, recoveries: recoveries, rejections: rejections, snapshots: snapshots }
end

if $PROGRAM_NAME == __FILE__
  allowed = [[], ["--result-only"], ["--reviewed"], ["--result-only", "--reviewed"]]
  abort "usage: ruby.rb [--result-only] [--reviewed]" unless allowed.include?(ARGV)
  require "lean_bridge/checkedrecordvalueindices"
  puts JSON.generate(check_value_index_records(
    LeanBridge::Checkedrecordvalueindices, ARGV.include?("--result-only"),
    ARGV.include?("--reviewed") ? "value" : "arg"
  ))
end
