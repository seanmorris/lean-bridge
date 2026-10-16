# frozen_string_literal: true
# Independent recursive and mutual checked-record caller; executions require an installed gem.
require "json"

module RecursiveCheckedRecordCaller
  EXPORTS = %i[first second echo groups echo_groups produce].freeze
  MODULES = {
    "recursive" => { lean: "RecursiveCheckedRecords", record: :Packet, fields: %i[value digit tail],
                     make: "mkPacket", link: ".tail?" },
    "mutual" => { lean: "MutualCheckedRecords", record: :Envelope, fields: %i[value mode next],
                  make: "mkEnvelope", link: ".next?.more.packet" }
  }.freeze
  LIMIT = "Copied graph depth or node limit exceeded"

  module_function

  def check(api, mod, rounds: 64)
    raise ArgumentError, "Invalid recursive caller options" unless MODULES.key?(mod) && rounds.instance_of?(Integer) && rounds.between?(1, 1000)
    spec = MODULES.fetch(mod)
    packet, some, error = api.const_get(spec[:record]), api::Some, api::LeanBridgeError
    value_name, bound_name, link_name = spec[:fields]
    mutual = mod == "mutual"
    stop_class, more_class = mutual ? [api::Step::Stop, api::Step::More] : [nil, nil]
    rejected = " was rejected by #{spec[:lean]}."
    bound = ".#{bound_name} is not below its Fin 3 bound"
    link = spec[:link]
    make = spec[:make]
    counts = Hash.new(0)
    build = ->(value, digit, link_value) { packet.new(value_name => value, bound_name => digit, link_name => link_value) }
    # The only module difference is how a present child is carried.
    node = lambda do |value, digit, tail = nil|
      next build.call(value, digit, nil) if tail.nil?
      build.call(value, digit, some.new(value: mutual ? more_class.new(packet: tail) : tail))
    end
    stop = ->(value, digit) { mutual ? build.call(value, digit, some.new(value: stop_class.new)) : node.call(value, digit) }
    chain = lambda do |pairs|
      pairs.reverse.reduce(nil) { |tail, (value, digit)| node.call(value, digit, tail) }
    end
    # first/echo/groups select plus-one checks; second/echo_groups plus-two.
    normalized = lambda do |value, plus|
      if value.nil? then nil
      elsif value.instance_of?(some) then some.new(value: normalized.call(value.value, plus))
      elsif mutual && value.instance_of?(stop_class) then stop_class.new
      elsif mutual && value.instance_of?(more_class) then more_class.new(packet: normalized.call(value.packet, plus))
      else
        head, digit, tail = spec[:fields].map { |name| value.public_send(name) }
        next build.call(digit + 1, digit, normalized.call(tail, plus)) if plus == 2 && !mutual
        build.call(head + plus, digit, normalized.call(tail, plus))
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
        raise "Unexpected record fields" unless value.deconstruct_keys(nil).keys == spec[:fields]
        [spec[:record], spec[:fields].map { |name| [name, snapshot.call(value.public_send(name), active + [value])] }]
      elsif value.instance_of?(some)
        [:Some, snapshot.call(value.value, active + [value])]
      elsif mutual && value.instance_of?(stop_class)
        [:Stop]
      elsif mutual && value.instance_of?(more_class)
        [:More, snapshot.call(value.packet, active + [value])]
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
    check.call(!api.const_defined?(:"#{spec[:record]}Alias", false), "alias stays a contract name, not a constant")
    pairs = [[0, false], [1, 1.0], [[node.call(1, 0)], node.call(1, 0)],
             [node.call(1, 0), node.call(1, 1)], [node.call(1, 0), node.call(2, 0)],
             [node.call(1, 0, node.call(1, 0)), node.call(1, 0)], [some.new(value: node.call(1, 0)), nil],
             [chain.call([[1, 0], [1, 0]]), chain.call([[1, 0], [2, 0]])]]
    if mutual
      pairs += [[stop.call(1, 0), node.call(1, 0)], [some.new(value: stop_class.new), nil],
                [more_class.new(packet: node.call(1, 0)), some.new(value: node.call(1, 0))]]
    end
    pairs.each do |left, right|
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
    call.call(:second, [root], mutual ? 42 : 3)
    call.call(:second, [chain.call([[89, 2], [0, 1]])], mutual ? 91 : 3)
    call.call(:echo, [root], normalized.call(root, 1))
    long = chain.call([[1, 0], [2, 1], [3, 2], [4, 0]])
    call.call(:echo, [long], normalized.call(long, 1))
    deep = chain.call((0...40).map { |n| [n % 90, n % 3] })
    call.call(:first, [deep], 1)
    call.call(:echo, [deep], normalized.call(deep, 1))
    call.call(:second, [deep], mutual ? 2 : 1)
    shared = node.call(5, 1)
    call.call(:groups, [[some.new(value: shared), nil, some.new(value: shared)]], 3)
    call.call(:groups, [[]], 0)
    call.call(:groups, [[nil, some.new(value: root)]], 2)
    call.call(:echo_groups, [[some.new(value: root), nil, some.new(value: shared)]],
              [normalized.call(some.new(value: root), 2), nil, normalized.call(some.new(value: shared), 2)])
    call.call(:echo_groups, [[]], [])
    if mutual
      call.call(:first, [stop.call(40, 2)], 41)
      call.call(:echo, [stop.call(40, 2)], stop.call(41, 2))
      call.call(:echo, [node.call(1, 0, stop.call(2, 1))], node.call(2, 0, stop.call(3, 1)))
      call.call(:second, [node.call(1, 0, stop.call(2, 1))], 3)
    end

    # Exact late-field and constructor paths through the recursive carrier.
    refuse.call(:first, [node.call(100, 0)], "arg0.value#{rejected}plusOne")
    refuse.call(:first, [node.call(2**100, 0)], "arg0.value#{rejected}plusOne")
    refuse.call(:first, [chain.call([[40, 2], [100, 1]])], "arg0#{link}.value#{rejected}plusOne")
    refuse.call(:first, [chain.call([[40, 2], [40, 2], [100, 1]])], "arg0#{link}#{link}.value#{rejected}plusOne")
    refuse.call(:first, [node.call(40, 3)], "arg0#{bound}")
    refuse.call(:first, [chain.call([[40, 2], [80, 3]])], "arg0#{link}#{bound}")
    refuse.call(:first, [node.call(0, 2)], "arg0#{rejected}#{make}")
    refuse.call(:first, [chain.call([[40, 2], [0, 2]])], "arg0#{link}#{rejected}#{make}")
    refuse.call(:echo, [chain.call([[40, 2], [0, 2]])], "arg0#{link}#{rejected}#{make}")
    refuse.call(:second, [node.call(90, 0)], "arg0.value#{rejected}plusTwo")
    refuse.call(:second, [chain.call([[1, 0], [90, 0]])], "arg0#{link}.value#{rejected}plusTwo")
    refuse.call(:groups, [[nil, some.new(value: node.call(100, 0))]], "arg0[1]?.value#{rejected}plusOne")
    refuse.call(:groups, [[some.new(value: root), some.new(value: node.call(0, 2))]], "arg0[1]?#{rejected}#{make}")
    refuse.call(:groups, [[some.new(value: node.call(1, 3))]], "arg0[0]?#{bound}")
    refuse.call(:echo_groups, [[some.new(value: node.call(90, 0))]], "arg0[0]?.value#{rejected}plusTwo")
    refuse.call(:echo_groups, [[nil, some.new(value: chain.call([[1, 0], [95, 1]]))]], "arg0[1]?#{link}.value#{rejected}plusTwo")

    # Malformed Ruby values are host refusals, distinct from adapter rejections.
    host_refuse.call(:first, [some.new(value: node.call(1, 0))], [TypeError], "option as record")
    host_refuse.call(:first, [node.call(true, 0)], [TypeError], "bool value")
    host_refuse.call(:first, [node.call(1, -1)], [RangeError], "negative digit")
    host_refuse.call(:first, [node.call(1.0, 0)], [TypeError], "float value")
    host_refuse.call(:first, [build.call(1, 0, node.call(1, 0))], [TypeError], "bare child")
    if mutual
      host_refuse.call(:first, [build.call(1, 0, some.new(value: node.call(1, 0)))], [TypeError], "record as step")
      host_refuse.call(:first, [build.call(1, 0, stop_class.new)], [TypeError], "bare step")
    end
    host_refuse.call(:groups, [node.call(1, 0)], [TypeError], "record as array")
    host_refuse.call(:groups, [[node.call(1, 0)]], [TypeError], "bare record as option")
    host_refuse.call(:echo_groups, [[some.new(value: nil)]], [TypeError], "absent record")
    # Frozen records cannot form cycles through constructors; allocate one before freezing.
    cyclic = packet.allocate
    cyclic.instance_variable_set(:"@#{value_name}", 1)
    cyclic.instance_variable_set(:"@#{bound_name}", 0)
    cyclic.instance_variable_set(:"@#{link_name}", some.new(value: mutual ? more_class.new(packet: cyclic) : cyclic))
    cyclic.freeze
    host_refuse.call(:first, [cyclic], [ArgumentError], "cycle", "Cyclic copied value")
    host_refuse.call(:groups, [[some.new(value: cyclic)]], [ArgumentError], "cycle in group", "Cyclic copied value")
    host_refuse.call(:first, [chain.call([[1, 0]] * 100)], [RangeError], "depth", LIMIT)

    # Rejection never poisons later calls: each refusal is followed by a success.
    rounds.times do |round|
      value = round % 90
      call.call(:first, [chain.call([[value, value % 3], [99 - value, 0]])], value + 1)
      refuse.call(:first, [chain.call([[value, value % 3], [100 + round, 0]])], "arg0#{link}.value#{rejected}plusOne")
      call.call(:second, [node.call(value, round % 3)], mutual ? value + 2 : round % 3 + 1)
      refuse.call(:groups, [[some.new(value: node.call(value, 0)), some.new(value: node.call(0, 2))]], "arg0[1]?#{rejected}#{make}")
      host_refuse.call(:first, [cyclic], [ArgumentError], "cycle recovery", "Cyclic copied value")
      call.call(:groups, [[some.new(value: node.call(value, 0))] * (round % 4)], round % 4)
      counts[:recoveries] += 1
    end
    { checks: counts[:checks], rejections: counts[:rejections], hostRejections: counts[:host_rejections],
      recoveries: counts[:recoveries], snapshots: counts[:snapshots], snapshotControls: counts[:snapshot_controls],
      rounds: rounds, module: mod }
  end
end

if $PROGRAM_NAME == __FILE__
  raise ArgumentError, "Select the recursive or mutual module" unless ARGV.length == 1 && RecursiveCheckedRecordCaller::MODULES.key?(ARGV[0])
  require "lean_bridge/#{ARGV[0]}checkedrecords"
  api = LeanBridge.const_get(:"#{ARGV[0].capitalize}checkedrecords")
  puts JSON.generate(RecursiveCheckedRecordCaller.check(api, ARGV[0]).sort.to_h)
end
