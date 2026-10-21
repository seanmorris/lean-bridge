# frozen_string_literal: true

# Independent contract oracle for the immutable dependent-record Ruby caller.
module DependentCheckedRecordRubyModel
  module_function

  def record_class
    Class.new do
      attr_reader :bound, :below
      def initialize(bound:, below:)
        @bound = bound
        @below = below
        freeze
      end
    end
  end

  def nat(value)
    raise TypeError, "Expected Integer" unless value.instance_of?(Integer)
    raise RangeError, "Nat cannot be negative" if value.negative?
    value
  end

  def build_api(result_only, prefix)
    api = Module.new
    dependent = record_class
    api.const_set(:Dependent, dependent)
    checked = lambda do |value|
      raise TypeError, "Expected Dependent" unless value.instance_of?(dependent)
      bound = nat(value.bound)
      below = nat(value.below)
      if below >= bound
        raise RangeError, "#{prefix}0 was rejected by DependentRecords.mkDependent"
      end
      [bound, below]
    end
    unless result_only
      api.define_singleton_method(:dependent_total) do |value|
        bound, below = checked.call(value)
        bound + below
      end
      api.define_singleton_method(:dependent_roundtrip) do |value|
        checked.call(value)
        value
      end
    end
    api.define_singleton_method(:dependent_result) do |seed|
      seed = DependentCheckedRecordRubyModel.nat(seed)
      dependent.new(bound: seed + 1, below: seed)
    end
    api
  end
end

unless ARGV.empty?
  caller = ARGV.shift
  load caller
  result_only = ARGV.include?("--result-only")
  reviewed = ARGV.include?("--reviewed")
  api = DependentCheckedRecordRubyModel.build_api(
    result_only, reviewed ? "value" : "arg"
  )
  puts JSON.generate(check_dependent_records(
    api, result_only, reviewed ? "value" : "arg"
  ))
end
