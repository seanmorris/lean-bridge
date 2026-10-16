# frozen_string_literal: true
# Exercise the standalone recursive Ruby caller against an oracle; no Lean or installed gem executes.
require "json"

raise ArgumentError, "Expected caller path and generated public module" unless ARGV.length == 2
load ARGV[0]
generated = File.read(ARGV[1])
marker = %(require_relative "recursivecheckedrecords/native"\n)
raise "Unexpected generated module" unless generated.scan(marker).length == 1
eval(generated.sub(marker, ""), TOPLEVEL_BINDING, ARGV[1]) # rubocop:disable Security/Eval
VALUES = LeanBridge::Recursivecheckedrecords

FAULTS = %w[
  produce-offset produce-single produce-digits accept-bool wrong-host-exception alias-constant
  missing-fin missing-normalization conflated-constructor diagnostic-suffix wrong-status wrong-path
  root-only echo-unnormalized echo-drops-tail cycle-as-lean depth-unbounded shared-as-cycle
  groups-drop-none echo-groups-drops-none poison-after-reject second-normalizes-root-only
].freeze

def oracle(fault = nil)
  packet, some, error = VALUES::Packet, VALUES::Some, VALUES::LeanBridgeError
  api = Module.new
  api.const_set(:Packet, packet)
  api.const_set(:Some, some)
  api.const_set(:LeanBridgeError, error)
  api.const_set(:PacketAlias, packet) if fault == "alias-constant"
  poisoned = false
  host = lambda do |kind, message|
    raise(fault == "wrong-host-exception" ? error.new(1, message) : kind.new(message))
  end
  reject = lambda do |message|
    poisoned = true
    raise error.new(fault == "wrong-status" ? 2 : 1, fault == "diagnostic-suffix" ? "#{message}." : message)
  end
  seen = []
  convert = lambda do |value, kind, depth, active|
    host.call(RangeError, "Copied graph depth or node limit exceeded") if depth > 128 && fault != "depth-unbounded"
    if kind == :nat
      host.call(TypeError, "Expected exact Integer") unless value.instance_of?(Integer) || (fault == "accept-bool" && value == true)
      host.call(RangeError, "Integer outside the Lean range") if value != true && value.negative?
      next
    end
    if active.any? { |item| item.equal?(value) } || (fault == "shared-as-cycle" && seen.any? { |item| item.equal?(value) })
      raise error.new(1, "Invalid copied value") if fault == "cycle-as-lean"
      host.call(ArgumentError, "Cyclic copied value")
    end
    seen << value
    active += [value]
    case kind
    when :groups
      host.call(TypeError, "Expected exact Array") unless value.instance_of?(Array)
      value.each { |item| convert.call(item, :option, depth + 1, active) }
    when :option
      next if value.nil?
      host.call(TypeError, "Expected nil or Some(value)") unless value.instance_of?(some)
      convert.call(value.value, :record, depth + 1, active)
    else
      host.call(TypeError, "Expected exact Packet") unless value.instance_of?(packet)
      convert.call(value.value, :nat, depth + 1, active)
      convert.call(value.digit, :nat, depth + 1, active)
      convert.call(value.tail, :option, depth + 1, active)
    end
  end
  fin = lambda do |record, path|
    reject.call("#{path}.digit is not below its Fin 3 bound") if record.digit >= 3 && fault != "missing-fin"
    fin.call(record.tail.value, path + (fault == "wrong-path" ? "" : ".tail?")) if record.tail && fault != "root-only"
  end
  construct = lambda do |record, path, site|
    make = site == :make || fault == "conflated-constructor"
    plus, limit, word, outer = make ? [1, 99, "plusOne", "mkPacket"] : [2, 89, "plusTwo", "normalizePacket"]
    reject.call("#{path}.value was rejected by RecursiveCheckedRecords.#{word}") if record.value > limit
    tail = if record.tail.nil? then nil
           elsif fault == "root-only" then record.tail.value
           else construct.call(record.tail.value, path + (fault == "wrong-path" ? "" : ".tail?"), site)
           end
    value = record.value + (fault == "missing-normalization" ? 0 : plus)
    reject.call("#{path} was rejected by RecursiveCheckedRecords.#{outer}") if outer == "mkPacket" && record.digit > value
    value = record.digit + 1 if outer == "normalizePacket"
    value = record.value if outer == "normalizePacket" && fault == "second-normalizes-root-only" && path != "arg0"
    packet.new(value: value, digit: record.digit,
               tail: tail.nil? || fault == "echo-drops-tail" ? nil : some.new(value: tail))
  end
  accepted = lambda do |args, kind, site|
    raise error.new(1, "poisoned") if poisoned && fault == "poison-after-reject"
    seen = []
    convert.call(args, kind, 0, [])
    if kind == :groups
      args.each_with_index { |item, index| fin.call(item.value, "arg0[#{index}]?") if item }
      args.each_with_index.map { |item, index| item && some.new(value: construct.call(item.value, "arg0[#{index}]?", site)) }
    else
      fin.call(args, "arg0")
      construct.call(args, "arg0", site)
    end
  end
  api.define_singleton_method(:first) { |value| accepted.call(value, :record, :make).value }
  api.define_singleton_method(:second) { |value| accepted.call(value, :record, :normalize).value }
  api.define_singleton_method(:echo) do |value|
    result = accepted.call(value, :record, :make)
    fault == "echo-unnormalized" ? value : result
  end
  api.define_singleton_method(:groups) do |values|
    items = accepted.call(values, :groups, :make)
    fault == "groups-drop-none" ? items.compact.length : items.length
  end
  api.define_singleton_method(:echo_groups) do |values|
    items = accepted.call(values, :groups, :normalize)
    fault == "echo-groups-drops-none" ? items.compact : items
  end
  api.define_singleton_method(:produce) do |value|
    seen = []
    convert.call(value, :nat, 0, [])
    offset = fault == "produce-offset" ? 0 : 1
    digits = fault == "produce-digits" ? [2, 1] : [1, 2]
    next packet.new(value: value + offset, digit: digits[0], tail: nil) if fault == "produce-single"
    packet.new(value: value + offset, digit: digits[0],
               tail: some.new(value: packet.new(value: value + offset + 1, digit: digits[1], tail: nil)))
  end
  api
end

result = RecursiveCheckedRecordCaller.check(oracle)
rejected = FAULTS.select do |fault|
  RecursiveCheckedRecordCaller.check(oracle(fault), rounds: 2)
  raise "Caller accepted fault: #{fault}"
rescue RuntimeError => failure
  raise if failure.message.start_with?("Caller accepted fault")
  true
end
puts JSON.generate({ result: result.sort.to_h, rejectedFaults: rejected, installedAcceptance: false })
