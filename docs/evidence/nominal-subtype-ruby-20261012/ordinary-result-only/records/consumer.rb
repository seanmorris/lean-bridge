# Independent public Ruby checks. No generated equality or serialization oracle.
require "json"

def check_nominal_subtypes(api, result_only = false)
  checks = rejections = snapshot_controls = 0
  some, ok, err = [:Some, :Ok, :Err].map { |name| api.const_get(name) }
  envelope, alias_pair = [:Envelope, :AliasPair].map { |name| api.const_get(name) }
  empty, box, choices = [:Empty, :Box, :Choices].map { |name| api.const_get(:Event).const_get(name) }
  inputs = [:first, :second, :combine, :nested, :event_first, :event_second,
            :echo, :aliases, :inspect_alias_pair, :echo_groups, :echo_pair,
            :echo_event, :plain_fin]
  inputs.each { |name| raise "incorrect input export selection: #{name}" if api.respond_to?(name) == result_only }
  fields = {envelope => [:payload, :digit], alias_pair => [:left, :right],
            empty => [], box => [:value], choices => [:values]}
  fields[api.const_get(:Pair)] = [:left, :right] unless result_only
  check = lambda do |condition, label|
    raise "failed: #{label}" unless condition
    checks += 1
  end
  snapshot = lambda do |value|
    kind = value.class
    if value.nil? || kind == Integer
      [kind, value]
    elsif kind == Array
      [Array, value.frozen?, value.map { |item| snapshot.call(item) }]
    elsif [some, ok, err].include?(kind)
      raise "unexpected wrapper members" unless value.members == [:value]
      [kind, value.frozen?, snapshot.call(value.value)]
    elsif fields.key?(kind)
      names = fields.fetch(kind)
      raise "unexpected record fields" unless value.instance_variables.sort == names.map { |name| :"@#{name}" }.sort
      [kind, value.frozen?, names.map { |name| [name, snapshot.call(value.instance_variable_get(:"@#{name}"))] }]
    else
      raise "unexpected snapshot type: #{kind}"
    end
  end
  call = lambda do |name, args, expected|
    before = snapshot.call(args)
    result = api.public_send(name, *args)
    check.call(snapshot.call(result) == snapshot.call(expected), "#{name} exact copied result")
    check.call(snapshot.call(args) == before, "#{name} complete inputs unchanged")
    result
  end
  refused = lambda do |name, args, path, constructor = nil, bound = nil|
    before = snapshot.call(args)
    message = bound ? "#{path} is not below its Fin #{bound} bound" : "#{path} was rejected by NominalSubtypes.#{constructor}"
    begin
      api.public_send(name, *args)
      raise "accepted: #{message}"
    rescue RangeError => error
      check.call(error.instance_of?(RangeError) && error.message == message, "exact refusal: #{message}; got #{error.message}")
    end
    check.call(snapshot.call(args) == before, "#{name} rejected inputs unchanged")
    rejections += 1
  end
  wrap = ->(value, digit = 2) { envelope.new(payload: value, digit: digit) }
  values = ->(value) { [nil, some.new(wrap.call(value + 1))] }
  huge = 2**100
  original = choices.new(values: [nil, some.new(ok.new(huge))])
  [choices.new(values: [nil, some.new(ok.new(huge + 1))]),
   choices.new(values: [nil, some.new(err.new(huge))]),
   choices.new(values: [some.new(ok.new(huge)), nil]), choices.new(values: [nil, nil]),
   choices.new(values: [nil, some.new(ok.new(huge)), nil]), box.new(value: wrap.call(huge)),
   empty.new, choices.new(values: [nil, ok.new(some.new(huge))])].each do |changed|
    check.call(snapshot.call(changed) != snapshot.call(original), "independent snapshot mutation control")
    snapshot_controls += 1
  end
  [0, 40, huge].each do |value|
    one, two = value + 1, value + 2
    call.call(:scalar, [value], one)
    call.call(:produce_envelope, [value], wrap.call(one))
    call.call(:array_values, [value], [one, two])
    call.call(:list_values, [value], [one, two])
    call.call(:optional, [value], value.zero? ? nil : some.new(one))
    call.call(:product, [value], [one, two])
    call.call(:branch, [value], value.zero? ? err.new(one) : ok.new(one))
    call.call(:group_values, [value], values.call(value))
    call.call(:pair_values, [value], alias_pair.new(left: values.call(value), right: values.call(one)))
    call.call(:event_value, [value], box.new(value: wrap.call(one)))
    call.call(:event_empty, [value], empty.new)
    call.call(:event_choices, [value], choices.new(values: [nil, some.new(ok.new(one)), some.new(err.new(two))]))
    call.call(:no_items, [value], [])
  end
  if result_only
    1000.times do |round|
      value = huge + round
      call.call(:pair_values, [value], alias_pair.new(left: values.call(value), right: values.call(value + 1)))
    end
    return {checks: checks, rejections: rejections, snapshotControls: snapshot_controls}
  end
  pair = api.const_get(:Pair)
  item = wrap.call(40)
  call.call(:first, [item], 41)
  call.call(:second, [item], 42)
  call.call(:combine, [item, item], 4142)
  call.call(:nested, [pair.new(left: item, right: item)], 4142)
  call.call(:first, [wrap.call(99)], 100)
  call.call(:second, [wrap.call(89)], 91)
  call.call(:first, [wrap.call(90)], 91)
  refused.call(:first, [wrap.call(100)], "arg0.payload", "plusOne")
  refused.call(:second, [wrap.call(90)], "arg0.payload", "plusTwo")
  refused.call(:combine, [wrap.call(100), item], "arg0.payload", "plusOne")
  refused.call(:combine, [item, wrap.call(90)], "arg1.payload", "plusTwo")
  refused.call(:nested, [pair.new(left: wrap.call(100), right: item)], "arg0.left.payload", "plusOne")
  refused.call(:nested, [pair.new(left: item, right: wrap.call(90))], "arg0.right.payload", "plusTwo")
  call.call(:echo, [item], wrap.call(41))
  [[:event_first, 1, 2], [:event_second, 2, 1]].each do |name, one, two|
    call.call(name, [empty.new], 0)
    call.call(name, [box.new(value: item)], 40 + one)
    call.call(name, [choices.new(values: [])], 0)
    call.call(name, [choices.new(values: [nil])], 0)
    call.call(name, [choices.new(values: [nil, some.new(ok.new(40))])], 40 + one)
    call.call(name, [choices.new(values: [some.new(err.new(40)), nil])], 40 + two)
    [["ok", ok, one], ["error", err, two]].each do |label, branch, amount|
      3.times do |position|
        items = [some.new(ok.new(40)), nil, some.new(err.new(40))]
        items[position] = some.new(branch.new(100))
        refused.call(name, [choices.new(values: items)], "arg0.choices.values[#{position}]?.#{label}", amount == 1 ? "plusOne" : "plusTwo")
      end
    end
  end
  left, right = [nil, some.new(item), some.new(wrap.call(1, 0))], [some.new(wrap.call(2, 1)), nil]
  normalized_left = [nil, some.new(wrap.call(41)), some.new(wrap.call(2, 0))]
  normalized_right = [some.new(wrap.call(4, 1)), nil]
  call.call(:aliases, [left, right], 47)
  call.call(:inspect_alias_pair, [alias_pair.new(left: left, right: right)], 47)
  call.call(:echo_groups, [left], normalized_left)
  projected = call.call(:echo_pair, [alias_pair.new(left: left, right: right)], alias_pair.new(left: normalized_left, right: normalized_right))
  call.call(:echo_pair, [projected], alias_pair.new(left: [nil, some.new(wrap.call(42)), some.new(wrap.call(3, 0))], right: [some.new(wrap.call(6, 1)), nil]))
  call.call(:echo_event, [choices.new(values: [nil, some.new(ok.new(40)), some.new(err.new(40))])], choices.new(values: [nil, some.new(ok.new(41)), some.new(err.new(42))]))
  call.call(:echo_event, [empty.new], empty.new)
  call.call(:echo_event, [box.new(value: item)], box.new(value: wrap.call(41)))
  call.call(:echo_groups, [[]], [])
  call.call(:echo_pair, [alias_pair.new(left: [], right: [nil])], alias_pair.new(left: [], right: [nil]))
  3.times do |position|
    bad = [some.new(item), nil, some.new(item)]
    bad[position] = some.new(wrap.call(100))
    refused.call(:echo_groups, [bad], "arg0[#{position}]?.payload", "plusOne")
    refused.call(:inspect_alias_pair, [alias_pair.new(left: bad, right: right)], "arg0.left[#{position}]?.payload", "plusOne")
    refused.call(:inspect_alias_pair, [alias_pair.new(left: left, right: bad)], "arg0.right[#{position}]?.payload", "plusTwo")
  end
  # Complete Fin checks precede an earlier failing Subtype constructor.
  refused.call(:combine, [wrap.call(100), wrap.call(40, 3)], "arg1.digit", nil, 3)
  refused.call(:nested, [pair.new(left: wrap.call(100), right: wrap.call(40, 3))], "arg0.right.digit", nil, 3)
  refused.call(:aliases, [[some.new(wrap.call(100))], [nil, some.new(wrap.call(40, 3))]], "arg1[1]?.digit", nil, 3)
  refused.call(:echo_event, [box.new(value: wrap.call(100, 3))], "arg0.box.value.digit", nil, 3)
  call.call(:plain_fin, [2], 2)
  refused.call(:plain_fin, [3], "arg0", nil, 3)
  1000.times do |round|
    position = round % 3
    bad = [nil, some.new(wrap.call(1)), nil]
    bad[position] = some.new(wrap.call(90))
    refused.call(:echo_pair, [alias_pair.new(left: left, right: bad)], "arg0.right[#{position}]?.payload", "plusTwo")
    call.call(:echo_pair, [alias_pair.new(left: left, right: right)], alias_pair.new(left: normalized_left, right: normalized_right))
  end
  {checks: checks, rejections: rejections, snapshotControls: snapshot_controls}
end

if $PROGRAM_NAME == __FILE__
  abort "usage: consumer.rb [--result-only]" unless [[], ["--result-only"]].include?(ARGV)
  require "lean_bridge/nominalsubtypes"
  puts JSON.generate(check_nominal_subtypes(LeanBridge::Nominalsubtypes, !ARGV.empty?))
end
