require "json"

# Independent public-API corpus. A synthetic API may be injected only by source-control tests.
def check_structural_subtypes(api)
  checks = 0
  rejections = 0
  snapshot_controls = 0
  some, ok, err = [:Some, :Ok, :Err].map { |name| api.const_get(name) }
  check = lambda do |condition, label|
    raise "failed: #{label}" unless condition
    checks += 1
  end
  snapshot = lambda do |value|
    if value.instance_of?(Array)
      [Array, value.frozen?, value.map { |item| snapshot.call(item) }]
    elsif [some, ok, err].include?(value.class)
      [value.class, value.frozen?, snapshot.call(value.value)]
    elsif value.instance_of?(String)
      [String, value.frozen?, value.encoding.name, value.bytes]
    elsif value.nil? || value.instance_of?(Integer)
      [value.class, value]
    else
      raise "unsupported snapshot: #{value.class}"
    end
  end
  refused = lambda do |name, args, path, constructor: nil, bound: nil|
    before = snapshot.call(args)
    expected = bound ? "#{path} is not below its Fin #{bound} bound" : "#{path} was rejected by StructuralSubtypes.#{constructor}"
    accepted = true
    begin
      api.public_send(name, *args)
    rescue RangeError => error
      check.call(error.message == expected, "refusal: #{expected}; got #{error.message}")
      accepted = false
    end
    raise "accepted: #{expected}" if accepted
    check.call(snapshot.call(args) == before, "complete rejected inputs unchanged")
    rejections += 1
  end
  huge, wide = 2**100, 10 * 2**64 + 10
  original = [[some.new(huge), nil], [some.new([255, "a\0tail"])]]
  mutations = [
    [[some.new(huge + 1), nil], original[1]],
    [[nil, nil], original[1]],
    [[some.new(huge), nil, nil], original[1]],
    [original[0], [some.new([254, "a\0tail"])]],
    [original[0], [some.new([255, "a\0changed"])]],
    [original[0], [nil]]
  ]
  mutations.each do |changed|
    check.call(snapshot.call(changed) != snapshot.call(original), "snapshot mutation control")
    snapshot_controls += 1
  end

  check.call(api.scalar(huge) == huge, "wide scalar")
  refused.call(:scalar, [0], "value0", constructor: "checkedPositive")
  [:arrays, :lists, :specialized].each do |name|
    check.call(api.public_send(name, []) == [], "#{name} empty")
    values = [1, huge, 3]
    check.call(api.public_send(name, values) == values, "#{name} wide values")
    3.times do |position|
      bad = values.dup
      bad[position] = 0
      refused.call(name, [bad], "value0[#{position}]", constructor: "checkedPositive")
    end
    check.call(api.public_send(name, values) == values, "#{name} recovery")
  end
  check.call(api.options(nil).nil?, "absent option")
  check.call(api.options(some.new(huge)) == some.new(huge), "present option")
  refused.call(:options, [some.new(0)], "value0?", constructor: "checkedPositive")
  text = "héllo\0tail\u{1F642}"
  check.call(api.product([huge, text]) == [huge, text], "Unicode and complete NUL suffix")
  refused.call(:product, [[0, text]], "value0.0", constructor: "checkedPositive")
  refused.call(:product, [[huge, ""]], "value0.1", constructor: "checkedWord")
  check.call(api.branch(ok.new(huge)) == ok.new(huge), "active ok")
  check.call(api.branch(err.new(text)) == err.new(text), "active error")
  refused.call(:branch, [ok.new(0)], "value0.ok", constructor: "checkedPositive")
  refused.call(:branch, [err.new("")], "value0.error", constructor: "checkedWord")
  bytes = [nil, some.new([255, huge])]
  check.call(api.byte_branches(bytes) == bytes, "UInt8 and Nat")
  refused.call(:byte_branches, [[nil, some.new([0, huge])]], "value0[1]?.0", constructor: "checkedByte")
  refused.call(:byte_branches, [[nil, some.new([1, 0])]], "value0[1]?.1", constructor: "checkedPositive")
  nested = [[nil, some.new([huge, wide - 1])], [], [some.new([2, 3])]]
  check.call(api.nested(nested) == 3, "nested valid")
  3.times do |row|
    3.times do |column|
      rows = Array.new(3) { Array.new(3) { some.new([huge, wide - 1]) } }
      rows[row][column] = some.new([0, wide])
      refused.call(:nested, [rows], "value0[#{row}][#{column}]?.1", bound: wide)
      rows[row][column] = some.new([0, wide - 1])
      refused.call(:nested, [rows], "value0[#{row}][#{column}]?.0", constructor: "checkedPositive")
      rows[row][column] = some.new([1, wide - 1])
      check.call(api.nested(rows) == 3, "nested recovery")
    end
  end
  first = [some.new(1), nil, some.new(huge)]
  second = [some.new(huge), some.new(3), nil]
  normalized = [some.new(huge + 1), some.new(4), nil]
  check.call(api.alias_pair([first, second]) == [first, normalized], "per-site alias constructors")
  check.call(api.alias_arguments(first, second) == first + normalized, "per-parameter constructors")
  check.call(api.plain_fin([nil, some.new(0), some.new(9)]) == 3, "Fin endpoints")
  refused.call(:plain_fin, [[some.new(10)]], "value0[0]?", bound: 10)
  3.times do |position|
    left = [some.new(1), some.new(huge), some.new(3)]
    left[position] = some.new(0)
    refused.call(:alias_pair, [[left, second]], "value0.0[#{position}]?", constructor: "checkedPositive")
    right = [some.new(huge), some.new(3), some.new(4)]
    right[position] = some.new(0)
    refused.call(:alias_pair, [[first, right]], "value0.1[#{position}]?", constructor: "normalizePositive")
  end
  1000.times do |round|
    late = [some.new(huge), some.new(3), some.new(4)]
    position = round % 3
    late[position] = some.new(0)
    refused.call(:alias_arguments, [first, late], "value1[#{position}]?", constructor: "normalizePositive")
    before = snapshot.call([first, second])
    check.call(api.alias_arguments(first, second) == first + normalized, "late recovery")
    check.call(snapshot.call([first, second]) == before, "normalization does not mutate either input")
  end
  {checks: checks, rejections: rejections, snapshotControls: snapshot_controls}
end

if $PROGRAM_NAME == __FILE__
  require "lean_bridge/structuralsubtypes"
  puts JSON.generate(check_structural_subtypes(LeanBridge::Structuralsubtypes))
end
