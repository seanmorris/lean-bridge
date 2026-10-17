# frozen_string_literal: true
module LeanBridge
  module Recursivecheckedrecords
    # Finite copied Lean values. Payload validation occurs at the call boundary.
    # Aliases retain their contract names and targets, not separate Ruby constants.
    # PacketAlias = Packet; Ruby: LeanBridge::Recursivecheckedrecords::Packet
    UNIT = ::Object.new.freeze
    Some = ::Data.define(:value)
    module GraphValues
      EXACT = ::Object.instance_method(:instance_of?)
      CLASS = ::Object.instance_method(:class)
      FIELD = ::Object.instance_method(:instance_variable_get)
      FREEZE = ::Object.instance_method(:freeze)
    end
    class Packet
      # value: nat
      # digit: nat
      # tail: option<Packet>
      attr_reader :value, :digit, :tail
      def initialize(value:, digit:, tail:)
        @value = value
        @digit = digit
        @tail = tail
        GraphValues::FREEZE.bind_call(self)
      end
      def ==(other)
        GraphValues::EXACT.bind_call(other, GraphValues::CLASS.bind_call(self)) && @value == GraphValues::FIELD.bind_call(other, :@value) && @digit == GraphValues::FIELD.bind_call(other, :@digit) && @tail == GraphValues::FIELD.bind_call(other, :@tail)
      end
      def eql?(other)
        GraphValues::EXACT.bind_call(other, GraphValues::CLASS.bind_call(self)) && @value.eql?(GraphValues::FIELD.bind_call(other, :@value)) && @digit.eql?(GraphValues::FIELD.bind_call(other, :@digit)) && @tail.eql?(GraphValues::FIELD.bind_call(other, :@tail))
      end
      def hash
        [GraphValues::CLASS.bind_call(self), @value, @digit, @tail].hash
      end
      def deconstruct_keys(_keys)
        { value: @value, digit: @digit, tail: @tail }
      end
    end
    private_constant :GraphValues
  end
end

module LeanBridge
  module Recursivecheckedrecords
    class LeanBridgeError < ::StandardError
      attr_reader :status
      def initialize(status, message)
        super(message)
        @status = status
      end
    end
    module_function
    # arg0: Packet
    # Returns: Packet
    def echo(arg0)
      Native.call0(arg0)
    end
    # arg0: array<option<PacketAlias>>
    # Returns: array<option<PacketAlias>>
    def echo_groups(arg0)
      Native.call1(arg0)
    end
    # arg0: Packet
    # Returns: nat
    def first(arg0)
      Native.call2(arg0)
    end
    # arg0: array<option<PacketAlias>>
    # Returns: nat
    def groups(arg0)
      Native.call3(arg0)
    end
    # arg0: nat
    # Returns: Packet
    def produce(arg0)
      Native.call4(arg0)
    end
    # arg0: Packet
    # Returns: nat
    def second(arg0)
      Native.call5(arg0)
    end
  end
end
require_relative "recursivecheckedrecords/native"
