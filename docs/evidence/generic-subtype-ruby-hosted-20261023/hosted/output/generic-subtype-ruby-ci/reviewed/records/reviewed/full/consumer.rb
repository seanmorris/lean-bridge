# Independent installed Ruby checks for closed generic Subtype compositions.
require "json"
require "lean_bridge/nominalsubtypes"

api = LeanBridge::Nominalsubtypes
generic = api.const_get(:GenericNat)
checks = rejections = 0
snapshot = lambda do |value|
  raise "unexpected value: #{value.class}" unless value.instance_of?(generic)
  raise "unexpected GenericNat fields" unless value.instance_variables.sort == [:@marker, :@value]
  [value.value, value.marker]
end
check = lambda do |condition, label|
  raise "failed: #{label}" unless condition
  checks += 1
end
make = ->(value, marker) { generic.new(value: value, marker: marker) }
call = lambda do |name, value, expected|
  before = snapshot.call(value)
  result = api.public_send(name, value)
  check.call(snapshot.call(result) == snapshot.call(expected), "#{name} exact copied result")
  check.call(snapshot.call(value) == before, "#{name} input unchanged")
end
scalar = lambda do |value, expected|
  before = snapshot.call(value)
  check.call(api.generic_use(value) == expected, "generic_use exact result")
  check.call(snapshot.call(value) == before, "generic_use input unchanged")
end
refused = lambda do |name, value, constructor|
  before = snapshot.call(value)
  message = "value0.value was rejected by NominalSubtypes.#{constructor}"
  begin
    api.public_send(name, value)
    raise "accepted: #{message}"
  rescue RangeError => error
    check.call(error.instance_of?(RangeError) && error.message == message, "#{name} exact refusal")
  end
  check.call(snapshot.call(value) == before, "#{name} rejected input unchanged")
  rejections += 1
end

scalar.call(make.call(40, 2), 43)
call.call(:echo_generic_first, make.call(40, 2), make.call(41, 2))
call.call(:echo_generic_second, make.call(40, 2), make.call(42, 2))
scalar.call(make.call(99, 7), 107)
call.call(:echo_generic_first, make.call(99, 7), make.call(100, 7))
refused.call(:generic_use, make.call(100, 2), "plusOne")
refused.call(:echo_generic_first, make.call(100, 2), "plusOne")
refused.call(:echo_generic_second, make.call(90, 2), "plusTwo")
call.call(:echo_generic_second, make.call(40, 2), make.call(42, 2))
puts JSON.generate(checks: checks, rejections: rejections)
