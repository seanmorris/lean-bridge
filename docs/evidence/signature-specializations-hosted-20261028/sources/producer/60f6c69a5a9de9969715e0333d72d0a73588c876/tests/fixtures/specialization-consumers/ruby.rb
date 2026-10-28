require "lean_bridge/specialized"
API = LeanBridge::Specialized
$checks = 0
def check(value)
  raise "Specialization mismatch" unless value
  $checks += 1
end
def rejected
  yield
  false
rescue TypeError, RangeError
  true
end
greeting = "héllo \u{1F642}"
# One generic declaration, three concrete exports; the open declaration is absent.
check(API.echo_word(0) == 0 && API.echo_word(2**32 - 1) == 2**32 - 1)
check(API.echo_text(greeting) == greeting && API.echo_text("") == "")
check(API.echo_nat(2**200) == 2**200)
words = [0, 42, 2**32 - 1]
check(API.echo_words(words) == words)
%i[echo choose first duplicate].each { |name| check(!API.respond_to?(name)) }
# Lean resolved each instance dictionary at build time.
check(API.choose_word(true, 5) == 5 && API.choose_word(false, 5) == 37)
check(API.choose_text(true, greeting) == greeting && API.choose_text(false, greeting) == "")
check(API.choose_words(true, words) == words && API.choose_words(false, words) == [])
check(API.double_word(2**31 + 1) == 2)
check(API.double_nat(2**100) == 2**101)
check(API.first_text_word(greeting, 9) == greeting)
check(API.plain(1) == 4)
# Each export keeps its own concrete argument checks.
check(rejected { API.echo_word(2**32) })
check(rejected { API.echo_word("1") })
check(rejected { API.echo_text(1) })
check(rejected { API.echo_nat(-1) })
check(rejected { API.first_text_word(9, greeting) })
1000.times do |i|
  check(API.choose_word(i.even?, i) == (i.even? ? i : 37))
  check(API.double_word(i) == 2 * i)
end
puts "specialization-ok:#{$checks}"
