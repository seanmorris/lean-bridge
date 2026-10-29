require "lean_bridge/defaults"

API = LeanBridge::Defaults
$checks = 0
def check(condition)
  raise "Optional-parameter mismatch" unless condition
  $checks += 1
end

check(API.word == 7)
check(API.word(7) == 7)
check(API.word(11) == 11)

large = 184467440737095516160
check(API.natural == large)
check(API.natural(large) == large)
check(API.natural(11) == 11)

check(API.text == "Lean\nBridge")
check(API.text("Lean\nBridge") == "Lean\nBridge")
check(API.text("other") == "other")

check(API.character == "λ")
check(API.character("λ") == "λ")
check(API.character("猫") == "猫")

check(API.maybe.nil?)
check(API.maybe(nil).nil?)
check(API.maybe(API::Some.new(11)) == API::Some.new(11))

check(API.present == API::Some.new(9))
check(API.present(API::Some.new(9)) == API::Some.new(9))
check(API.present(nil).nil?)
check(API.present(API::Some.new(11)) == API::Some.new(11))

check(API.unit_value.equal?(API::UNIT))
check(API.unit_value(API::UNIT).equal?(API::UNIT))

[-> { API.word(nil) }, -> { API.natural(nil) }].each do |invalid|
  rejected = false
  begin
    invalid.call
  rescue TypeError
    rejected = true
  end
  check(rejected)
end

puts "optional-parameter-ruby:#{$checks}"
