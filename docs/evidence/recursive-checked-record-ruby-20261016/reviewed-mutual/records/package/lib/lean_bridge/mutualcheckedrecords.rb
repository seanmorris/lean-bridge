# frozen_string_literal: true
module LeanBridge
  module Mutualcheckedrecords
    # Finite copied Lean values. Payload validation occurs at the call boundary.
    # Aliases retain their contract names and targets, not separate Ruby constants.
    # EnvelopeAlias = Envelope; Ruby: LeanBridge::Mutualcheckedrecords::Envelope
    UNIT = ::Object.new.freeze
    Some = ::Data.define(:value)
    module GraphValues
      EXACT = ::Object.instance_method(:instance_of?)
      CLASS = ::Object.instance_method(:class)
      FIELD = ::Object.instance_method(:instance_variable_get)
      FREEZE = ::Object.instance_method(:freeze)
    end
    class Envelope
      # value: nat
      # mode: nat
      # next_: option<Step>
      attr_reader :value, :mode, :next_
      def initialize(value:, mode:, next_:)
        @value = value
        @mode = mode
        @next_ = next_
        GraphValues::FREEZE.bind_call(self)
      end
      def ==(other)
        GraphValues::EXACT.bind_call(other, GraphValues::CLASS.bind_call(self)) && @value == GraphValues::FIELD.bind_call(other, :@value) && @mode == GraphValues::FIELD.bind_call(other, :@mode) && @next_ == GraphValues::FIELD.bind_call(other, :@next_)
      end
      def eql?(other)
        GraphValues::EXACT.bind_call(other, GraphValues::CLASS.bind_call(self)) && @value.eql?(GraphValues::FIELD.bind_call(other, :@value)) && @mode.eql?(GraphValues::FIELD.bind_call(other, :@mode)) && @next_.eql?(GraphValues::FIELD.bind_call(other, :@next_))
      end
      def hash
        [GraphValues::CLASS.bind_call(self), @value, @mode, @next_].hash
      end
      def deconstruct_keys(_keys)
        { value: @value, mode: @mode, next_: @next_ }
      end
    end
    class Step
      private_class_method :new
    end
    class Step::Stop < Step
      public_class_method :new

      def initialize()

        GraphValues::FREEZE.bind_call(self)
      end
      def ==(other)
        GraphValues::EXACT.bind_call(other, GraphValues::CLASS.bind_call(self))
      end
      def eql?(other)
        GraphValues::EXACT.bind_call(other, GraphValues::CLASS.bind_call(self))
      end
      def hash
        [GraphValues::CLASS.bind_call(self)].hash
      end
      def deconstruct_keys(_keys)
        {  }
      end
    end
    class Step::More < Step
      public_class_method :new
      # packet: Envelope
      attr_reader :packet
      def initialize(packet:)
        @packet = packet
        GraphValues::FREEZE.bind_call(self)
      end
      def ==(other)
        GraphValues::EXACT.bind_call(other, GraphValues::CLASS.bind_call(self)) && @packet == GraphValues::FIELD.bind_call(other, :@packet)
      end
      def eql?(other)
        GraphValues::EXACT.bind_call(other, GraphValues::CLASS.bind_call(self)) && @packet.eql?(GraphValues::FIELD.bind_call(other, :@packet))
      end
      def hash
        [GraphValues::CLASS.bind_call(self), @packet].hash
      end
      def deconstruct_keys(_keys)
        { packet: @packet }
      end
    end
    private_constant :GraphValues
  end
end

module LeanBridge
  module Mutualcheckedrecords
    class LeanBridgeError < ::StandardError
      attr_reader :status
      def initialize(status, message)
        super(message)
        @status = status
      end
    end
    module_function
    # arg0: Envelope
    # Returns: Envelope
    def echo(arg0)
      Native.call0(arg0)
    end
    # arg0: array<option<EnvelopeAlias>>
    # Returns: array<option<EnvelopeAlias>>
    def echo_groups(arg0)
      Native.call1(arg0)
    end
    # arg0: Envelope
    # Returns: nat
    def first(arg0)
      Native.call2(arg0)
    end
    # arg0: array<option<EnvelopeAlias>>
    # Returns: nat
    def groups(arg0)
      Native.call3(arg0)
    end
    # arg0: nat
    # Returns: Envelope
    def produce(arg0)
      Native.call4(arg0)
    end
    # arg0: Envelope
    # Returns: nat
    def second(arg0)
      Native.call5(arg0)
    end
  end
end
require_relative "mutualcheckedrecords/native"
