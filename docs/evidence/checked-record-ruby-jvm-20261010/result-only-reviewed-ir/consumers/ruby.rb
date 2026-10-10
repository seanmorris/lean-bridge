require "lean_bridge/checkedrecords"
API = LeanBridge::Checkedrecords
$checks = 0
def check(value)
  raise "checked-record assertion failed" unless value
  $checks += 1
end
big = 2**100
check(API.repeated(big).data == [big, big, big])
first = API.repeated(7)
second = API.repeated(7)
check(!first.equal?(second) && !first.data.equal?(second.data) && second.data == [7, 7, 7])
1000.times { |i| check(API.repeated(i).data == [i, i, i]) }
puts "checked-record-ok:#{$checks}"
