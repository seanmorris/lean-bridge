# Public Ruby API only. The harness samples the independent broker after each
# case, with no result owner left alive. These checks also run on relocated gems.
def verify_tariff_inputs(api, checkpoint)
  check = ->(ok) { raise "wrong tariff result at #{caller(1, 1).first}" unless ok }
  rejected = ->(expected, &action) {
    begin
      action.call
    rescue api::LeanBridgeError => e
      check.call(expected == e.status)
    else
      raise "expected status #{expected}"
    end
  }
  wrong_type = ->(&action) {
    begin
      action.call
    rescue TypeError
      next
    end
    raise "expected a type error"
  }
  samples = {}
  sample = ->(name) { samples[name] = checkpoint.call }
  visits = 0
  host = api::TariffInput.new(quote: ->(n) { visits += 1; n + 40 })
  apply = api.method(:apply_tariff_with_host_fields)
  check.call(apply.call(host, 2) == 42 && visits == 1)
  sample.call(:direct)
  nested = api::TariffInput.new(quote: ->(n) { apply.call(host, n) + 1 })
  check.call(apply.call(nested, 2) == 43 && visits == 2)
  sample.call(:reentrant)
  escaped = api.echo_tariff_with_host_fields(host)
  extracted = api.unpack_quote_with_host_fields(host)
  begin
    check.call(escaped.instance_of?(api::Tariff))
    rejected.call(10) { escaped.quote.call(1) }
    rejected.call(10) { api.apply_tariff(escaped, 1) }
    rejected.call(10) { extracted.call(1) }
    check.call(visits == 2)
  ensure
    escaped.quote.close
    extracted.close
  end
  sample.call(:expired)
  fault = RuntimeError.new("application field failed")
  bad = api::TariffInput.new(quote: api.with_recovery(->(_n) { raise fault }, 7))
  begin
    apply.call(bad, 3)
    raise "swallowed application exception"
  rescue RuntimeError => e
    raise unless e.equal?(fault)
  end
  check.call(apply.call(host, 4) == 44 && visits == 3)
  sample.call(:recovered)
  wrong_type.call { apply.call(api::TariffInput.new(quote: nil), 1) }
  wrong_type.call { apply.call(api::Tariff.new(quote: host.quote), 1) }
  wrong_type.call { api.apply_tariff(host, 1) }
  check.call(visits == 3)
  sample.call(:validation)
  owned = api.make_tariff(40)
  borrowed = api::TariffInput.new(quote: owned.quote)
  begin
    check.call(apply.call(borrowed, 2) == 42 && apply.call(owned, 2) == 42)
    echo = api.echo_tariff_with_host_fields(borrowed)
  ensure
    owned.quote.close
  end
  begin
    check.call(echo.quote.call(3) == 43)
    rejected.call(4) { apply.call(borrowed, 2) }
  ensure
    echo.quote.close
  end
  sample.call(:leased)
  samples
end
