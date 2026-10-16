# Independent public nested checked-record Ruby checks. No generated equality oracle.
require "json"

NESTED_INPUTS = [:first, :second, :pair, :in_array, :in_list, :in_option, :in_product,
                 :in_except, :in_holder, :in_choice, :echo_array].freeze
NESTED_RESULTS = [:produce_option, :produce_array].freeze
NESTED_LEAN_DIAGNOSTIC = / (?:is not below its Fin [0-9]+ bound|was rejected by NestedCheckedRecords\.[A-Za-z]+)\z/

def check_nested_checked_records(api, result_only = false, rounds = 256, parameter_prefix = "arg")
  raise "invalid nested caller options" unless [true, false].include?(result_only) && rounds.instance_of?(Integer) && rounds.between?(1, 1000)
  raise "invalid parameter prefix" unless ["arg", "value"].include?(parameter_prefix)
  checks = rejections = host_rejections = recoveries = snapshots = snapshot_controls = 0
  packet_class = api.const_get(:Packet)
  some = api.const_get(:Some)
  ok = err = nil
  wrappers = [some]
  fields = {packet_class => [:digit, :word]}
  unless result_only
    ok, err = [:Ok, :Err].map { |name| api.const_get(name) }
    wrappers += [ok, err]
    fields[api.const_get(:Holder)] = [:packet, :tag]
    fields[api.const_get(:Choice).const_get(:Empty)] = []
    fields[api.const_get(:Choice).const_get(:Packet)] = [:value]
  end
  snapshot = lambda do |value|
    kind = value.class
    if [NilClass, TrueClass, FalseClass, Integer, Float].include?(kind)
      [kind, value]
    elsif kind == Array
      [Array, value.frozen?, value.map { |item| snapshot.call(item) }]
    elsif wrappers.include?(kind)
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
  unchanged = lambda do |name, args, before|
    snapshots += 1
    check.call(snapshot.call(args) == before, "#{name} complete inputs unchanged")
  end
  array_ids = lambda do |value|
    kind = value.class
    if kind == Array
      [value.object_id] + value.flat_map { |item| array_ids.call(item) }
    elsif wrappers.include?(kind)
      array_ids.call(value.value)
    elsif fields.key?(kind)
      fields.fetch(kind).flat_map { |name| array_ids.call(value.instance_variable_get(:"@#{name}")) }
    else
      []
    end
  end
  call = lambda do |name, args, expected|
    before = snapshot.call(args)
    begin
      result = api.public_send(name, *args)
    rescue StandardError => error
      raise "failed: #{name} unexpectedly raised #{error.class}: #{error.message}"
    end
    check.call(snapshot.call(result) == snapshot.call(expected), "#{name} exact result")
    unchanged.call(name, args, before)
    check.call((array_ids.call(result) & array_ids.call(args)).empty?, "#{name} copied arrays do not alias inputs")
    result
  end
  refuse = lambda do |name, args, message|
    before = snapshot.call(args)
    error = begin
      api.public_send(name, *args)
      nil
    rescue StandardError => raised
      raised
    end
    raise "failed: accepted invalid input: #{message}" if error.nil?
    check.call(error.instance_of?(RangeError) && error.message == message, "exact refusal: #{message}; got #{error.class}: #{error.message}")
    unchanged.call(name, args, before)
    rejections += 1
  end
  # Ruby conversion refusals precede Lean and never carry a Lean diagnostic.
  host_refuse = lambda do |name, args, kinds, label|
    before = snapshot.call(args)
    error = begin
      api.public_send(name, *args)
      nil
    rescue StandardError => raised
      raised
    end
    raise "failed: accepted malformed input: #{label}" if error.nil?
    check.call(kinds.include?(error.class) && !error.message.match?(NESTED_LEAN_DIAGNOSTIC), "#{name} host refusal: #{label}; got #{error.class}: #{error.message}")
    unchanged.call(name, args, before)
    host_rejections += 1
  end
  p = ->(digit, word) { packet_class.new(digit: digit, word: word) }

  NESTED_INPUTS.each { |name| check.call(api.respond_to?(name) != result_only, "input export selection: #{name}") }
  NESTED_RESULTS.each { |name| check.call(api.respond_to?(name), "result export selection: #{name}") }
  pairs = [[0, false], [1, 1.0], [[p.call(0, 1)], [p.call(0, 1)].freeze], [p.call(0, 1), p.call(0, 2)],
           [p.call(0, 1), p.call(1, 1)], [some.new(p.call(0, 1)), some.new(p.call(0, 2))],
           [some.new(p.call(0, 1)), nil], [nil, some.new(nil)]]
  unless result_only
    pairs += [[ok.new(p.call(0, 1)), err.new(p.call(0, 1))],
              [api.const_get(:Holder).new(packet: p.call(0, 1), tag: 1), [p.call(0, 1), 1]],
              [api.const_get(:Choice).const_get(:Empty).new, nil],
              [api.const_get(:Choice).const_get(:Packet).new(value: p.call(0, 1)), some.new(p.call(0, 1))]]
  end
  pairs.each do |left, right|
    check.call(snapshot.call(left) != snapshot.call(right), "independent snapshot mutation")
    snapshot_controls += 1
  end

  # Constructor-free results: 2^100 + round, with words one and two above it.
  call.call(:produce_option, [0], some.new(p.call(0, 1)))
  call.call(:produce_array, [0], [p.call(0, 1), p.call(0, 2)])
  rounds.times do |round|
    value = 2**100 + round
    call.call(:produce_option, [value], some.new(p.call(0, value + 1)))
    call.call(:produce_array, [value], [p.call(0, value + 1), p.call(0, value + 2)])
  end
  host_refuse.call(:produce_option, [true], [TypeError], "true Nat")
  host_refuse.call(:produce_option, [-1], [RangeError], "negative Nat")
  host_refuse.call(:produce_array, [1.0], [TypeError], "Float Nat")
  host_refuse.call(:produce_array, [nil], [TypeError], "nil Nat")
  summary = lambda do
    {checks: checks, rejections: rejections, hostRejections: host_rejections, recoveries: recoveries,
     snapshots: snapshots, snapshotControls: snapshot_controls, rounds: rounds}
  end
  return summary.call if result_only

  holder = api.const_get(:Holder)
  choice_empty, choice_packet = [:Empty, :Packet].map { |name| api.const_get(:Choice).const_get(name) }
  p0, p1 = "#{parameter_prefix}0", "#{parameter_prefix}1"
  rejected = ->(path, constructor) { "#{path} was rejected by NestedCheckedRecords.#{constructor}" }
  fin = ->(path) { "#{path}.digit is not below its Fin 10 bound" }
  call.call(:first, [p.call(2, 3)], 3)
  call.call(:second, [p.call(7, 0)], 8)
  call.call(:pair, [p.call(2, 3), p.call(7, 0)], 11)
  call.call(:in_array, [[p.call(1, 2), p.call(3, 5)]], 7)
  call.call(:in_array, [[]], 0)
  call.call(:in_list, [[p.call(1, 0), p.call(3, 100)]], 6)
  call.call(:in_list, [[]], 0)
  call.call(:in_option, [nil], 0)
  call.call(:in_option, [some.new(p.call(1, 2))], 3)
  call.call(:in_product, [[p.call(1, 2), p.call(3, 0)]], 6)
  call.call(:in_except, [ok.new(p.call(2, 9))], 3)
  call.call(:in_except, [err.new(p.call(1, 2))], 3)
  call.call(:in_holder, [holder.new(packet: p.call(3, 1), tag: 9)], 13)
  call.call(:in_choice, [choice_empty.new], 0)
  call.call(:in_choice, [choice_packet.new(value: p.call(2, 4))], 5)
  call.call(:echo_array, [[p.call(2, 3), p.call(1, 2**100)]], [p.call(2, 3), p.call(1, 2**100)])
  call.call(:echo_array, [[]], [])

  # Exact late-field and constructor paths through every carrier.
  refuse.call(:first, [p.call(0, 0)], rejected.call("#{p0}.word", "mkWord"))
  refuse.call(:first, [p.call(4, 2)], rejected.call(p0, "mkPacket"))
  refuse.call(:first, [p.call(10, 12)], fin.call(p0))
  refuse.call(:pair, [p.call(2, 3), p.call(10, 0)], fin.call(p1))
  refuse.call(:in_array, [[p.call(2, 3), p.call(1, 0)]], rejected.call("#{p0}[1].word", "mkWord"))
  refuse.call(:in_array, [[p.call(2, 3), p.call(5, 2)]], rejected.call("#{p0}[1]", "mkPacket"))
  refuse.call(:in_array, [[p.call(2, 3), p.call(10, 12)]], fin.call("#{p0}[1]"))
  refuse.call(:in_option, [some.new(p.call(5, 2))], rejected.call("#{p0}?", "mkPacket"))
  refuse.call(:in_product, [[p.call(1, 2), p.call(10, 0)]], fin.call("#{p0}.1"))
  refuse.call(:in_except, [ok.new(p.call(10, 0))], fin.call("#{p0}.ok"))
  refuse.call(:in_except, [err.new(p.call(3, 1))], rejected.call("#{p0}.error", "mkPacket"))
  refuse.call(:in_holder, [holder.new(packet: p.call(10, 0), tag: 9)], fin.call("#{p0}.packet"))
  refuse.call(:in_choice, [choice_packet.new(value: p.call(3, 1))], rejected.call("#{p0}.packet.value", "mkPacket"))

  # Malformed Ruby values are host refusals, distinct from Lean rejections.
  shape = [TypeError, ArgumentError]
  host_refuse.call(:first, [holder.new(packet: p.call(2, 3), tag: 1)], shape, "Holder as Packet")
  host_refuse.call(:first, [p.call(true, 3)], [TypeError], "true digit")
  host_refuse.call(:first, [p.call(2, -3)], [RangeError], "negative word")
  host_refuse.call(:first, [p.call(2, 3.0)], [TypeError], "Float word")
  host_refuse.call(:in_array, [p.call(2, 3)], shape, "Packet as Array")
  host_refuse.call(:in_array, [[p.call(2, 3), [2, 3]]], shape, "Array as Packet element")
  host_refuse.call(:in_product, [[p.call(1, 2)]], shape, "one-element product")
  host_refuse.call(:in_option, [p.call(2, 3)], shape, "bare Packet as option")
  host_refuse.call(:in_except, [p.call(2, 3)], shape, "bare Packet as result")
  host_refuse.call(:in_holder, [holder.new(packet: p.call(2, 3), tag: -1)], [RangeError], "negative tag")
  host_refuse.call(:in_choice, [p.call(2, 4)], shape, "Packet as Choice")

  # Rejection never poisons later calls: each refusal is followed by a success.
  rounds.times do |round|
    call.call(:first, [p.call(round % 10, round + 10)], round + 10)
    refuse.call(:first, [p.call(2, 1)], rejected.call(p0, "mkPacket"))
    call.call(:second, [p.call(round % 10, 0)], round % 10 + 1)
    refuse.call(:in_array, [[p.call(round % 10, round + 10), p.call(1, 0)]], rejected.call("#{p0}[1].word", "mkWord"))
    call.call(:in_array, [[p.call(round % 10, round + 10), p.call(2, 3)]], round + 13)
    recoveries += 1
  end
  summary.call
end

if $PROGRAM_NAME == __FILE__
  allowed = [[], ["--result-only"], ["--reviewed"], ["--result-only", "--reviewed"]]
  abort "usage: consumer.rb [--result-only] [--reviewed]" unless allowed.include?(ARGV)
  require "lean_bridge/nestedcheckedrecords"
  puts JSON.generate(check_nested_checked_records(LeanBridge::Nestedcheckedrecords,
                     ARGV.include?("--result-only"), 256, ARGV.include?("--reviewed") ? "value" : "arg"))
end
