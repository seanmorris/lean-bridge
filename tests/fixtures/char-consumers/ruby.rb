require "lean_bridge/glyphs"
API = LeanBridge::Glyphs
POINTS = [__POINTS__]
VALUES = POINTS.map { |point| point.chr(Encoding::UTF_8) }
$checks = 0
def check(value)
  raise "Char check failed" unless value
  $checks += 1
end
POINTS.zip(VALUES).each do |point, value|
  check(API.keep(value) == value)
  check(API.point(value) == point)
  check(API.text(value) == value)
  check(API.choose(true, value, "x") == value)
  check(API.choose(false, "x", value) == value)
  check(API.keep_array(VALUES) == VALUES)
  label = API.keep_label(API::Label.new(marker: value, line: VALUES))
  check(label.marker == value && label.line == VALUES)
  check(API.keep_rows([VALUES, [], [value]]) == [VALUES, [], [value]])
end
check(API.sprout == "🌱")
check(API.keep_array([]) == [])
["", "ab", "e\u0301", "☀️", "🇨🇦", "\xed\xa0\x80".force_encoding(Encoding::UTF_8),
 "\xff".force_encoding(Encoding::UTF_8), 65, nil, true, ["a"]].each do |bad|
  [-> { API.keep(bad) }, -> { API.keep_array(["a", bad]) },
   -> { API.keep_rows([["a"], [bad]]) },
   -> { API.keep_label(API::Label.new(marker: bad, line: VALUES)) },
   -> { API.keep_label(API::Label.new(marker: "a", line: [bad])) }].each do |call|
    rejected = false
    begin
      call.call
    rescue TypeError, RangeError, EncodingError
      rejected = true
    end
    check(rejected)
    check(API.keep("🌱") == "🌱")
  end
end
1000.times { check(API.keep_rows([VALUES, VALUES]) == [VALUES, VALUES]) }
puts "char-ok:#{$checks}"
