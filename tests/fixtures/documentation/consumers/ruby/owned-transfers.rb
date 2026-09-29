require "lean_bridge/owned_aggregates"

api = LeanBridge::OwnedAggregates
original = api.new_ticket(42, "shipment")
duplicate = original.dup
independent = original.retain

begin
  api.retain_ticket(original).with do |received|
    raise "Alias stayed open" unless original.closed? && duplicate.closed?
    raise "Changed value" unless api.serial(received) == 42
    raise "Independent owner closed" unless api.serial(independent) == 42
  end
ensure
  independent.close
end
puts "transferred"
