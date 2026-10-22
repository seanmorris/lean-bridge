# frozen_string_literal: true
module LeanBridge
  module NativeCopiedRuntimeV1
    PID = ::Process.pid
    LOCK = ::Mutex.new
    STATE = { components: {}, handles: [] }
    def self.context_error
      return "Lean packages cannot be used from another Ractor" unless ::Ractor.current.equal?(::Ractor.main)
      return "Lean packages cannot be used after fork; start a fresh process" unless ::Process.pid == PID
      nil
    end
  end
  private_constant :NativeCopiedRuntimeV1
end
