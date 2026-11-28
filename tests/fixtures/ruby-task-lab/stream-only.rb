# encoding: UTF-8
require "lean_bridge/ruby_signals"
api = LeanBridge::RubySignals
value = (1 << 4096) + 1
raise unless api.constant(value).take(2) == [value, value]
raise unless api.checked(0, false).to_a == []
begin
  api.checked(1, true)
  raise "an IO error was expected"
rescue api::IOError => e
  raise unless e.declaration == "Signals.checked" && e.message.include?("signal unavailable")
end
puts "Ruby: standalone cursor factories, exact integers, early close and empty stream passed"
