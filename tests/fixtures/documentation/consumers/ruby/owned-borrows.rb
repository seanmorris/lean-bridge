require "lean_bridge/owned_aggregates"

api = LeanBridge::OwnedAggregates
owner = api.new_ticket(42, "owner")
view = api.retain_ticket(owner)
independent = view.retain
puts api.serial(view.get)

owner.close
raise "Borrowed result outlived its owner" unless view.closed?
raise "Independent owner was lost" unless api.serial(independent.get) == 42
view.close
independent.close
