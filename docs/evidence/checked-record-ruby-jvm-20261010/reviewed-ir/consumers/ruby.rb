require "lean_bridge/checkedrecords"
API = LeanBridge::Checkedrecords
$checks = 0
def check(value)
  raise "checked-record assertion failed" unless value
  $checks += 1
end
# BEGIN CHECKED INPUT HELPERS
def rejected(message)
  yield
  false
rescue RangeError, ArgumentError => error
  error.message == message
end
# END CHECKED INPUT HELPERS
big = 2**100
# BEGIN CHECKED INPUT CASES
good = API::Interval.new(lo: 3, hi: 10)
bad = API::Interval.new(lo: 9, hi: 3)
values = [9, 2, 4]
triple = API::Triple.new(data: values)
check(API.width(good) == 7)
check(API.width(API::Interval.new(lo: 1, hi: 1)) == 0)
check(API.width(API::Interval.new(lo: big, hi: big + 9)) == 9)
check(API.span(good, API::Interval.new(lo: 5, hi: 20)) == 17)
check(rejected("value0 was rejected by CheckedRecords.mkInterval") { API.width(bad) })
check(rejected("value0 was rejected by CheckedRecords.mkInterval") { API.span(bad, good) })
check(rejected("value1 was rejected by CheckedRecords.mkInterval") { API.span(good, bad) })
check(API.total(triple) == 15)
check(API.first_of(triple) == 9)
check(API.smallest(triple) == 2)
check(triple.data == [9, 2, 4] && values == [9, 2, 4])
check(API.scale(3, triple).data == [27, 6, 12])
check(triple.data == [9, 2, 4] && values == [9, 2, 4])
check(rejected("value0 was rejected by CheckedRecords.mkTriple") { API.total(API::Triple.new(data: [])) })
check(rejected("value0 was rejected by CheckedRecords.mkTriple") { API.first_of(API::Triple.new(data: [1, 2])) })
check(rejected("value0 was rejected by CheckedRecords.sortedTriple") { API.smallest(API::Triple.new(data: [4, 3, 2, 1])) })
check(rejected("value1 was rejected by CheckedRecords.mkTriple") { API.scale(3, API::Triple.new(data: [1, 2])) })
check(API.complement(API::Percent.new(value: 0)) == 100)
check(API.complement(API::Percent.new(value: 100)) == 0)
check(rejected("value0 was rejected by CheckedRecords.mkPercent") { API.complement(API::Percent.new(value: 101)) })
check(rejected("value0 was rejected by CheckedRecords.mkPercent") { API.complement(API::Percent.new(value: big)) })
1000.times do |i|
  check(rejected("value0 was rejected by CheckedRecords.mkInterval") { API.width(API::Interval.new(lo: i + 1, hi: i)) })
  check(API.width(API::Interval.new(lo: i, hi: i + 7)) == 7)
  check(rejected("value0 was rejected by CheckedRecords.mkTriple") { API.total(API::Triple.new(data: [1, 2])) })
  check(API.total(triple) == 15)
  check(rejected("value0 was rejected by CheckedRecords.sortedTriple") { API.smallest(API::Triple.new(data: [4, 3, 2, 1])) })
  check(API.smallest(triple) == 2)
  check(rejected("value0 was rejected by CheckedRecords.mkPercent") { API.complement(API::Percent.new(value: 101)) })
  check(API.complement(API::Percent.new(value: 100)) == 0)
end
check(triple.data == [9, 2, 4] && values == [9, 2, 4] && good.lo == 3 && good.hi == 10 && bad.lo == 9 && bad.hi == 3)
# END CHECKED INPUT CASES
check(API.repeated(big).data == [big, big, big])
first = API.repeated(7)
second = API.repeated(7)
check(!first.equal?(second) && !first.data.equal?(second.data) && second.data == [7, 7, 7])
1000.times { |i| check(API.repeated(i).data == [i, i, i]) }
puts "checked-record-ok:#{$checks}"
