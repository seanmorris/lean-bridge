# frozen_string_literal: true
module LeanBridge
  module Nominalsubtypes
    # Copied Lean aliases use their Ruby target values, not separate constants.
    # EnvelopeAlias = Envelope; Ruby: LeanBridge::Nominalsubtypes::Envelope
    UNIT = ::Object.new.freeze
    class LeanBridgeError < ::StandardError; end
    Some = ::Data.define(:value)
    Ok = ::Data.define(:value)
    Err = ::Data.define(:value)
    class Envelope
      # payload: nat
      # digit: nat
      attr_reader :payload, :digit
      def initialize(payload:, digit:)
        @payload = payload
        @digit = digit
        freeze
      end
      def ==(other)
        Native.exact?(other, self.class) && @payload == Native::STORED_FIELD.bind_call(other, :@payload) && @digit == Native::STORED_FIELD.bind_call(other, :@digit)
      end
      def eql?(other)
        Native.exact?(other, self.class) && @payload.eql?(Native::STORED_FIELD.bind_call(other, :@payload)) && @digit.eql?(Native::STORED_FIELD.bind_call(other, :@digit))
      end
      def hash
        [self.class, @payload, @digit].hash
      end
      def deconstruct_keys(_keys)
        { payload: @payload, digit: @digit }
      end
    end
    class AliasPair
      # left: array<option<EnvelopeAlias>>
      # right: array<option<EnvelopeAlias>>
      attr_reader :left, :right
      def initialize(left:, right:)
        @left = left
        @right = right
        freeze
      end
      def ==(other)
        Native.exact?(other, self.class) && @left == Native::STORED_FIELD.bind_call(other, :@left) && @right == Native::STORED_FIELD.bind_call(other, :@right)
      end
      def eql?(other)
        Native.exact?(other, self.class) && @left.eql?(Native::STORED_FIELD.bind_call(other, :@left)) && @right.eql?(Native::STORED_FIELD.bind_call(other, :@right))
      end
      def hash
        [self.class, @left, @right].hash
      end
      def deconstruct_keys(_keys)
        { left: @left, right: @right }
      end
    end
    class Pair
      # left: Envelope
      # right: Envelope
      attr_reader :left, :right
      def initialize(left:, right:)
        @left = left
        @right = right
        freeze
      end
      def ==(other)
        Native.exact?(other, self.class) && @left == Native::STORED_FIELD.bind_call(other, :@left) && @right == Native::STORED_FIELD.bind_call(other, :@right)
      end
      def eql?(other)
        Native.exact?(other, self.class) && @left.eql?(Native::STORED_FIELD.bind_call(other, :@left)) && @right.eql?(Native::STORED_FIELD.bind_call(other, :@right))
      end
      def hash
        [self.class, @left, @right].hash
      end
      def deconstruct_keys(_keys)
        { left: @left, right: @right }
      end
    end
    class Event
      private_class_method :new
    end
    class Event::Empty < Event
      public_class_method :new
      
      def initialize()

        freeze
      end
      def ==(other)
        Native.exact?(other, self.class)
      end
      def eql?(other)
        Native.exact?(other, self.class)
      end
      def hash
        [self.class].hash
      end
      def deconstruct_keys(_keys)
        {  }
      end
    end
    class Event::Box < Event
      public_class_method :new
      # value: Envelope
      attr_reader :value
      def initialize(value:)
        @value = value
        freeze
      end
      def ==(other)
        Native.exact?(other, self.class) && @value == Native::STORED_FIELD.bind_call(other, :@value)
      end
      def eql?(other)
        Native.exact?(other, self.class) && @value.eql?(Native::STORED_FIELD.bind_call(other, :@value))
      end
      def hash
        [self.class, @value].hash
      end
      def deconstruct_keys(_keys)
        { value: @value }
      end
    end
    class Event::Choices < Event
      public_class_method :new
      # values: array<option<result<nat, nat>>>
      attr_reader :values
      def initialize(values:)
        @values = values
        freeze
      end
      def ==(other)
        Native.exact?(other, self.class) && @values == Native::STORED_FIELD.bind_call(other, :@values)
      end
      def eql?(other)
        Native.exact?(other, self.class) && @values.eql?(Native::STORED_FIELD.bind_call(other, :@values))
      end
      def hash
        [self.class, @values].hash
      end
      def deconstruct_keys(_keys)
        { values: @values }
      end
    end
    module_function
    # arg0: array<option<EnvelopeAlias>>
    # arg1: array<option<EnvelopeAlias>>
    # Returns: nat
    # Checked Lean Fin bounds: arg0[*]?.payload checked by NominalSubtypes.plusOne; arg0[*]?.digit < 3; arg1[*]?.payload checked by NominalSubtypes.plusTwo; arg1[*]?.digit < 3.
    def aliases(arg0, arg1)
      
      Native.call0(arg0, arg1)
    end
    # arg0: nat
    # Returns: array<nat>
    # Checked Lean Fin bounds: result[*] projects the Subtype base value.
    def array_values(arg0)
      
      Native.call1(arg0)
    end
    # arg0: nat
    # Returns: result<nat, nat>
    # Checked Lean Fin bounds: result.ok projects the Subtype base value; result.error projects the Subtype base value.
    def branch(arg0)
      
      Native.call2(arg0)
    end
    # arg0: Envelope
    # arg1: Envelope
    # Returns: nat
    # Checked Lean Fin bounds: arg0.payload checked by NominalSubtypes.plusOne; arg0.digit < 3; arg1.payload checked by NominalSubtypes.plusTwo; arg1.digit < 3.
    def combine(arg0, arg1)
      
      Native.call3(arg0, arg1)
    end
    # arg0: Envelope
    # Returns: Envelope
    # Checked Lean Fin bounds: arg0.payload checked by NominalSubtypes.plusOne; arg0.digit < 3; result.payload projects the Subtype base value; result.digit < 3.
    def echo(arg0)
      
      Native.call4(arg0)
    end
    # arg0: Event
    # Returns: Event
    # Checked Lean Fin bounds: arg0.box.value.payload checked by NominalSubtypes.plusOne; arg0.box.value.digit < 3; arg0.choices.values[*]?.ok checked by NominalSubtypes.plusOne; arg0.choices.values[*]?.error checked by NominalSubtypes.plusTwo; result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.
    def echo_event(arg0)
      
      Native.call5(arg0)
    end
    # arg0: array<option<EnvelopeAlias>>
    # Returns: array<option<EnvelopeAlias>>
    # Checked Lean Fin bounds: arg0[*]?.payload checked by NominalSubtypes.plusOne; arg0[*]?.digit < 3; result[*]?.payload projects the Subtype base value; result[*]?.digit < 3.
    def echo_groups(arg0)
      
      Native.call6(arg0)
    end
    # arg0: AliasPair
    # Returns: AliasPair
    # Checked Lean Fin bounds: arg0.left[*]?.payload checked by NominalSubtypes.plusOne; arg0.left[*]?.digit < 3; arg0.right[*]?.payload checked by NominalSubtypes.plusTwo; arg0.right[*]?.digit < 3; result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit < 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit < 3.
    def echo_pair(arg0)
      
      Native.call7(arg0)
    end
    # arg0: nat
    # Returns: Event
    # Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.
    def event_choices(arg0)
      
      Native.call8(arg0)
    end
    # arg0: nat
    # Returns: Event
    # Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.
    def event_empty(arg0)
      
      Native.call9(arg0)
    end
    # arg0: Event
    # Returns: nat
    # Checked Lean Fin bounds: arg0.box.value.payload checked by NominalSubtypes.plusOne; arg0.box.value.digit < 3; arg0.choices.values[*]?.ok checked by NominalSubtypes.plusOne; arg0.choices.values[*]?.error checked by NominalSubtypes.plusTwo.
    def event_first(arg0)
      
      Native.call10(arg0)
    end
    # arg0: Event
    # Returns: nat
    # Checked Lean Fin bounds: arg0.box.value.payload checked by NominalSubtypes.plusTwo; arg0.box.value.digit < 3; arg0.choices.values[*]?.ok checked by NominalSubtypes.plusTwo; arg0.choices.values[*]?.error checked by NominalSubtypes.plusOne.
    def event_second(arg0)
      
      Native.call11(arg0)
    end
    # arg0: nat
    # Returns: Event
    # Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.
    def event_value(arg0)
      
      Native.call12(arg0)
    end
    # arg0: Envelope
    # Returns: nat
    # Checked Lean Fin bounds: arg0.payload checked by NominalSubtypes.plusOne; arg0.digit < 3.
    def first(arg0)
      
      Native.call13(arg0)
    end
    # arg0: nat
    # Returns: array<option<EnvelopeAlias>>
    # Checked Lean Fin bounds: result[*]?.payload projects the Subtype base value; result[*]?.digit < 3.
    def group_values(arg0)
      
      Native.call14(arg0)
    end
    # arg0: AliasPair
    # Returns: nat
    # Checked Lean Fin bounds: arg0.left[*]?.payload checked by NominalSubtypes.plusOne; arg0.left[*]?.digit < 3; arg0.right[*]?.payload checked by NominalSubtypes.plusTwo; arg0.right[*]?.digit < 3.
    def inspect_alias_pair(arg0)
      
      Native.call15(arg0)
    end
    # arg0: nat
    # Returns: list<nat>
    # Checked Lean Fin bounds: result[*] projects the Subtype base value.
    def list_values(arg0)
      
      Native.call16(arg0)
    end
    # arg0: Pair
    # Returns: nat
    # Checked Lean Fin bounds: arg0.left.payload checked by NominalSubtypes.plusOne; arg0.left.digit < 3; arg0.right.payload checked by NominalSubtypes.plusTwo; arg0.right.digit < 3.
    def nested(arg0)
      
      Native.call17(arg0)
    end
    # arg0: nat
    # Returns: array<nat>
    # Checked Lean Fin bounds: result[*] projects the Subtype base value.
    def no_items(arg0)
      
      Native.call18(arg0)
    end
    # arg0: nat
    # Returns: option<nat>
    # Checked Lean Fin bounds: result? projects the Subtype base value.
    def optional(arg0)
      
      Native.call19(arg0)
    end
    # arg0: nat
    # Returns: AliasPair
    # Checked Lean Fin bounds: result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit < 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit < 3.
    def pair_values(arg0)
      
      Native.call20(arg0)
    end
    # arg0: nat
    # Returns: nat
    # Checked Lean Fin bounds: arg0 < 3.
    def plain_fin(arg0)
      
      Native.call21(arg0)
    end
    # arg0: nat
    # Returns: Envelope
    # Checked Lean Fin bounds: result.payload projects the Subtype base value; result.digit < 3.
    def produce_envelope(arg0)
      
      Native.call22(arg0)
    end
    # arg0: nat
    # Returns: tuple<nat, nat>
    # Checked Lean Fin bounds: result.0 projects the Subtype base value; result.1 projects the Subtype base value.
    def product(arg0)
      
      Native.call23(arg0)
    end
    # arg0: nat
    # Returns: nat
    # Checked Lean Fin bounds: result projects the Subtype base value.
    def scalar(arg0)
      
      Native.call24(arg0)
    end
    # arg0: Envelope
    # Returns: nat
    # Checked Lean Fin bounds: arg0.payload checked by NominalSubtypes.plusTwo; arg0.digit < 3.
    def second(arg0)
      
      Native.call25(arg0)
    end
  end
end
require_relative "nominalsubtypes/native"
LeanBridge::Nominalsubtypes.private_constant :Native
