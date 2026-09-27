Process.setrlimit(Process::RLIMIT_CORE, 0)
require_relative "runtime"
require_relative "values"
require_relative "native"
require "json"

module Probe
  API = LeanBridge::OwnedAggregates
  Native = API.const_get(:Native, false)
  Owned = API.const_get(:Owned, false)
  LIBRARY = Fiddle.dlopen(ARGV.fetch(0))
  RUNTIME = Owned::Runtime.new(LIBRARY)
  Native.bind(RUNTIME)
  class AllocationFault < Exception; end
  @checks = 0
  @failures = []
  class << self
    attr_reader :checks, :failures
    def native(name, arguments = [], result = Fiddle::TYPE_SIZE_T)
      Fiddle::Function.new(LIBRARY[name], arguments, result, need_gvl: true)
    end
    def check(value, label = nil)
      raise "Ruby check #{@checks + 1} failed#{label ? ": #{label}" : ""}" unless value
      @checks += 1
    end
    def rejected(kind, status = nil)
      begin
        yield
      rescue *Array(kind) => error
        check(status.nil? || error.status == status, "expected status #{status}, got #{error.respond_to?(:status) ? error.status : error.class}")
        failures << error
        error
      else
        raise "Expected #{kind}"
      end
    end
    def counts; [LIVE.call, IDENTITIES.call]; end
    def state; RUNTIME.current_state; end
    def collect
      3.times { GC.start(full_mark: true, immediate_sweep: true) }
      state.require_open
    end
    def replace(value, **fields); value.class.new(**value.deconstruct_keys(nil).merge(fields)); end
    def dispose(value)
      case value
      when Owned::Resource then value.close
      when Array then value.each { |child| dispose(child) }
      when Data then value.deconstruct.each { |child| dispose(child) }
      else
        if value.respond_to?(:deconstruct_keys)
          value.deconstruct_keys(nil).each_value { |child| dispose(child) }
        end
      end
      nil
    end
    def equal_call(expected)
      result = yield
      check(result == expected)
      dispose(result)
    end
    def fail_ruby_after(point)
      remaining = point
      Owned.define_singleton_method(:checkpoint) do
        raise AllocationFault, "injected Ruby conversion allocation failure" if remaining.zero?
        remaining -= 1
      end
      begin
        yield
      ensure
        Owned.define_singleton_method(:checkpoint) {}
      end
    end
    def sweep
      collect
      baseline = counts
      checkpoints = 0
      Owned.define_singleton_method(:checkpoint) { checkpoints += 1 }
      begin
        value = yield
      ensure
        Owned.define_singleton_method(:checkpoint) {}
      end
      dispose(value)
      check(counts == baseline, "success releases immediately")
      check(checkpoints > 0 && checkpoints < 4096)
      ruby_faults = 0
      (checkpoints + 1).times do |point|
        begin
          result = fail_ruby_after(point) { yield }
        rescue AllocationFault => error
          failures << error
          ruby_faults += 1
          check(point < checkpoints)
        else
          check(point == checkpoints)
          dispose(result)
        end
        check(counts == baseline, "Ruby allocation rollback #{point}: #{counts}, expected #{baseline}")
      end
      check(ruby_faults == checkpoints)
      native_faults = 0
      2048.times do |point|
        NATIVE_FAIL.call(point)
        begin
          result = yield
        rescue Owned::Error => error
          failures << error
          check(error.status == 3)
          native_faults += 1
        else
          dispose(result)
          break
        ensure
          NATIVE_FAIL.call(-1)
        end
        check(counts == baseline, "native allocation rollback #{point}")
      end
      check(native_faults > 0 && native_faults < 2048)
      check(counts == baseline)
      {rubyCheckpoints: checkpoints, rubyFaults: ruby_faults, nativeFaults: native_faults}
    end
    def finish(details = {})
      state.close
      check(counts == [0, 0])
      puts JSON.generate({ruby: RUBY_DESCRIPTION, checks: checks, live: LIVE.call, identities: IDENTITIES.call}.merge(details))
    end
  end
  LIVE = native("owned_test_live")
  IDENTITIES = native("owned_test_identities")
  NATIVE_FAIL = native("owned_test_fail_after", [Fiddle::TYPE_SSIZE_T], Fiddle::TYPE_VOID)
end
