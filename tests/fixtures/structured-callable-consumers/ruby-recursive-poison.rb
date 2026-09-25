require 'lean_bridge/structured'
require 'json'
API = LeanBridge::Structured
Native = API.const_get(:Native, false)
layout = JSON.parse(ARGV.fetch(0))
function = Native.const_get("CALL#{layout.fetch('call')}")
original = function.method(:call)
function.define_singleton_method(:call) do |*args|
  result = original.call(*args)
  args.last[16, 4] = [(1 << 32) - 1].pack('L<')
  result
end
clears = 0
clear = Native::CLEAR.method(:call)
Native::CLEAR.define_singleton_method(:call) do |value|
  raise 'missing owner for poisoned result' if value[0, 8].unpack1('Q<').zero?
  result = clear.call(value)
  raise 'poisoned result owner remained' unless value[0, 16] == "\0" * 16
  clears += 1
  result
end
Native::RETIRE.define_singleton_method(:call) { nil } if ARGV[1] == 'mutant'
begin
  API.call_recursive(API::Tree::Leaf.new(value: 7)) { |value| value }
  raise 'malformed variant accepted'
rescue API::LeanBridgeError => error
  raise 'wrong malformed result error' unless error.status == 4
end
raise 'poisoned result was not cleared exactly once' unless clears == 1
Native::CLEAR.define_singleton_method(:call) { |value| clear.call(value) }
begin
  API.call_array([]) { |value| value }
rescue API::LeanBridgeError => error
  raise 'wrong retired runtime error' unless error.status == 5
else
  raise 'Retired runtime reentered'
end
puts 'malformed-output-retires-runtime'
