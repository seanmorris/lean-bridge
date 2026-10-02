require "lean_bridge/owned_aggregates"

api = LeanBridge::OwnedAggregates
ticket = api.new_ticket(42, "owner")
owner = api.copy_value(api::Tree::Leaf.new(ticket: ticket.get))
callback = api.make_recursive(owner.get)
view = callback.call(false, owner)
independent = view.retain
begin
  puts api.serial(view.get.ticket)
  owner.close
  raise "Callback result outlived its owner" unless view.closed?
  puts api.serial(independent.get.ticket)
ensure
  [ticket, owner, callback, view, independent].each(&:close)
end
