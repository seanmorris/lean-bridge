require "lean_bridge/owned_aggregates"

api = LeanBridge::OwnedAggregates
owner = api.new_ticket(42, "owner")
view = owner.retain_ticket
independent = view.retain
begin
  puts owner.serial
  owner.close
  raise "Borrowed result outlived its owner" unless view.closed?
  puts independent.serial
ensure
  [owner, view, independent].each(&:close)
end
