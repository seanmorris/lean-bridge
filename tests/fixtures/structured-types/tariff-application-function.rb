# Public Ruby application, loaded separately from the broker observer.
module DirectQuoteConsumer
  def self.checkpoint_cases(checkpoint)
    api = LeanBridge::TariffQuotes
    reject = ->(q, status) {
      begin
        q.call(900)
      rescue api::LeanBridgeError => e
        raise unless e.status == status
      else
        raise "stale registration entered application code"
      end
    }
    calls = []
    price = ->(n) { calls << n; 40 + n }
    stale = api.pass_application_quote(price)
    reject.call(stale, 10); stale.close
    raise unless calls.empty?
    checkpoint.call

    saved = []
    visit = ->(q, n) {
      saved.concat([q, q.retain]); raise unless q.call(0) == 40
      forwarded = api.pass_application_quote(q)
      begin
        forwarded.call(n)
      ensure
        forwarded.close
      end
    }
    raise unless api.visit_application_quote(price, visit, 2) == 42 && calls == [0, 2]
    reject.call(saved[0], 4); reject.call(saved[1], 10); saved[1].close
    checkpoint.call

    reply = ->(q, n) {
      fallback = api.make_tariff(800).quote
      forwarded = api.pass_application_quote(q)
      begin
        api.staged_quote(api.with_recovery(->(_) { forwarded }, fallback), 99, n)
      ensure
        forwarded.close; fallback.close
      end
    }
    raise unless api.visit_application_quote(price, reply, 3) == 43 && calls == [0, 2, 3]
    checkpoint.call

    nested = ->(outer, n) {
      held = nil
      inner = ->(q, m) { held = q.retain; outer.call(n) + q.call(m) }
      raise unless api.visit_application_quote(->(m) { 100 + m }, inner, 1) == 145
      reject.call(held, 10); held.close
      outer.call(n + 1)
    }
    raise unless api.visit_application_quote(price, nested, 4) == 45 && calls == [0, 2, 3, 4, 5]
    checkpoint.call

    original = RuntimeError.new("pricing callback failed")
    begin
      api.visit_application_quote(->(_) { raise original }, reply, 1)
    rescue RuntimeError => error
      raise unless error.equal?(original)
    else
      raise "recovery replaced the original failure"
    end
    # The nested activation must not switch fibers or remove the outer
    # guard when it returns. Unrelated threads still have independent fibers.
    switched = false
    switch = -> { Fiber.new { switched = true }.resume }
    guarded = -> {
      begin
        switch.call
      rescue FiberError => error
        raise unless error.message.include?("without switching Fibers")
      else
        raise "callback switched fiber"
      end
    }
    guarded_price = ->(n) { guarded.call; n + 30 }
    outer = ->(q, n) {
      raise unless q.call(n) == n + 30
      guarded.call
      raise unless Thread.new { Fiber.new { :ok }.resume }.value == :ok
      n
    }
    raise unless api.visit_application_quote(guarded_price, outer, 9) == 9
    raise if switched
    raise unless Fiber.new { :released }.resume == :released
    begin
      catch(:escape) { api.visit_application_quote(->(_) { throw :escape }, reply, 1) }
    rescue LocalJumpError
      # A nonlocal exit is contained at the foreign callback boundary.
    else
      raise "nonlocal exit escaped callback"
    end
    checkpoint.call

    genuine = api.make_tariff(900).quote
    kept = api.pass_application_quote(genuine)
    genuine.close; raise unless kept.call(6) == 906; kept.close
    raise unless api.visit_application_quote(price, ->(q, n) { q.call(n) }, 7) == 47
    raise unless calls == [0, 2, 3, 4, 5, 7]
    checkpoint.call
  end
end
