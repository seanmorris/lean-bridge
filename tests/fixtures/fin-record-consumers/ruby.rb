require "lean_bridge/finrecords"
API = LeanBridge::Finrecords
Some = API::Some
Tile = API::Tile
Nest = API::Nest
Late = API::Late
Slot = API::Slot
Shape = API::Shape
Gate = API::Gate
$checks = 0
def check(value, label)
  raise "failed: #{label}" unless value
  $checks += 1
end
def rejected(parameter, bound)
  yield
  false
rescue RangeError => error
  error.message == "#{parameter} is not below its Fin #{bound} bound"
end
def tile(digit, count)
  Tile.new(digit: digit, count: count)
end
# Tile: the digit is Fin 5; any count is valid. Each rejected input is compared with an
# independently built copy before the caller changes it back.
5.times { |d| check(API.tile_sum(tile(d, 10)) == d + 10, "tile #{d}") }
check(API.tile_sum(tile(3, 2**100)) == 2**100 + 3, "tile unbounded count")
t = tile(5, 2**100)
check(rejected("arg0", "5") { API.tile_sum(t) } && t == tile(5, 2**100), "tile at bound")
t = tile(2**70, 2**100)
check(rejected("arg0", "5") { API.tile_sum(t) } && t == tile(2**70, 2**100), "tile beyond 64 bits")
# Nest: the inner record's own bound and the outer bound are both checked.
nest = ->(digit, tag) { Nest.new(inner: tile(digit, 6), tag: tag) }
check(API.nest_sum(nest.(4, 2)) == 210, "nest valid")
n = nest.(5, 2)
check(rejected("arg0", "5") { API.nest_sum(n) } && n == nest.(5, 2), "nest inner at bound")
n = nest.(4, 3)
check(rejected("arg0", "3") { API.nest_sum(n) } && n == nest.(4, 3), "nest tag at bound")
check(API.nest_sum(nest.(4, 2)) == 210, "nest recovery")
# Late: heap fields precede the bound; a rejection leaves them as the caller built them.
items = [1, 2]
check(API.late_sum(Late.new(label: "ab", items: items, digit: 4)) == 4005, "late valid")
late = Late.new(label: "ab", items: items, digit: 5)
check(rejected("arg0", "5") { API.late_sum(late) } && late == Late.new(label: "ab", items: [1, 2], digit: 5) && items == [1, 2], "late at bound")
check(API.late_sum(Late.new(label: "ab", items: items, digit: 4)) == 4005, "late recovery")
# Slot: Option (Fin 0) is valid only when absent.
check(API.slot_count(Slot.new(maybe: nil, count: 8)) == 8, "slot absent")
slot = Slot.new(maybe: Some.new(0), count: 8)
check(rejected("arg0", "0") { API.slot_count(slot) } && slot == Slot.new(maybe: Some.new(0), count: 8), "slot present")
# Shape: only the active case is checked.
check(API.shape_size(Shape::Circle.new(radius: 9)) == 9, "circle valid")
shape = Shape::Circle.new(radius: 10)
check(rejected("arg0", "10") { API.shape_size(shape) } && shape == Shape::Circle.new(radius: 10), "circle at bound")
check(API.shape_size(Shape::Label.new(text: "abc")) == 1003, "label")
check(API.shape_size(Shape::Empty.new) == 7, "empty")
# Gate: the never case holds Fin 0, so it is always rejected; the closed case is always valid.
check(API.gate_open(Gate::Closed.new) == 1, "gate closed")
gate = Gate::Never.new(value: 0)
check(rejected("arg0", "0") { API.gate_open(gate) } && gate == Gate::Never.new(value: 0), "gate never")
# Array Tile: every element; the empty array is valid.
fresh = -> { [tile(0, 1), tile(4, 2), tile(1, 0)] }
row = fresh.()
check(API.tiles([]) == 0, "tiles empty")
check(API.tiles(row) == 8, "tiles valid")
3.times do |k|
  kept = row[k]
  row[k] = tile(5, kept.count)
  before = fresh.()
  before[k] = tile(5, before[k].count)
  check(rejected("arg0", "5") { API.tiles(row) } && row == before, "tiles element #{k}")
  row[k] = kept
end
check(API.tiles(row) == 8, "tiles recovery")
# Option Shape: absent, a valid present circle, then an invalid one.
check(API.maybe_shape(nil) == 99, "maybe absent")
check(API.maybe_shape(Some.new(Shape::Circle.new(radius: 3))) == 3, "maybe present")
maybe = Some.new(Shape::Circle.new(radius: 10))
check(rejected("arg0", "10") { API.maybe_shape(maybe) } && maybe == Some.new(Shape::Circle.new(radius: 10)), "maybe at bound")
# Results carrying bounds are produced by Lean and arrive below them.
check(API.bump(tile(4, 9)) == tile(0, 10), "bump")
t = tile(5, 9)
check(rejected("arg0", "5") { API.bump(t) } && t == tile(5, 9), "bump at bound")
check(API.make_shape(4) == Shape::Circle.new(radius: 4), "make circle")
check(API.make_shape(23) == Shape::Label.new(text: "23"), "make label")
1000.times do |i|
  raise "round #{i} failed" unless API.tile_sum(tile(i % 5, i)) == i % 5 + i
  t = tile(5 + i, i)
  raise "rejection round #{i} failed" unless rejected("arg0", "5") { API.tile_sum(t) } && t == tile(5 + i, i)
end
$checks += 2000
puts "fin-record-ok:#{$checks}"
