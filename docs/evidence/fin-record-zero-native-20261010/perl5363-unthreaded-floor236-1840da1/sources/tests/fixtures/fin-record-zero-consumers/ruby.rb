require "lean_bridge/finrecordzero"
API = LeanBridge::Finrecordzero
$checks = 0
def check(value, label)
  raise label unless value
  $checks += 1
end
def fields(member = nil, digit = 0)
  API::Fields.new(label: "kept", payload: [7, 2**100], array: member == "array" ? [digit] : [], list: member == "list" ? [digit] : [])
end
def refused(call, build, path)
  value, before = build.call, build.call
  begin
    call.call(value)
    false
  rescue RangeError => error
    error.message == "#{path} is not below its Fin 0 bound" && value == before
  end
end
[:array_records, :list_records].each do |name|
  call = API.method(name)
  check(call.call([]) == [], "empty record collection")
  [0, 1, 2**100].each do |digit|
    check(refused(call, -> { [API::Zero.new(digit: digit)] }, "arg0[0].digit"), "populated record collection")
  end
  check(call.call([]) == [], "record recovery")
end
check(API.field_collections(fields) == fields, "empty fields and result")
["array", "list"].each do |member|
  [0, 1, 2**100].each do |digit|
    check(refused(API.method(:field_collections), -> { fields(member, digit) }, "arg0.#{member}[0]"), "populated field")
  end
end
check(API.field_collections(fields) == fields, "field recovery")
[:array_fields, :list_fields].each do |name|
  call = API.method(name)
  check(call.call([]) == [], "empty outer collection")
  check(call.call(Array.new(3) { fields }) == Array.new(3) { fields }, "populated outer collection of empty fields")
  3.times do |index|
    ["array", "list"].each do |member|
      build = -> { Array.new(3) { |k| k == index ? fields(member) : fields } }
      check(refused(call, build, "arg0[#{index}].#{member}[0]"), "nested field rejection")
      check(call.call(Array.new(3) { fields }) == Array.new(3) { fields }, "nested field recovery")
    end
  end
end
1000.times do |index|
  check(API.field_collections(fields) == fields, "round valid")
  member = index.even? ? "array" : "list"
  check(refused(API.method(:field_collections), -> { fields(member, index) }, "arg0.#{member}[0]"), "round rejection")
end
puts "fin-record-zero-ok:#{$checks}"
