# Installed Ruby acceptance for checked Fin callbacks and Lean closures.
require "lean_bridge/reviewedcallbacks"
API = LeanBridge::Reviewedcallbacks
$checks = 0
$calls = 0

def check(value, label)
  raise label unless value
  $checks += 1
end

def reject(kind = Exception)
  yield
  raise "expected rejection"
rescue kind => error
  error
end

scaler = API.scaler(3)
check(scaler.call(4) == 12, "bounded closure argument")
scaler_error = reject(RangeError) { scaler.call(10) }
check(scaler_error.message == "arg0 is not below its Fin 10 bound",
      "Fin 10 is refused")
check(scaler.call(9) == 27, "closure remains usable")

counter = API.counter(8)
check(counter.call(4) == 2, "Lean-produced Fin result")

host = proc do |value|
  $calls += 1
  raise "Lean supplied an invalid Fin" unless value >= 0 && value < 5
  value
end
check(API.visit(host) == 10,
      "checked host callback arguments")
check($calls == 5, "host receives every Fin 5 value")
sentinel = Class.new(StandardError).new("callback Fin sentinel")
check(reject { API.visit(proc { raise sentinel }) }.equal?(sentinel),
      "callback exception identity")
check(API.apply(proc { |value| value + 1 }, 2) == 3,
      "unrefined callback stays direct")

digits = API.digits(API::UNIT)
check(digits.call([1, 2]) == 5, "nested Fin callback argument")
nested_error = reject(RangeError) { digits.call([3]) }
check(nested_error.message == "arg0[0] is not below its Fin 3 bound",
      "nested bound is refused")
check(digits.call([]) == 0, "nested closure remains usable")

tiles = API.tiles(API::UNIT)
check(tiles.call([API::Tile.new(digit: 4, count: 2)]) == 402,
      "nominal Fin callback field")
tile_error = reject(RangeError) do
  tiles.call([API::Tile.new(digit: 5, count: 2)])
end
check(tile_error.message == "arg0[0].digit is not below its Fin 5 bound",
      "nominal Fin field is refused")

tile_maker = API.tile_maker(3)
check(tile_maker.call(4) == API::Tile.new(digit: 2, count: 4),
      "Lean-produced nominal Fin field")

[scaler, counter, digits, tiles, tile_maker].each do |closure|
  closure.close
  closure.close
  check(closure.closed?, "closure closes idempotently")
end

puts "callback-fin-language-ok:#{$checks}"
