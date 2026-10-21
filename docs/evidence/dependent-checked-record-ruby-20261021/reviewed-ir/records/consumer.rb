# frozen_string_literal: true

# Independent Ruby caller for a proof-erased dependent checked record.
require "json"

def check_dependent_records(api, result_only = false, parameter_prefix = "arg")
  unless [true, false].include?(result_only) && ["arg", "value"].include?(parameter_prefix)
    raise ArgumentError, "invalid dependent-record caller options"
  end

  checks = calls = rejections = recoveries = snapshots = 0
  dependent = api.const_get(:Dependent)
  snapshot = nil
  snapshot = lambda do |value|
    case value
    when nil, true, false, Integer, String
      [value.class.name, value]
    when Array
      ["Array", value.frozen?, value.map { |item| snapshot.call(item) }]
    else
      raise "unexpected public value type: #{value.class}" unless value.instance_of?(dependent)
      raise "unexpected dependent fields" unless value.instance_variables.sort == %i[@below @bound]
      ["Dependent", value.frozen?, %i[bound below].map do |name|
        [name, snapshot.call(value.instance_variable_get(:"@#{name}"))]
      end]
    end
  end
  check = lambda do |condition, label|
    raise "dependent-record assertion failed: #{label}" unless condition
    checks += 1
  end
  invoke = lambda do |name, arguments, expected, label|
    before = snapshot.call(arguments)
    calls += 1
    result = api.public_send(name, *arguments)
    check.call(snapshot.call(result) == snapshot.call(expected), "#{label} exact result")
    check.call(snapshot.call(arguments) == before, "#{label} preserves caller input")
    snapshots += 1
    result
  end
  refuse = lambda do |value, label|
    before = snapshot.call(value)
    calls += 1
    error = begin
      api.dependent_total(value)
      nil
    rescue StandardError => raised
      raised
    end
    raise "accepted invalid dependent record: #{label}" unless error
    expected = "#{parameter_prefix}0 was rejected by DependentRecords.mkDependent"
    check.call(error.instance_of?(RangeError) && error.message == expected,
               "#{label} exact checked-record refusal")
    check.call(true, "#{label} refuses invalid input")
    check.call(snapshot.call(value) == before, "#{label} preserves rejected input")
    rejections += 1
    snapshots += 1
  end

  check.call(api.respond_to?(:dependent_total) != result_only,
             "dependent_total export selection")
  check.call(api.respond_to?(:dependent_roundtrip) != result_only,
             "dependent_roundtrip export selection")
  check.call(api.respond_to?(:dependent_result),
             "dependent_result export selection")

  produced = lambda do |seed, label|
    calls += 1
    value = api.dependent_result(seed)
    check.call(snapshot.call(value) == snapshot.call(
      dependent.new(bound: seed + 1, below: seed)
    ), "#{label} exact result")
    snapshots += 1
  end
  512.times { |index| produced.call(index, "result #{index}") }
  huge = 1 << 130
  produced.call(huge, "huge result")

  unless result_only
    recover = lambda do
      invoke.call(:dependent_total, [dependent.new(bound: 2, below: 1)], 3, "recovery")
      recoveries += 1
    end

    invoke.call(:dependent_total, [dependent.new(bound: 3, below: 2)], 5, "valid total")
    refuse.call(dependent.new(bound: 2, below: 2), "equal fields")
    recover.call
    refuse.call(dependent.new(bound: 0, below: 0), "zero bound")
    recover.call
    valid = dependent.new(bound: 3, below: 2)
    invoke.call(:dependent_roundtrip, [valid], valid, "roundtrip")
    below = huge - 1
    invoke.call(:dependent_total, [dependent.new(bound: huge, below: below)],
                huge + below, "huge total")
    huge_record = dependent.new(bound: huge, below: below)
    invoke.call(:dependent_roundtrip, [huge_record], huge_record, "huge roundtrip")
    256.times do |index|
      bound = index + 1
      invoke.call(:dependent_total, [dependent.new(bound: bound, below: index)],
                  2 * index + 1, "loop total #{index}")
      refuse.call(dependent.new(bound: bound, below: bound), "loop refusal #{index}")
      recover.call
    end
  end

  expected = if result_only
               [513, 516, 0, 0, 513]
             else
               [1289, 2326, 258, 258, 1289]
             end
  unless [calls, checks, recoveries, rejections, snapshots] == expected
    raise "dependent-record exact caller totals"
  end
  { calls: calls, checks: checks, recoveries: recoveries,
    rejections: rejections, snapshots: snapshots }
end

if $PROGRAM_NAME == __FILE__
  allowed = [[], ["--result-only"], ["--reviewed"], ["--result-only", "--reviewed"]]
  abort "usage: ruby.rb [--result-only] [--reviewed]" unless allowed.include?(ARGV)
  require "lean_bridge/dependentrecords"
  puts JSON.generate(check_dependent_records(
    LeanBridge::Dependentrecords, ARGV.include?("--result-only"),
    ARGV.include?("--reviewed") ? "value" : "arg"
  ))
end
