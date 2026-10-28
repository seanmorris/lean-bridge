require "lean_bridge/dependentfin"
API = LeanBridge::Dependentfin
$checks = 0
def check(value, label)
  raise "failed: #{label}" unless value
  $checks += 1
end
def rejected(parameter, bound)
  yield
  false
rescue RangeError => error
  error.message == "#{parameter} is not below its dependent Fin bound #{bound}"
end
def raises(kind)
  yield
  false
rescue kind
  true
end
huge = 2**70
word = 2**32
# Fin 0: the live bound zero has no values.
check(rejected("arg1", "arg0") { API.mirror(0, 0) }, "Fin 0 rejects zero")
check(rejected("arg1", "arg0") { API.mirror(0, 1) }, "Fin 0 rejects one")
# Fin 1: only zero.
check(API.mirror(1, 0) == 0, "Fin 1 accepts zero")
check(rejected("arg1", "arg0") { API.mirror(1, 1) }, "Fin 1 rejects its bound")
# The exact endpoints of a small live bound.
check(API.mirror(10, 0) == 9 && API.mirror(10, 9) == 0, "Fin 10 endpoints")
[10, 11, word, huge].each { |value| check(rejected("arg1", "arg0") { API.mirror(10, value) }, "Fin 10 rejects #{value}") }
# Live bounds wider than a machine word are compared limb by limb.
check(API.mirror(word, word - 1) == 0 && API.mirror(word + 1, word) == 0, "word bounds")
check(rejected("arg1", "arg0") { API.mirror(word, word) }, "word bound rejects itself")
check(API.mirror(huge, huge - 1) == 0 && API.mirror(huge, 0) == huge - 1, "huge endpoints")
check(API.mirror(huge + 1, huge) == 0, "one past a huge bound")
[huge, huge + 1, 2**128].each { |value| check(rejected("arg1", "arg0") { API.mirror(huge, value) }, "huge bound rejects #{value}") }
# The bound is the argument of this call, never a frozen constant.
12.times do |bound|
  if bound > 5
    check(API.mirror(bound, 5) == bound - 6, "value 5 below live bound #{bound}")
  else
    check(rejected("arg1", "arg0") { API.mirror(bound, 5) }, "value 5 at or above live bound #{bound}")
  end
end
# Only the named earlier parameter bounds the value, not an unrelated earlier Nat.
check(API.label(100, 3, 2, "slot") == "slot:102", "later dependency")
check(rejected("arg2", "arg1") { API.label(100, 3, 3, "slot") }, "bound is arg1, not the larger arg0")
check(rejected("arg2", "arg1") { API.label(100, 0, 0, "slot") }, "Fin 0 at a later site")
check(API.label(0, huge, huge - 1, "x") == "x:#{huge - 1}", "huge later bound")
# A negative Nat is the Nat error, not a dependent Fin rejection.
check(raises(RangeError) { API.mirror(-1, 0) } && !rejected("arg1", "arg0") { API.mirror(-1, 0) }, "negative bound")
check(raises(RangeError) { API.mirror(5, -1) } && !rejected("arg1", "arg0") { API.mirror(5, -1) }, "negative value")
check(raises(TypeError) { API.mirror(5, 1.5) }, "Float value is TypeError")
# Rejection leaves caller data unchanged.
start, bound, value, name = 7, 4, 4, +"slot"
check(rejected("arg2", "arg1") { API.label(start, bound, value, name) }, "rejected label")
check([start, bound, value, name] == [7, 4, 4, "slot"] && API.label(start, bound, 3, name) == "slot:10", "caller data unchanged")
# Repeated invalid and valid calls recover; the bound changes every call.
1000.times do |i|
  raise "invalid call accepted at #{i}" unless rejected("arg1", "arg0") { API.mirror(10, 10 + i % 5) }
  raise "valid call failed at #{i}" unless API.mirror(i % 7 + 1, i % 7) == 0 && API.mirror(10, i % 10) == 9 - i % 10
end
$checks += 2000
puts "dependent-fin-ok:#{$checks}"
