require "lean_bridge/subtypes"
API = LeanBridge::Subtypes
$checks = 0
def check(value, label)
  raise "failed: #{label}" unless value
  $checks += 1
end
def rejected(parameter, constructor)
  yield
  false
rescue RangeError, ArgumentError => error
  error.message == "#{parameter} was rejected by #{constructor}"
end
def bound(parameter, limit)
  yield
  false
rescue RangeError => error
  error.message == "#{parameter} is not below its Fin #{limit} bound"
end
def raises(kind)
  yield
  false
rescue kind
  true
end
hello = "héllo \u{1F642}"
# Nonempty String: Unicode and embedded NUL are ordinary payloads; the empty string is rejected.
check(API.shout(hello) == "#{hello}!" && API.shout("a\0b") == "a\0b!", "shout")
check(rejected("arg0", "Subtypes.checkedWord") { API.shout("") }, "empty word")
check(raises(TypeError) { API.shout(3) }, "non-String is TypeError")
# Even Nat beyond 64 bits.
check(API.half(42) == 21 && API.half(2**100) == 2**99, "half")
check(rejected("arg0", "Subtypes.checkedEven") { API.half(7) }, "odd")
check(raises(RangeError) { API.half(-2) } && !rejected("arg0", "Subtypes.checkedEven") { API.half(-2) }, "negative is the Nat error")
# Small Int after an unchecked argument.
check(API.scale(-3, -128) == 384 && API.scale(-3, 127) == -381, "scale")
check(rejected("arg1", "Subtypes.checkedSmall") { API.scale(-3, 128) } && rejected("arg1", "Subtypes.checkedSmall") { API.scale(-3, -129) }, "late rejection")
# Nonempty ByteArray.
check(API.head("\0\xFF".b) == 0, "head")
check(rejected("arg0", "Subtypes.checkedPayload") { API.head("".b) }, "empty payload")
# A result-only subtype and two checked arguments.
check(API.pad(21) == 42 && API.join("ab", "cd") == "abcd", "pad and join")
check(rejected("arg1", "Subtypes.checkedWord") { API.join("ab", "") } && rejected("arg0", "Subtypes.checkedWord") { API.join("", "cd") }, "join rejections")
# A normalizing constructor: the export sees the constructed value.
check(API.clamp(250) == 100 && API.clamp(7) == 7, "clamp")
# A checked constructor beside a Fin bound: the Fin precheck runs first.
check(API.mix(4, 3) == 7, "mix")
check(bound("arg1", "10") { API.mix(4, 10) } && bound("arg1", "10") { API.mix(5, 10) }, "Fin before the constructor")
check(rejected("arg0", "Subtypes.checkedEven") { API.mix(5, 3) }, "odd beside a valid digit")
1000.times do |i|
  raise "invalid call accepted at #{i}" unless rejected("arg0", "Subtypes.checkedEven") { API.half(2 * i + 1) }
  raise "valid call failed at #{i}" unless API.half(2 * i) == i
end
$checks += 2000
puts "subtype-ok:#{$checks}"
