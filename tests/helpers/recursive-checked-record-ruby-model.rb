# frozen_string_literal: true
# Exercise the standalone recursive Ruby caller against an oracle; no Lean or installed gem executes.
require "json"

raise ArgumentError, "Expected caller path and generated recursive and mutual modules" unless ARGV.length == 3
load ARGV[0]
VALUES = %w[recursive mutual].zip(ARGV[1, 2]).to_h do |mod, path|
  generated = File.read(path)
  marker = %(require_relative "#{mod}checkedrecords/native"\n)
  raise "Unexpected generated module" unless generated.scan(marker).length == 1
  eval(generated.sub(marker, ""), TOPLEVEL_BINDING, path) # rubocop:disable Security/Eval
  [mod, LeanBridge.const_get(:"#{mod.capitalize}checkedrecords")]
end.freeze
SPECS = {
  "recursive" => { lean: "RecursiveCheckedRecords", record: :Packet, fields: %i[value digit tail], make: "mkPacket", normalize: "normalizePacket" },
  "mutual" => { lean: "MutualCheckedRecords", record: :Envelope, fields: %i[value mode next_], make: "mkEnvelope", normalize: "normalizeEnvelope" }
}.freeze

FAULTS = %w[
  produce-offset produce-single produce-digits accept-bool wrong-host-exception alias-constant
  missing-fin missing-normalization conflated-constructor diagnostic-suffix wrong-status wrong-path
  root-only echo-unnormalized echo-drops-tail cycle-as-lean depth-unbounded shared-as-cycle
  groups-drop-none echo-groups-drops-none poison-after-reject
].freeze
MODULE_FAULTS = { "recursive" => %w[second-normalizes-root-only], "mutual" => %w[stop-as-none] }.freeze

def oracle(mod, fault = nil)
  values, spec = VALUES.fetch(mod), SPECS.fetch(mod)
  packet, some, error = values.const_get(spec[:record]), values::Some, values::LeanBridgeError
  value_name, bound_name, link_name = spec[:fields]
  mutual = mod == "mutual"
  stop_class, more_class = mutual ? [values::Step::Stop, values::Step::More] : [nil, nil]
  api = Module.new
  api.const_set(spec[:record], packet)
  api.const_set(:Some, some)
  api.const_set(:LeanBridgeError, error)
  api.const_set(:Step, values::Step) if mutual
  api.const_set(:"#{spec[:record]}Alias", packet) if fault == "alias-constant"
  build = ->(value, digit, link) { packet.new(value_name => value, bound_name => digit, link_name => link) }
  field = ->(record, name) { record.public_send(name) }
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
    when :option, :step_option
      next if value.nil?
      host.call(TypeError, "Expected nil or Some(value)") unless value.instance_of?(some)
      convert.call(value.value, kind == :option ? :record : :step, depth + 1, active)
    when :step
      next if value.instance_of?(stop_class)
      host.call(TypeError, "Expected exact Step") unless value.instance_of?(more_class)
      convert.call(value.packet, :record, depth + 1, active)
    else
      host.call(TypeError, "Expected exact #{spec[:record]}") unless value.instance_of?(packet)
      convert.call(field.call(value, value_name), :nat, depth + 1, active)
      convert.call(field.call(value, bound_name), :nat, depth + 1, active)
      convert.call(field.call(value, link_name), mutual ? :step_option : :option, depth + 1, active)
    end
  end
  child = lambda do |record|
    link = field.call(record, link_name)
    next [nil, nil] if link.nil? || (mutual && link.value.instance_of?(stop_class))
    mutual ? [link.value.packet, ".next?.more.packet"] : [link.value, ".tail?"]
  end
  rebuild = lambda do |record, value, tail|
    link = field.call(record, link_name)
    if !mutual then build.call(value, field.call(record, bound_name), tail.nil? || fault == "echo-drops-tail" ? nil : some.new(value: tail))
    elsif link.nil? || link.value.instance_of?(stop_class)
      build.call(value, field.call(record, bound_name), link.nil? || fault == "stop-as-none" ? nil : some.new(value: stop_class.new))
    else build.call(value, field.call(record, bound_name), fault == "echo-drops-tail" ? nil : some.new(value: more_class.new(packet: tail)))
    end
  end
  fin = lambda do |record, path|
    reject.call("#{path}.#{bound_name} is not below its Fin 3 bound") if field.call(record, bound_name) >= 3 && fault != "missing-fin"
    nested, link = child.call(record)
    fin.call(nested, path + (fault == "wrong-path" ? "" : link)) if nested && fault != "root-only"
  end
  construct = lambda do |record, path, site|
    make = site == :make || fault == "conflated-constructor"
    plus, limit, word, outer = make ? [1, 99, "plusOne", spec[:make]] : [2, 89, "plusTwo", spec[:normalize]]
    current = field.call(record, value_name)
    reject.call("#{path}.value was rejected by #{spec[:lean]}.#{word}") if current > limit
    nested, link = child.call(record)
    tail = if nested.nil? then nil
           elsif fault == "root-only" then nested
           else construct.call(nested, path + (fault == "wrong-path" ? "" : link), site)
           end
    value = current + (fault == "missing-normalization" ? 0 : plus)
    digit = field.call(record, bound_name)
    reject.call("#{path} was rejected by #{spec[:lean]}.#{outer}") if outer.start_with?("mk") && digit > value
    value = digit + 1 if outer == "normalizePacket"
    value = current if outer == "normalizePacket" && fault == "second-normalizes-root-only" && path != "arg0"
    rebuild.call(record, value, tail)
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
  api.define_singleton_method(:first) { |value| field.call(accepted.call(value, :record, :make), value_name) }
  api.define_singleton_method(:second) { |value| field.call(accepted.call(value, :record, :normalize), value_name) }
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
    next build.call(value + offset, digits[0], nil) if fault == "produce-single"
    tail = build.call(value + offset + 1, digits[1], nil)
    build.call(value + offset, digits[0], some.new(value: mutual ? more_class.new(packet: tail) : tail))
  end
  api
end

results = %w[recursive mutual].map { |mod| RecursiveCheckedRecordCaller.check(oracle(mod), mod).sort.to_h }
rejected = %w[recursive mutual].to_h do |mod|
  [mod, (FAULTS + MODULE_FAULTS.fetch(mod)).select do |fault|
    RecursiveCheckedRecordCaller.check(oracle(mod, fault), mod, rounds: 2)
    raise "Caller accepted #{mod} fault: #{fault}"
  rescue RuntimeError => failure
    raise if failure.message.start_with?("Caller accepted")
    true
  end]
end
puts JSON.generate({ results: results, rejectedFaults: rejected, installedAcceptance: false })
