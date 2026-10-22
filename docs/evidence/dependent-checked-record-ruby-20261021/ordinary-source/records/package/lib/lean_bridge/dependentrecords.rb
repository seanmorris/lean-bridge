# frozen_string_literal: true
module LeanBridge
  module Dependentrecords
    UNIT = ::Object.new.freeze
    class LeanBridgeError < ::StandardError; end
    class Dependent
      attr_reader :bound, :below
      def initialize(bound:, below:)
        @bound = bound
        @below = below
        freeze
      end
      def ==(other)
        Native.exact?(other, self.class) && @bound == Native::STORED_FIELD.bind_call(other, :@bound) && @below == Native::STORED_FIELD.bind_call(other, :@below)
      end
      def eql?(other)
        Native.exact?(other, self.class) && @bound.eql?(Native::STORED_FIELD.bind_call(other, :@bound)) && @below.eql?(Native::STORED_FIELD.bind_call(other, :@below))
      end
      def hash
        [self.class, @bound, @below].hash
      end
      def deconstruct_keys(_keys)
        { bound: @bound, below: @below }
      end
    end
    module_function
    # Checked Lean Fin bounds: result projects proof-backed record payload fields; result.below < result.bound.
    def dependent_result(arg0)
      
      Native.call0(arg0)
    end
    # Checked Lean Fin bounds: arg0 checked by DependentRecords.mkDependent; arg0.below < arg0.bound; result projects proof-backed record payload fields; result.below < result.bound.
    def dependent_roundtrip(arg0)
      
      Native.call1(arg0)
    end
    # Checked Lean Fin bounds: arg0 checked by DependentRecords.mkDependent; arg0.below < arg0.bound.
    def dependent_total(arg0)
      
      Native.call2(arg0)
    end
  end
end
require_relative "dependentrecords/native"
LeanBridge::Dependentrecords.private_constant :Native
