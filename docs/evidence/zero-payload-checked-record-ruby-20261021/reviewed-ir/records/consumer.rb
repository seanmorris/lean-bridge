# frozen_string_literal: true

# Independent Ruby caller for proof-erased zero-payload checked records. It is
# deliberately package-agnostic: the installed gem only supplies the public
# namespace passed below.
require "json"

ZERO_PAYLOAD_INPUTS = %i[witness_count absent_count token_tag marker_count mark_count].freeze
ZERO_PAYLOAD_RESULTS = %i[
  produce_witness produce_token witnesses maybe_witness produce_marker produce_mark
].freeze

def check_zero_payload_records(api, result_only = false, parameter_prefix = "arg")
  unless [true, false].include?(result_only) && ["arg", "value"].include?(parameter_prefix)
    raise ArgumentError, "invalid zero-payload caller options"
  end

  checks = calls = rejections = recoveries = snapshots = 0
  witness_class = api.const_get(:Witness)
  token_class = api.const_get(:Token)
  marker_class = api.const_get(:Marker)
  mark_class = api.const_get(:Mark)
  blank_class = mark_class.const_get(:Blank)
  marked_class = mark_class.const_get(:Marked)
  some_class = api.const_get(:Some)
  unit = api.const_get(:UNIT)
  field_names = {
    witness_class => [], token_class => %i[tag], marker_class => [],
    blank_class => [], marked_class => %i[witness]
  }

  snapshot = lambda do |value|
    case value
    when nil, true, false, Integer, String
      [value.class.name, value]
    when Array
      ["Array", value.map { |item| snapshot.call(item) }]
    else
      if value.equal?(unit)
        ["UNIT"]
      elsif value.instance_of?(some_class)
        ["Some", snapshot.call(value.value)]
      else
        fields = field_names[value.class]
        raise "unexpected public value type: #{value.class}" unless fields
        expected = fields.map { |name| :"@#{name}" }.sort
        raise "unexpected record fields: #{value.class}" unless value.instance_variables.sort == expected
        [value.class.name, value.frozen?, fields.map { |name| [name, snapshot.call(value.instance_variable_get(:"@#{name}"))] }]
      end
    end
  end
  check = lambda do |condition, label|
    raise "zero-payload assertion failed: #{label}" unless condition
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
    raise "accepted refused zero-payload input: #{label}" unless error
    expected = "#{parameter_prefix}0 was rejected by ZeroPayloadCheckedRecords.#{constructor}"
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
    raise "accepted malformed zero-payload input: #{label}" unless error
    host_error = [TypeError, RangeError].include?(error.class)
    check.call(host_error && !error.message.start_with?("#{parameter_prefix}0 was rejected by"),
               "#{label} host refusal")
    check.call(snapshot.call(arguments) == before, "#{label} preserves rejected input")
    rejections += 1
    snapshots += 1
  end
  recover = lambda do
    invoke.call(:witness_count, [witness_class.new], 1)
    recoveries += 1
  end

  ZERO_PAYLOAD_INPUTS.each do |name|
    check.call(api.respond_to?(name) != result_only, "input export selection: #{name}")
  end
  ZERO_PAYLOAD_RESULTS.each do |name|
    check.call(api.respond_to?(name), "result export selection: #{name}")
  end
  check.call(witness_class.new == witness_class.new && witness_class.new != marker_class.new &&
             witness_class.new != blank_class.new && !witness_class.new.nil?,
             "empty carriers stay nominally distinct from each other and from nil")
  check.call(witness_class.new.frozen? && marker_class.new.frozen?,
             "empty carriers are frozen values")

  witness = invoke.call(:produce_witness, [], witness_class.new)
  check.call(witness.instance_of?(witness_class), "proof-only Witness is a real empty value")
  token = invoke.call(:produce_token, [], token_class.new(tag: unit))
  check.call(token.tag.equal?(unit), "Token retains its UNIT payload")
  values = invoke.call(:witnesses, [3], [witness_class.new, witness_class.new, witness_class.new])
  check.call(values.instance_of?(Array) && values.length == 3 && values[0] == values[2],
             "Witness array retains its length")
  invoke.call(:witnesses, [0], [])
  invoke.call(:maybe_witness, [false], nil)
  some = invoke.call(:maybe_witness, [true], some_class.new(witness_class.new))
  check.call(some.instance_of?(some_class) && some.value == witness_class.new,
             "present empty Witness remains Some")
  marker = invoke.call(:produce_marker, [], marker_class.new)
  check.call(marker.instance_of?(marker_class) && marker != witness,
             "plain Marker stays distinct from checked Witness")
  blank = invoke.call(:produce_mark, [false], blank_class.new)
  marked = invoke.call(:produce_mark, [true], marked_class.new(witness: witness_class.new))
  check.call(blank.instance_of?(blank_class) && marked.instance_of?(marked_class) &&
             marked.witness == witness_class.new,
             "both variant branches survive proof erasure")

  unless result_only
    invoke.call(:witness_count, [witness_class.new], 1)
    refused.call(:absent_count, [witness_class.new], "mkAbsent", "refusing nullary constructor")
    recover.call
    invoke.call(:token_tag, [token_class.new(tag: unit)], unit)
    invoke.call(:marker_count, [marker_class.new], 0)
    invoke.call(:mark_count, [blank_class.new], 0)
    invoke.call(:mark_count, [marked_class.new(witness: witness_class.new)], 1)
    host_refused.call(:witness_count, [nil], "nil is not an empty carrier")
    recover.call
    host_refused.call(:witness_count, [marker_class.new], "plain Marker is not a checked Witness")
    recover.call
    host_refused.call(:marker_count, [witness_class.new], "checked Witness is not a plain Marker")
    recover.call
    host_refused.call(:token_tag, [token_class.new(tag: nil)], "Unit payload must be UNIT")
    recover.call
    host_refused.call(:mark_count, [marked_class.new(witness: nil)], "nested nil is not an empty carrier")
    recover.call
    host_refused.call(:mark_count, [witness_class.new], "bare Witness is not a Mark constructor")
    recover.call
    host_refused.call(:witnesses, [-1], "negative Witness count")
    recover.call
  end

  actual = [calls, checks, recoveries, rejections, snapshots]
  expected = result_only ? [9, 37, 0, 0, 9] : [30, 79, 8, 8, 30]
  check.call(actual == expected, "exact caller totals #{actual.inspect} != #{expected.inspect}")
  { calls: calls, checks: checks, recoveries: recoveries, rejections: rejections, snapshots: snapshots }
end

if $PROGRAM_NAME == __FILE__
  allowed = [[], ["--result-only"], ["--reviewed"], ["--result-only", "--reviewed"]]
  abort "usage: ruby.rb [--result-only] [--reviewed]" unless allowed.include?(ARGV)
  require "lean_bridge/zeropayloadcheckedrecords"
  puts JSON.generate(check_zero_payload_records(
    LeanBridge::Zeropayloadcheckedrecords, ARGV.include?("--result-only"),
    ARGV.include?("--reviewed") ? "value" : "arg"
  ))
end
