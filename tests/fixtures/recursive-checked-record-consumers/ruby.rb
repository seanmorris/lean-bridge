# frozen_string_literal: true
# Independent recursive checked-record caller; executions require an installed gem.
require "json"

module RecursiveCheckedRecordCaller
  EXPORTS = %i[first second echo groups echo_groups produce].freeze
  REJECTED = " was rejected by RecursiveCheckedRecords."
  BOUND = ".digit is not below its Fin 3 bound"
  LINK = ".tail?"
  LIMIT = "Copied graph depth or node limit exceeded"

  module_function

  def check(api, rounds: 64)
    raise ArgumentError, "Invalid recursive caller options" unless rounds.instance_of?(Integer) && rounds.between?(1, 1000)
    packet, some, error = api::Packet, api::Some, api::LeanBridgeError
    counts = Hash.new(0)
    node = lambda do |value, digit, tail = nil|
      packet.new(value: value, digit: digit, tail: tail.nil? ? nil : some.new(value: tail))
    end
    chain = lambda do |pairs|
      pairs.reverse.reduce(nil) { |tail, (value, digit)| node.call(value, digit, tail) }
    end
    # first/echo/groups select plus-one checks; second/echo_groups normalize to digit + 1.
    normalized = lambda do |value, plus|
      case value
      when nil then nil
      when some then some.new(value: normalized.call(value.value, plus))
      else
        tail = normalized.call(value.tail, plus)
        packet.new(value: plus == 2 ? value.digit + 1 : value.value + plus, digit: value.digit, tail: tail)
      end
    end
    snapshot = lambda do |value, active = []|
      if value.nil? || [true, false].include?(value) || value.instance_of?(Integer) || value.instance_of?(Float)
        [value.class.name, value]
      elsif active.any? { |item| item.equal?(value) }
        [:cycle]
      elsif value.instance_of?(Array)
        [:Array, value.map { |item| snapshot.call(item, active + [value]) }]
      elsif value.instance_of?(packet)
        raise "Unexpected record fields" unless value.deconstruct_keys(nil).keys == %i[value digit tail]
        [:Packet, %i[value digit tail].map { |name| [name, snapshot.call(value.public_send(name), active + [value])] }]
      elsif value.instance_of?(some)
        [:Some, snapshot.call(value.value, active + [value])]
      else
        raise "Unexpected public value type: #{value.class}"
      end
    end
    check = lambda do |condition, label|
      raise "failed: #{label}" unless condition
      counts[:checks] += 1
    end
    unchanged = lambda do |name, args, before|
      counts[:snapshots] += 1
      check.call(snapshot.call(args) == before, "#{name} inputs unchanged")
    end
    call = lambda do |name, args, expected|
      before = snapshot.call(args)
      begin
        result = api.public_send(name, *args)
      rescue StandardError => failure
        raise "#{name} unexpectedly raised #{failure.class}: #{failure.message}"
      end
      check.call(snapshot.call(result) == snapshot.call(expected), "#{name} exact result")
      unchanged.call(name, args, before)
      result
    end
    refuse = lambda do |name, args, expected|
      before = snapshot.call(args)
      begin
        api.public_send(name, *args)
      rescue error => failure
        check.call(failure.instance_of?(error) && failure.status == 1 && failure.message == expected,
                   "exact refusal: #{expected} (got #{failure.class} #{failure.status}: #{failure.message})")
      else
        raise "Accepted invalid input: #{expected}"
      end
      unchanged.call(name, args, before)
      counts[:rejections] += 1
    end
    host_refuse = lambda do |name, args, kinds, label, message = nil|
      # Ruby conversion refusals precede the adapter and never use the bridge error class.
      before = snapshot.call(args)
      begin
        api.public_send(name, *args)
      rescue StandardError => failure
        check.call(kinds.any? { |kind| failure.is_a?(kind) } && !failure.is_a?(error), "#{name} host refusal class: #{label} (got #{failure.class})")
        check.call(message.nil? || failure.message == message, "#{name} host refusal text: #{label}")
      else
        raise "Accepted malformed input: #{label}"
      end
      unchanged.call(name, args, before)
      counts[:host_rejections] += 1
    end

    EXPORTS.each { |name| check.call(api.respond_to?(name), "export: #{name}") }
    check.call(!api.const_defined?(:PacketAlias, false), "alias stays a contract name, not a constant")
    [[0, false], [1, 1.0], [[node.call(1, 0)], node.call(1, 0)],
     [node.call(1, 0), node.call(1, 1)], [node.call(1, 0), node.call(2, 0)],
     [node.call(1, 0, node.call(1, 0)), node.call(1, 0)], [some.new(value: node.call(1, 0)), nil],
     [chain.call([[1, 0], [1, 0]]), chain.call([[1, 0], [2, 0]])]].each do |left, right|
      check.call(snapshot.call(left) != snapshot.call(right), "independent snapshot mutation")
      counts[:snapshot_controls] += 1
    end

    # Constructor-free results: two linked records, words one and two above the input.
    ([0, 5] + (0...rounds).map { |round| 2**100 + round }).each do |value|
      call.call(:produce, [value], chain.call([[value + 1, 1], [value + 2, 2]]))
    end
    host_refuse.call(:produce, [true], [TypeError], "bool Nat")
    host_refuse.call(:produce, [-1], [RangeError], "negative Nat")
    host_refuse.call(:produce, [1.0], [TypeError], "float Nat")

    # Every linked record passes its selected constructors before the outer one.
    root = chain.call([[40, 2], [80, 1]])
    call.call(:first, [root], 41)
    call.call(:first, [node.call(0, 1)], 1)
    call.call(:first, [chain.call([[99, 2], [0, 0], [7, 1]])], 100)
    call.call(:second, [root], 3)
    call.call(:second, [chain.call([[89, 2], [0, 1]])], 3)
    call.call(:echo, [root], normalized.call(root, 1))
    long = chain.call([[1, 0], [2, 1], [3, 2], [4, 0]])
    call.call(:echo, [long], normalized.call(long, 1))
    deep = chain.call((0...40).map { |n| [n % 90, n % 3] })
    call.call(:first, [deep], 1)
    call.call(:echo, [deep], normalized.call(deep, 1))
    call.call(:second, [deep], 1)
    shared = node.call(5, 1)
    call.call(:groups, [[some.new(value: shared), nil, some.new(value: shared)]], 3)
    call.call(:groups, [[]], 0)
    call.call(:groups, [[nil, some.new(value: root)]], 2)
    call.call(:echo_groups, [[some.new(value: root), nil, some.new(value: shared)]],
              [normalized.call(some.new(value: root), 2), nil, normalized.call(some.new(value: shared), 2)])
    call.call(:echo_groups, [[]], [])

    # Exact late-field and constructor paths through the recursive carrier.
    refuse.call(:first, [node.call(100, 0)], "arg0.value#{REJECTED}plusOne")
    refuse.call(:first, [node.call(2**100, 0)], "arg0.value#{REJECTED}plusOne")
    refuse.call(:first, [chain.call([[40, 2], [100, 1]])], "arg0#{LINK}.value#{REJECTED}plusOne")
    refuse.call(:first, [chain.call([[40, 2], [40, 2], [100, 1]])], "arg0#{LINK}#{LINK}.value#{REJECTED}plusOne")
    refuse.call(:first, [node.call(40, 3)], "arg0#{BOUND}")
    refuse.call(:first, [chain.call([[40, 2], [80, 3]])], "arg0#{LINK}#{BOUND}")
    refuse.call(:first, [node.call(0, 2)], "arg0#{REJECTED}mkPacket")
    refuse.call(:first, [chain.call([[40, 2], [0, 2]])], "arg0#{LINK}#{REJECTED}mkPacket")
    refuse.call(:echo, [chain.call([[40, 2], [0, 2]])], "arg0#{LINK}#{REJECTED}mkPacket")
    refuse.call(:second, [node.call(90, 0)], "arg0.value#{REJECTED}plusTwo")
    refuse.call(:second, [chain.call([[1, 0], [90, 0]])], "arg0#{LINK}.value#{REJECTED}plusTwo")
    refuse.call(:groups, [[nil, some.new(value: node.call(100, 0))]], "arg0[1]?.value#{REJECTED}plusOne")
    refuse.call(:groups, [[some.new(value: root), some.new(value: node.call(0, 2))]], "arg0[1]?#{REJECTED}mkPacket")
    refuse.call(:groups, [[some.new(value: node.call(1, 3))]], "arg0[0]?#{BOUND}")
    refuse.call(:echo_groups, [[some.new(value: node.call(90, 0))]], "arg0[0]?.value#{REJECTED}plusTwo")
    refuse.call(:echo_groups, [[nil, some.new(value: chain.call([[1, 0], [95, 1]]))]], "arg0[1]?#{LINK}.value#{REJECTED}plusTwo")

    # Malformed Ruby values are host refusals, distinct from adapter rejections.
    host_refuse.call(:first, [some.new(value: node.call(1, 0))], [TypeError], "option as record")
    host_refuse.call(:first, [node.call(true, 0)], [TypeError], "bool value")
    host_refuse.call(:first, [node.call(1, -1)], [RangeError], "negative digit")
    host_refuse.call(:first, [node.call(1.0, 0)], [TypeError], "float value")
    host_refuse.call(:first, [packet.new(value: 1, digit: 0, tail: node.call(1, 0))], [TypeError], "bare child")
    host_refuse.call(:groups, [node.call(1, 0)], [TypeError], "record as array")
    host_refuse.call(:groups, [[node.call(1, 0)]], [TypeError], "bare record as option")
    host_refuse.call(:echo_groups, [[some.new(value: nil)]], [TypeError], "absent record")
    # Frozen records cannot form cycles through constructors; allocate one before freezing.
    cyclic = packet.allocate
    cyclic.instance_variable_set(:@value, 1)
    cyclic.instance_variable_set(:@digit, 0)
    cyclic.instance_variable_set(:@tail, some.new(value: cyclic))
    cyclic.freeze
    host_refuse.call(:first, [cyclic], [ArgumentError], "cycle", "Cyclic copied value")
    host_refuse.call(:groups, [[some.new(value: cyclic)]], [ArgumentError], "cycle in group", "Cyclic copied value")
    host_refuse.call(:first, [chain.call([[1, 0]] * 100)], [RangeError], "depth", LIMIT)

    # Rejection never poisons later calls: each refusal is followed by a success.
    rounds.times do |round|
      value = round % 90
      call.call(:first, [chain.call([[value, value % 3], [99 - value, 0]])], value + 1)
      refuse.call(:first, [chain.call([[value, value % 3], [100 + round, 0]])], "arg0#{LINK}.value#{REJECTED}plusOne")
      call.call(:second, [node.call(value, round % 3)], round % 3 + 1)
      refuse.call(:groups, [[some.new(value: node.call(value, 0)), some.new(value: node.call(0, 2))]], "arg0[1]?#{REJECTED}mkPacket")
      host_refuse.call(:first, [cyclic], [ArgumentError], "cycle recovery", "Cyclic copied value")
      call.call(:groups, [[some.new(value: node.call(value, 0))] * (round % 4)], round % 4)
      counts[:recoveries] += 1
    end
    { checks: counts[:checks], rejections: counts[:rejections], hostRejections: counts[:host_rejections],
      recoveries: counts[:recoveries], snapshots: counts[:snapshots], snapshotControls: counts[:snapshot_controls],
      rounds: rounds, module: "recursive" }
  end
end

if $PROGRAM_NAME == __FILE__
  raise ArgumentError, "Select the recursive module" unless ARGV == ["recursive"]
  require "lean_bridge/recursivecheckedrecords"
  result = RecursiveCheckedRecordCaller.check(LeanBridge::Recursivecheckedrecords)
  puts JSON.generate(result.sort.to_h)
end
