require "lean_bridge/directprooferasure"

checks = 0
1005.times do |value|
  raise "payload changed" unless LeanBridge::Directprooferasure.keep(value) == value
  checks += 1
end
puts "direct-proof-ruby:#{checks}"
