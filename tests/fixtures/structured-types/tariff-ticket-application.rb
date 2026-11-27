# Public API only. A separate observer checks for native owners after each case.
module DirectQuoteConsumer
  def self.checkpoint_cases(checkpoint)
    api = LeanBridge::TariffQuotes
    [42, 71].each do |n|
      [:success, :failure, :retry].each do |mode|
        input = api.new_ticket(n)
        fallback = api.new_ticket(800)
        reply = api.new_ticket(n + 1)
        begin
          sentinel = RuntimeError.new("application rejected ticket")
          calls = []
          exchange = ->(ticket) {
            calls << api.ticket_serial(ticket)
            raise sentinel if mode == :failure
            reply
          }
          begin
            got = api.exchange_ticket(input, api.with_recovery(exchange, fallback))
            raise "substituted a recovery value or input" unless mode != :failure && got == n + 1
          rescue RuntimeError => error
            raise unless mode == :failure && error.equal?(sentinel)
          end
          raise "wrong callback argument" unless calls == [n]
          raise unless api.ticket_serial(input) == n && api.ticket_serial(fallback) == 800
        ensure
          reply.close; fallback.close; input.close
        end
        checkpoint.call
      end
    end
  end
end
