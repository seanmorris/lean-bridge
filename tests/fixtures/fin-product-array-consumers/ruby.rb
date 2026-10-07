require "lean_bridge/finproductarrays"
API = LeanBridge::Finproductarrays
Ok = API::Ok
Err = API::Err
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
# (0, ok 2^100), (2, error 5), (3, ok 6): both endpoints, and ok values no bound applies to.
valid = -> { [[0, Ok.new(2**100)], [2, Err.new(5)], [3, Ok.new(6)]] }
expected = 2**100 + 1016
# An empty array is valid, in and out.
check(API.rows([]) == 0, "empty rows")
check(API.reversed([]) == [], "empty reversed")
rows = valid.()
check(API.rows(rows) == expected, "valid rows")
# A component at its bound is rejected in the first, middle and last element.
3.times do |k|
  rows[k][0] = 4
  before = rows.map(&:dup)
  check(rejected("arg0", "4") { API.rows(rows) } && rows == before, "component at #{k}")
  rows[k][0] = valid.()[k][0]
end
# The active error branch is bounded: error 6 is rejected, while ok 6 in the last row passed above.
rows[1][1] = Err.new(6)
before = rows.map(&:dup)
check(rejected("arg0", "6") { API.rows(rows) } && rows == before, "error branch at bound")
rows[1][1] = Err.new(5)
# A valid call recovers.
check(rows == valid.(), "caller rows unchanged")
check(API.rows(rows) == expected, "recovery")
# Lean returns the rows reversed, each below its bounds.
check(API.reversed(rows) == valid.().reverse, "reversed")
1000.times do |i|
  raise "round #{i} failed" unless API.rows(rows) == expected
  rows[2][0] = 4 + i
  raise "rejection round #{i} failed" unless rejected("arg0", "4") { API.rows(rows) } && rows[2][0] == 4 + i
  rows[2][0] = 3
end
$checks += 2000
puts "fin-product-array-ok:#{$checks}"
