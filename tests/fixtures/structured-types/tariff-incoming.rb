# The caller's Proc receives the Lean closure itself, not an object field.
module DirectQuoteConsumer
  def self.checkpoint_cases(checkpoint)
    api = LeanBridge::TariffQuotes
    expired = lambda do |q|
      begin
        q.call(1)
      rescue api::LeanBridgeError => error
        raise unless error.status == 4
      else
        raise "the original callback borrow escaped"
      end
    end
    original = RuntimeError.new("the application rejected the quote")
    [false, true].each do |keep|
      [false, true].each do |fail_call|
        saved = []
        visit = lambda do |q, n|
          saved << q
          if keep
            saved << q.retain
            raise "lost live identity" unless q == saved[1]
          end
          raise "wrong capture" unless q.call(n) == 42
          raise original if fail_call
          q.call(n)
        end
        begin
          value = api.visit_quote(40, visit, 2)
        rescue RuntimeError => error
          raise unless fail_call && error.equal?(original)
        else
          raise "lost result" unless !fail_call && value == 42
        end
        raise "extra dispatch" unless saved.length == (keep ? 2 : 1)
        expired.call(saved[0])
        if keep
          raise "lost lease" unless saved[0] != saved[1] && saved[1].call(5) == 45
          saved[1].close
          expired.call(saved[1])
        end
        checkpoint.call
      end
    end
    inner = []
    outer = lambda do |q, n|
      begin
        api.visit_quote(90, ->(other, m) {
          inner << other
          raise "aliased sibling" unless other != q && other.call(m) == 93
          raise original
        }, 3)
      rescue RuntimeError => error
        raise unless error.equal?(original)
      else
        raise "nested failure lost"
      end
      raise "extra nested dispatch" unless inner.length == 1
      expired.call(inner.first)
      q.call(n)
    end
    raise "outer borrow expired early" unless api.visit_quote(30, outer, 4) == 34
    checkpoint.call
    visit = ->(q,n) { q.call(n) }
    raise "stale capture" unless api.visit_quote(1, visit, 5) == 6 && api.visit_quote(60, visit, 3) == 63
    checkpoint.call
  end
end
