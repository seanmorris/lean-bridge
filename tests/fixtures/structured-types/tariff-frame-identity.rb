# Exercise the public Ruby API; the qualification driver loads the package.
api = LeanBridge::TariffQuotes
other = api.make_tariff(900)
saved = []
revise = lambda do |value|
  borrowed = value.quote
  retained = borrowed.retain
  raise "lost identity" unless borrowed == retained && retained == borrowed && borrowed != other.quote
  saved.push(borrowed, retained)
  value
end
raise "wrong reply" unless api.exchange_tariff(api.with_recovery(revise, other), 30, 3) == 33
borrowed, retained = saved
begin
  borrowed.call(5)
  raise "retaining a function kept the original borrow callable"
rescue api::LeanBridgeError => error
  raise unless error.status == 4
end
raise "lost lease" unless borrowed != retained && retained.call(5) == 35
retained.close
other.quote.close
