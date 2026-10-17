# Independent Ruby caller for proof-free inherited checked records.
require "json"

INHERITED_FULL_NAMES = [:first, :normalized, :pair, :aliased, :nested, :echo].freeze
INHERITED_RESULT_NAMES = [:produce, :produce_stamped].freeze
INHERITED_DIAGNOSTIC = / (?:is not below its Fin [0-9]+ bound|was rejected by InheritedCheckedRecords\.[A-Za-z]+)\z/

def check_inherited_checked_records(api, result_only = false, rounds = 256,
                                    parameter_prefix = "arg")
  unless [true, false].include?(result_only) && rounds.instance_of?(Integer) && rounds.between?(1, 1000)
    raise "invalid inherited caller options"
  end
  raise "invalid parameter prefix" unless ["arg", "value"].include?(parameter_prefix)

  checks = rejections = host_rejections = calls = recoveries = snapshots = 0
  snapshot_controls = 0
  span_class = api.const_get(:Span)
  ticket_class = api.const_get(:Ticket)
  stamped_class = api.const_get(:Stamped)
  fields = {
    span_class => [:lo, :hi], ticket_class => [:to_span, :word],
    stamped_class => [:to_ticket, :mark]
  }

  snapshot = lambda do |value|
    kind = value.class
    if [NilClass, TrueClass, FalseClass, Integer, Float, String].include?(kind)
      [kind, value]
    elsif kind == Array
      [Array, value.frozen?, value.map { |item| snapshot.call(item) }]
    elsif fields.key?(kind)
      names = fields.fetch(kind)
      expected = names.map { |name| :"@#{name}" }.sort
      raise "unexpected inherited record fields: #{kind}" unless value.instance_variables.sort == expected
      [kind, value.frozen?, names.map { |name| [name, snapshot.call(value.instance_variable_get(:"@#{name}"))] }]
    else
      raise "unexpected public value type: #{kind}"
    end
  end
  check = lambda do |condition, label|
    raise "failed: #{label}" unless condition
    checks += 1
  end
  equal = lambda do |actual, expected, label|
    check.call(snapshot.call(actual) == snapshot.call(expected), label)
  end
  invoke = lambda do |name, arguments, expected, label = name|
    before = snapshot.call(arguments)
    calls += 1
    result = begin
      api.public_send(name, *arguments)
    rescue StandardError => error
      raise "#{name} unexpectedly raised #{error.class}: #{error.message}"
    end
    equal.call(result, expected, label)
    check.call(snapshot.call(arguments) == before, "#{label} preserved every input")
    snapshots += 1
    result
  end
  refused = lambda do |name, arguments, message|
    before = snapshot.call(arguments)
    calls += 1
    error = begin
      api.public_send(name, *arguments)
      nil
    rescue StandardError => raised
      raised
    end
    raise "accepted invalid input: #{message}" if error.nil?
    check.call(error.instance_of?(RangeError) && error.message == message,
               "exact refusal: #{message}; got #{error.class}: #{error.message}")
    check.call(snapshot.call(arguments) == before, "#{name} rejection preserved every input")
    snapshots += 1
    rejections += 1
  end
  host_refused = lambda do |name, arguments, kinds, label|
    before = snapshot.call(arguments)
    calls += 1
    error = begin
      api.public_send(name, *arguments)
      nil
    rescue StandardError => raised
      raised
    end
    raise "accepted malformed input: #{label}" if error.nil?
    check.call(kinds.include?(error.class) && !error.message.match?(INHERITED_DIAGNOSTIC),
               "#{name} host refusal: #{label}; got #{error.class}: #{error.message}")
    check.call(snapshot.call(arguments) == before, "#{label} preserved every input")
    snapshots += 1
    host_rejections += 1
  end
  distinct = lambda do |left, right|
    check.call(snapshot.call(left) != snapshot.call(right), "independent snapshot mutation control")
    snapshot_controls += 1
  end

  span = ->(lo, hi) { span_class.new(lo: lo, hi: hi) }
  ticket = ->(lo, hi, word) { ticket_class.new(to_span: span.call(lo, hi), word: word) }
  stamped = lambda do |lo, hi, word, mark|
    stamped_class.new(to_ticket: ticket.call(lo, hi, word), mark: mark)
  end
  produced = ->(value) { ticket.call(value, value, value + 1) }
  produced_stamped = ->(value) { stamped.call(value, value, value + 1, 0) }

  INHERITED_FULL_NAMES.each do |name|
    check.call(api.respond_to?(name) != result_only, "full export selection: #{name}")
  end
  INHERITED_RESULT_NAMES.each do |name|
    check.call(api.respond_to?(name), "result export selection: #{name}")
  end

  huge = 2**100
  distinct.call(ticket.call(0, 0, 1), ticket.call(0, 0, 2))
  distinct.call(ticket.call(0, 0, 1), ticket.call(0, 1, 1))
  distinct.call(stamped.call(0, 0, 1, 0), stamped.call(0, 0, 1, 1))
  distinct.call(0, huge)
  distinct.call(span.call(0, 1), ticket.call(0, 1, 1))
  distinct.call(ticket.call(0, 1, 1), stamped.call(0, 1, 1, 0))
  unless result_only
    distinct.call(ticket.call(1, 2, 3), ticket.call(2, 2, 3))
    distinct.call(stamped.call(1, 2, 3, 0), stamped.call(1, 2, 3, 7))
  end

  [0, 4, huge].each do |value|
    invoke.call(:produce, [value], produced.call(value))
    invoke.call(:produce_stamped, [value], produced_stamped.call(value))
  end
  rounds.times do |round|
    value = huge + round
    first_result = invoke.call(:produce, [value], produced.call(value))
    marked_result = invoke.call(:produce_stamped, [value], produced_stamped.call(value))
    check.call(!first_result.equal?(marked_result.to_ticket),
               "returned tickets own independent managed storage")
    check.call(!first_result.to_span.equal?(marked_result.to_ticket.to_span),
               "returned parent fields own independent managed storage")
  end
  host_refused.call(:produce, [true], [TypeError], "true Nat")
  host_refused.call(:produce, [-1], [RangeError], "negative Nat")
  host_refused.call(:produce_stamped, [1.0], [TypeError], "Float Nat")
  host_refused.call(:produce_stamped, [nil], [TypeError], "nil Nat")

  summary = lambda do
    {
      checks: checks, rejections: rejections, hostRejections: host_rejections,
      calls: calls, recoveries: recoveries, snapshots: snapshots,
      snapshotControls: snapshot_controls, rounds: rounds
    }
  end
  return summary.call if result_only

  p0 = "#{parameter_prefix}0"
  rejected = ->(path, constructor) { "#{path} was rejected by InheritedCheckedRecords.#{constructor}" }

  first_value = ticket.call(2, 3, 4)
  raw_right = ticket.call(4, 1, 999)
  invoke.call(:first, [first_value], 9)
  invoke.call(:normalized, [ticket.call(4, 1, 0)], 11)
  invoke.call(:pair, [first_value, raw_right], 10)
  invoke.call(:aliased, [ticket.call(4, 1, 4)], 5)
  invoke.call(:nested, [stamped.call(1, 2, 4, 3)], 7)
  invoke.call(:echo, [ticket.call(1, 2, 0)], ticket.call(1, 2, 3))
  refused.call(:first, [ticket.call(4, 1, 5)], rejected.call("#{p0}.toSpan", "mkSpan"))
  refused.call(:first, [ticket.call(1, 2, 0)], rejected.call("#{p0}.word", "mkWord"))
  refused.call(:first, [ticket.call(1, 5, 3)], rejected.call(p0, "mkTicket"))
  refused.call(:nested, [stamped.call(1, 2, 9, 8)], "#{p0}.mark is not below its Fin 8 bound")
  refused.call(:nested, [stamped.call(1, 2, 4, 5)], rejected.call(p0, "mkStamped"))
  refused.call(:aliased, [ticket.call(1, 5, 3)], rejected.call(p0, "mkTicket"))
  refused.call(:pair, [ticket.call(4, 1, 5), raw_right], rejected.call("#{p0}.toSpan", "mkSpan"))
  refused.call(:pair, [ticket.call(1, 5, 3), raw_right], rejected.call(p0, "mkTicket"))
  host_refused.call(:first, [1], [TypeError, ArgumentError], "unrelated scalar as Ticket")
  host_refused.call(:first, [span.call(1, 2)], [TypeError, ArgumentError], "Span as Ticket")
  host_refused.call(:nested, [ticket.call(1, 2, 4)], [TypeError, ArgumentError], "Ticket as Stamped")
  equal.call(raw_right, ticket.call(4, 1, 999), "normalization never mutated reused input")

  rounds.times do |round|
    value = round + 10
    valid = ticket.call(value, value + 1, value + 2)
    invoke.call(:first, [valid], 3 * value + 3, "round accepted")
    invoke.call(:normalized, [ticket.call(value + 2, value, 0)], 4 * value + 5,
                "round normalized")
    invoke.call(:pair, [valid, ticket.call(value + 2, value, 0)], 3 * value + 5,
                "round repeated position")
    invoke.call(:aliased, [ticket.call(value + 2, value, 2 * value + 1)], 2 * value + 2,
                "round alias")
    mark = round % 8
    invoke.call(:nested, [stamped.call(mark, mark, mark + 1, mark)], 2 * mark + 1,
                "round nested")
    refused.call(:first, [ticket.call(value + 1, value, value + 2)],
                 rejected.call("#{p0}.toSpan", "mkSpan"))
    refused.call(:first, [ticket.call(0, 1, 0)], rejected.call("#{p0}.word", "mkWord"))
    refused.call(:first, [ticket.call(0, value + 2, value + 1)], rejected.call(p0, "mkTicket"))
    refused.call(:nested, [stamped.call(0, 9, 9, 8)],
                 "#{p0}.mark is not below its Fin 8 bound")
    refused.call(:nested, [stamped.call(0, 6, 6, 7)], rejected.call(p0, "mkStamped"))
    invoke.call(:first, [valid], 3 * value + 3, "recovery after nested rejection")
    recoveries += 1
  end
  equal.call(raw_right, ticket.call(4, 1, 999), "all rounds preserved reused input")
  summary.call
end

if $PROGRAM_NAME == __FILE__
  allowed = [[], ["--result-only"], ["--reviewed"], ["--result-only", "--reviewed"]]
  abort "usage: consumer.rb [--result-only] [--reviewed]" unless allowed.include?(ARGV)
  require "lean_bridge/inheritedcheckedrecords"
  puts JSON.generate(check_inherited_checked_records(
                       LeanBridge::Inheritedcheckedrecords,
                       ARGV.include?("--result-only"), 256,
                       ARGV.include?("--reviewed") ? "value" : "arg"))
end
