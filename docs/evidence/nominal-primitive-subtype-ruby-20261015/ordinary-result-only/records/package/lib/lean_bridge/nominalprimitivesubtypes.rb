# frozen_string_literal: true
module LeanBridge
  module Nominalprimitivesubtypes
    # Copied Lean aliases use their Ruby target values, not separate constants.
    # PacketAlias = Packet; Ruby: LeanBridge::Nominalprimitivesubtypes::Packet
    UNIT = ::Object.new.freeze
    class LeanBridgeError < ::StandardError; end
    Some = ::Data.define(:value)
    Ok = ::Data.define(:value)
    Err = ::Data.define(:value)
    class RawPacket
      # unitValue: unit
      # boolValue: bool
      # uint8Value: uint8
      # uint16Value: uint16
      # uint32Value: uint32
      # uint64Value: uint64
      # int8Value: int8
      # int16Value: int16
      # int32Value: int32
      # int64Value: int64
      # natValue: nat
      # intValue: int
      # float32Value: float32
      # float64Value: float64
      # textValue: string
      # bytesValue: bytes
      # charValue: char
      # usizeValue: usize
      # isizeValue: isize
      # digit: nat
      attr_reader :unit_value, :bool_value, :uint8_value, :uint16_value, :uint32_value, :uint64_value, :int8_value, :int16_value, :int32_value, :int64_value, :nat_value, :int_value, :float32_value, :float64_value, :text_value, :bytes_value, :char_value, :usize_value, :isize_value, :digit
      def initialize(unit_value:, bool_value:, uint8_value:, uint16_value:, uint32_value:, uint64_value:, int8_value:, int16_value:, int32_value:, int64_value:, nat_value:, int_value:, float32_value:, float64_value:, text_value:, bytes_value:, char_value:, usize_value:, isize_value:, digit:)
        @unit_value = unit_value
        @bool_value = bool_value
        @uint8_value = uint8_value
        @uint16_value = uint16_value
        @uint32_value = uint32_value
        @uint64_value = uint64_value
        @int8_value = int8_value
        @int16_value = int16_value
        @int32_value = int32_value
        @int64_value = int64_value
        @nat_value = nat_value
        @int_value = int_value
        @float32_value = float32_value
        @float64_value = float64_value
        @text_value = text_value
        @bytes_value = bytes_value
        @char_value = char_value
        @usize_value = usize_value
        @isize_value = isize_value
        @digit = digit
        freeze
      end
      def ==(other)
        Native.exact?(other, self.class) && @unit_value == Native::STORED_FIELD.bind_call(other, :@unit_value) && @bool_value == Native::STORED_FIELD.bind_call(other, :@bool_value) && @uint8_value == Native::STORED_FIELD.bind_call(other, :@uint8_value) && @uint16_value == Native::STORED_FIELD.bind_call(other, :@uint16_value) && @uint32_value == Native::STORED_FIELD.bind_call(other, :@uint32_value) && @uint64_value == Native::STORED_FIELD.bind_call(other, :@uint64_value) && @int8_value == Native::STORED_FIELD.bind_call(other, :@int8_value) && @int16_value == Native::STORED_FIELD.bind_call(other, :@int16_value) && @int32_value == Native::STORED_FIELD.bind_call(other, :@int32_value) && @int64_value == Native::STORED_FIELD.bind_call(other, :@int64_value) && @nat_value == Native::STORED_FIELD.bind_call(other, :@nat_value) && @int_value == Native::STORED_FIELD.bind_call(other, :@int_value) && @float32_value == Native::STORED_FIELD.bind_call(other, :@float32_value) && @float64_value == Native::STORED_FIELD.bind_call(other, :@float64_value) && @text_value == Native::STORED_FIELD.bind_call(other, :@text_value) && @bytes_value == Native::STORED_FIELD.bind_call(other, :@bytes_value) && @char_value == Native::STORED_FIELD.bind_call(other, :@char_value) && @usize_value == Native::STORED_FIELD.bind_call(other, :@usize_value) && @isize_value == Native::STORED_FIELD.bind_call(other, :@isize_value) && @digit == Native::STORED_FIELD.bind_call(other, :@digit)
      end
      def eql?(other)
        Native.exact?(other, self.class) && @unit_value.eql?(Native::STORED_FIELD.bind_call(other, :@unit_value)) && @bool_value.eql?(Native::STORED_FIELD.bind_call(other, :@bool_value)) && @uint8_value.eql?(Native::STORED_FIELD.bind_call(other, :@uint8_value)) && @uint16_value.eql?(Native::STORED_FIELD.bind_call(other, :@uint16_value)) && @uint32_value.eql?(Native::STORED_FIELD.bind_call(other, :@uint32_value)) && @uint64_value.eql?(Native::STORED_FIELD.bind_call(other, :@uint64_value)) && @int8_value.eql?(Native::STORED_FIELD.bind_call(other, :@int8_value)) && @int16_value.eql?(Native::STORED_FIELD.bind_call(other, :@int16_value)) && @int32_value.eql?(Native::STORED_FIELD.bind_call(other, :@int32_value)) && @int64_value.eql?(Native::STORED_FIELD.bind_call(other, :@int64_value)) && @nat_value.eql?(Native::STORED_FIELD.bind_call(other, :@nat_value)) && @int_value.eql?(Native::STORED_FIELD.bind_call(other, :@int_value)) && @float32_value.eql?(Native::STORED_FIELD.bind_call(other, :@float32_value)) && @float64_value.eql?(Native::STORED_FIELD.bind_call(other, :@float64_value)) && @text_value.eql?(Native::STORED_FIELD.bind_call(other, :@text_value)) && @bytes_value.eql?(Native::STORED_FIELD.bind_call(other, :@bytes_value)) && @char_value.eql?(Native::STORED_FIELD.bind_call(other, :@char_value)) && @usize_value.eql?(Native::STORED_FIELD.bind_call(other, :@usize_value)) && @isize_value.eql?(Native::STORED_FIELD.bind_call(other, :@isize_value)) && @digit.eql?(Native::STORED_FIELD.bind_call(other, :@digit))
      end
      def hash
        [self.class, @unit_value, @bool_value, @uint8_value, @uint16_value, @uint32_value, @uint64_value, @int8_value, @int16_value, @int32_value, @int64_value, @nat_value, @int_value, @float32_value, @float64_value, @text_value, @bytes_value, @char_value, @usize_value, @isize_value, @digit].hash
      end
      def deconstruct_keys(_keys)
        { unit_value: @unit_value, bool_value: @bool_value, uint8_value: @uint8_value, uint16_value: @uint16_value, uint32_value: @uint32_value, uint64_value: @uint64_value, int8_value: @int8_value, int16_value: @int16_value, int32_value: @int32_value, int64_value: @int64_value, nat_value: @nat_value, int_value: @int_value, float32_value: @float32_value, float64_value: @float64_value, text_value: @text_value, bytes_value: @bytes_value, char_value: @char_value, usize_value: @usize_value, isize_value: @isize_value, digit: @digit }
      end
    end
    class Packet
      # unitValue: unit
      # boolValue: bool
      # uint8Value: uint8
      # uint16Value: uint16
      # uint32Value: uint32
      # uint64Value: uint64
      # int8Value: int8
      # int16Value: int16
      # int32Value: int32
      # int64Value: int64
      # natValue: nat
      # intValue: int
      # float32Value: float32
      # float64Value: float64
      # textValue: string
      # bytesValue: bytes
      # charValue: char
      # usizeValue: usize
      # isizeValue: isize
      # digit: nat
      attr_reader :unit_value, :bool_value, :uint8_value, :uint16_value, :uint32_value, :uint64_value, :int8_value, :int16_value, :int32_value, :int64_value, :nat_value, :int_value, :float32_value, :float64_value, :text_value, :bytes_value, :char_value, :usize_value, :isize_value, :digit
      def initialize(unit_value:, bool_value:, uint8_value:, uint16_value:, uint32_value:, uint64_value:, int8_value:, int16_value:, int32_value:, int64_value:, nat_value:, int_value:, float32_value:, float64_value:, text_value:, bytes_value:, char_value:, usize_value:, isize_value:, digit:)
        @unit_value = unit_value
        @bool_value = bool_value
        @uint8_value = uint8_value
        @uint16_value = uint16_value
        @uint32_value = uint32_value
        @uint64_value = uint64_value
        @int8_value = int8_value
        @int16_value = int16_value
        @int32_value = int32_value
        @int64_value = int64_value
        @nat_value = nat_value
        @int_value = int_value
        @float32_value = float32_value
        @float64_value = float64_value
        @text_value = text_value
        @bytes_value = bytes_value
        @char_value = char_value
        @usize_value = usize_value
        @isize_value = isize_value
        @digit = digit
        freeze
      end
      def ==(other)
        Native.exact?(other, self.class) && @unit_value == Native::STORED_FIELD.bind_call(other, :@unit_value) && @bool_value == Native::STORED_FIELD.bind_call(other, :@bool_value) && @uint8_value == Native::STORED_FIELD.bind_call(other, :@uint8_value) && @uint16_value == Native::STORED_FIELD.bind_call(other, :@uint16_value) && @uint32_value == Native::STORED_FIELD.bind_call(other, :@uint32_value) && @uint64_value == Native::STORED_FIELD.bind_call(other, :@uint64_value) && @int8_value == Native::STORED_FIELD.bind_call(other, :@int8_value) && @int16_value == Native::STORED_FIELD.bind_call(other, :@int16_value) && @int32_value == Native::STORED_FIELD.bind_call(other, :@int32_value) && @int64_value == Native::STORED_FIELD.bind_call(other, :@int64_value) && @nat_value == Native::STORED_FIELD.bind_call(other, :@nat_value) && @int_value == Native::STORED_FIELD.bind_call(other, :@int_value) && @float32_value == Native::STORED_FIELD.bind_call(other, :@float32_value) && @float64_value == Native::STORED_FIELD.bind_call(other, :@float64_value) && @text_value == Native::STORED_FIELD.bind_call(other, :@text_value) && @bytes_value == Native::STORED_FIELD.bind_call(other, :@bytes_value) && @char_value == Native::STORED_FIELD.bind_call(other, :@char_value) && @usize_value == Native::STORED_FIELD.bind_call(other, :@usize_value) && @isize_value == Native::STORED_FIELD.bind_call(other, :@isize_value) && @digit == Native::STORED_FIELD.bind_call(other, :@digit)
      end
      def eql?(other)
        Native.exact?(other, self.class) && @unit_value.eql?(Native::STORED_FIELD.bind_call(other, :@unit_value)) && @bool_value.eql?(Native::STORED_FIELD.bind_call(other, :@bool_value)) && @uint8_value.eql?(Native::STORED_FIELD.bind_call(other, :@uint8_value)) && @uint16_value.eql?(Native::STORED_FIELD.bind_call(other, :@uint16_value)) && @uint32_value.eql?(Native::STORED_FIELD.bind_call(other, :@uint32_value)) && @uint64_value.eql?(Native::STORED_FIELD.bind_call(other, :@uint64_value)) && @int8_value.eql?(Native::STORED_FIELD.bind_call(other, :@int8_value)) && @int16_value.eql?(Native::STORED_FIELD.bind_call(other, :@int16_value)) && @int32_value.eql?(Native::STORED_FIELD.bind_call(other, :@int32_value)) && @int64_value.eql?(Native::STORED_FIELD.bind_call(other, :@int64_value)) && @nat_value.eql?(Native::STORED_FIELD.bind_call(other, :@nat_value)) && @int_value.eql?(Native::STORED_FIELD.bind_call(other, :@int_value)) && @float32_value.eql?(Native::STORED_FIELD.bind_call(other, :@float32_value)) && @float64_value.eql?(Native::STORED_FIELD.bind_call(other, :@float64_value)) && @text_value.eql?(Native::STORED_FIELD.bind_call(other, :@text_value)) && @bytes_value.eql?(Native::STORED_FIELD.bind_call(other, :@bytes_value)) && @char_value.eql?(Native::STORED_FIELD.bind_call(other, :@char_value)) && @usize_value.eql?(Native::STORED_FIELD.bind_call(other, :@usize_value)) && @isize_value.eql?(Native::STORED_FIELD.bind_call(other, :@isize_value)) && @digit.eql?(Native::STORED_FIELD.bind_call(other, :@digit))
      end
      def hash
        [self.class, @unit_value, @bool_value, @uint8_value, @uint16_value, @uint32_value, @uint64_value, @int8_value, @int16_value, @int32_value, @int64_value, @nat_value, @int_value, @float32_value, @float64_value, @text_value, @bytes_value, @char_value, @usize_value, @isize_value, @digit].hash
      end
      def deconstruct_keys(_keys)
        { unit_value: @unit_value, bool_value: @bool_value, uint8_value: @uint8_value, uint16_value: @uint16_value, uint32_value: @uint32_value, uint64_value: @uint64_value, int8_value: @int8_value, int16_value: @int16_value, int32_value: @int32_value, int64_value: @int64_value, nat_value: @nat_value, int_value: @int_value, float32_value: @float32_value, float64_value: @float64_value, text_value: @text_value, bytes_value: @bytes_value, char_value: @char_value, usize_value: @usize_value, isize_value: @isize_value, digit: @digit }
      end
    end
    class Pair
      # left: array<option<PacketAlias>>
      # right: array<option<PacketAlias>>
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
      # value: Packet
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
      # values: array<option<result<Packet, Packet>>>
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
    # arg0: RawPacket
    # Returns: option<Packet>
    # Checked Lean Fin bounds: result?.unitValue projects the Subtype base value; result?.boolValue projects the Subtype base value; result?.uint8Value projects the Subtype base value; result?.uint16Value projects the Subtype base value; result?.uint32Value projects the Subtype base value; result?.uint64Value projects the Subtype base value; result?.int8Value projects the Subtype base value; result?.int16Value projects the Subtype base value; result?.int32Value projects the Subtype base value; result?.int64Value projects the Subtype base value; result?.natValue projects the Subtype base value; result?.intValue projects the Subtype base value; result?.float32Value projects the Subtype base value; result?.float64Value projects the Subtype base value; result?.textValue projects the Subtype base value; result?.bytesValue projects the Subtype base value; result?.charValue projects the Subtype base value; result?.usizeValue projects the Subtype base value; result?.isizeValue projects the Subtype base value; result?.digit < 3.
    def produce(arg0)
      
      Native.call0(arg0)
    end
    # arg0: RawPacket
    # Returns: Event
    # Checked Lean Fin bounds: result.box.value.unitValue projects the Subtype base value; result.box.value.boolValue projects the Subtype base value; result.box.value.uint8Value projects the Subtype base value; result.box.value.uint16Value projects the Subtype base value; result.box.value.uint32Value projects the Subtype base value; result.box.value.uint64Value projects the Subtype base value; result.box.value.int8Value projects the Subtype base value; result.box.value.int16Value projects the Subtype base value; result.box.value.int32Value projects the Subtype base value; result.box.value.int64Value projects the Subtype base value; result.box.value.natValue projects the Subtype base value; result.box.value.intValue projects the Subtype base value; result.box.value.float32Value projects the Subtype base value; result.box.value.float64Value projects the Subtype base value; result.box.value.textValue projects the Subtype base value; result.box.value.bytesValue projects the Subtype base value; result.box.value.charValue projects the Subtype base value; result.box.value.usizeValue projects the Subtype base value; result.box.value.isizeValue projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok.unitValue projects the Subtype base value; result.choices.values[*]?.ok.boolValue projects the Subtype base value; result.choices.values[*]?.ok.uint8Value projects the Subtype base value; result.choices.values[*]?.ok.uint16Value projects the Subtype base value; result.choices.values[*]?.ok.uint32Value projects the Subtype base value; result.choices.values[*]?.ok.uint64Value projects the Subtype base value; result.choices.values[*]?.ok.int8Value projects the Subtype base value; result.choices.values[*]?.ok.int16Value projects the Subtype base value; result.choices.values[*]?.ok.int32Value projects the Subtype base value; result.choices.values[*]?.ok.int64Value projects the Subtype base value; result.choices.values[*]?.ok.natValue projects the Subtype base value; result.choices.values[*]?.ok.intValue projects the Subtype base value; result.choices.values[*]?.ok.float32Value projects the Subtype base value; result.choices.values[*]?.ok.float64Value projects the Subtype base value; result.choices.values[*]?.ok.textValue projects the Subtype base value; result.choices.values[*]?.ok.bytesValue projects the Subtype base value; result.choices.values[*]?.ok.charValue projects the Subtype base value; result.choices.values[*]?.ok.usizeValue projects the Subtype base value; result.choices.values[*]?.ok.isizeValue projects the Subtype base value; result.choices.values[*]?.ok.digit < 3; result.choices.values[*]?.error.unitValue projects the Subtype base value; result.choices.values[*]?.error.boolValue projects the Subtype base value; result.choices.values[*]?.error.uint8Value projects the Subtype base value; result.choices.values[*]?.error.uint16Value projects the Subtype base value; result.choices.values[*]?.error.uint32Value projects the Subtype base value; result.choices.values[*]?.error.uint64Value projects the Subtype base value; result.choices.values[*]?.error.int8Value projects the Subtype base value; result.choices.values[*]?.error.int16Value projects the Subtype base value; result.choices.values[*]?.error.int32Value projects the Subtype base value; result.choices.values[*]?.error.int64Value projects the Subtype base value; result.choices.values[*]?.error.natValue projects the Subtype base value; result.choices.values[*]?.error.intValue projects the Subtype base value; result.choices.values[*]?.error.float32Value projects the Subtype base value; result.choices.values[*]?.error.float64Value projects the Subtype base value; result.choices.values[*]?.error.textValue projects the Subtype base value; result.choices.values[*]?.error.bytesValue projects the Subtype base value; result.choices.values[*]?.error.charValue projects the Subtype base value; result.choices.values[*]?.error.usizeValue projects the Subtype base value; result.choices.values[*]?.error.isizeValue projects the Subtype base value; result.choices.values[*]?.error.digit < 3.
    def produce_choices(arg0)
      
      Native.call1(arg0)
    end
    # arg0: RawPacket
    # Returns: Event
    # Checked Lean Fin bounds: result.box.value.unitValue projects the Subtype base value; result.box.value.boolValue projects the Subtype base value; result.box.value.uint8Value projects the Subtype base value; result.box.value.uint16Value projects the Subtype base value; result.box.value.uint32Value projects the Subtype base value; result.box.value.uint64Value projects the Subtype base value; result.box.value.int8Value projects the Subtype base value; result.box.value.int16Value projects the Subtype base value; result.box.value.int32Value projects the Subtype base value; result.box.value.int64Value projects the Subtype base value; result.box.value.natValue projects the Subtype base value; result.box.value.intValue projects the Subtype base value; result.box.value.float32Value projects the Subtype base value; result.box.value.float64Value projects the Subtype base value; result.box.value.textValue projects the Subtype base value; result.box.value.bytesValue projects the Subtype base value; result.box.value.charValue projects the Subtype base value; result.box.value.usizeValue projects the Subtype base value; result.box.value.isizeValue projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok.unitValue projects the Subtype base value; result.choices.values[*]?.ok.boolValue projects the Subtype base value; result.choices.values[*]?.ok.uint8Value projects the Subtype base value; result.choices.values[*]?.ok.uint16Value projects the Subtype base value; result.choices.values[*]?.ok.uint32Value projects the Subtype base value; result.choices.values[*]?.ok.uint64Value projects the Subtype base value; result.choices.values[*]?.ok.int8Value projects the Subtype base value; result.choices.values[*]?.ok.int16Value projects the Subtype base value; result.choices.values[*]?.ok.int32Value projects the Subtype base value; result.choices.values[*]?.ok.int64Value projects the Subtype base value; result.choices.values[*]?.ok.natValue projects the Subtype base value; result.choices.values[*]?.ok.intValue projects the Subtype base value; result.choices.values[*]?.ok.float32Value projects the Subtype base value; result.choices.values[*]?.ok.float64Value projects the Subtype base value; result.choices.values[*]?.ok.textValue projects the Subtype base value; result.choices.values[*]?.ok.bytesValue projects the Subtype base value; result.choices.values[*]?.ok.charValue projects the Subtype base value; result.choices.values[*]?.ok.usizeValue projects the Subtype base value; result.choices.values[*]?.ok.isizeValue projects the Subtype base value; result.choices.values[*]?.ok.digit < 3; result.choices.values[*]?.error.unitValue projects the Subtype base value; result.choices.values[*]?.error.boolValue projects the Subtype base value; result.choices.values[*]?.error.uint8Value projects the Subtype base value; result.choices.values[*]?.error.uint16Value projects the Subtype base value; result.choices.values[*]?.error.uint32Value projects the Subtype base value; result.choices.values[*]?.error.uint64Value projects the Subtype base value; result.choices.values[*]?.error.int8Value projects the Subtype base value; result.choices.values[*]?.error.int16Value projects the Subtype base value; result.choices.values[*]?.error.int32Value projects the Subtype base value; result.choices.values[*]?.error.int64Value projects the Subtype base value; result.choices.values[*]?.error.natValue projects the Subtype base value; result.choices.values[*]?.error.intValue projects the Subtype base value; result.choices.values[*]?.error.float32Value projects the Subtype base value; result.choices.values[*]?.error.float64Value projects the Subtype base value; result.choices.values[*]?.error.textValue projects the Subtype base value; result.choices.values[*]?.error.bytesValue projects the Subtype base value; result.choices.values[*]?.error.charValue projects the Subtype base value; result.choices.values[*]?.error.usizeValue projects the Subtype base value; result.choices.values[*]?.error.isizeValue projects the Subtype base value; result.choices.values[*]?.error.digit < 3.
    def produce_event(arg0)
      
      Native.call2(arg0)
    end
    # arg0: RawPacket
    # Returns: array<option<PacketAlias>>
    # Checked Lean Fin bounds: result[*]?.unitValue projects the Subtype base value; result[*]?.boolValue projects the Subtype base value; result[*]?.uint8Value projects the Subtype base value; result[*]?.uint16Value projects the Subtype base value; result[*]?.uint32Value projects the Subtype base value; result[*]?.uint64Value projects the Subtype base value; result[*]?.int8Value projects the Subtype base value; result[*]?.int16Value projects the Subtype base value; result[*]?.int32Value projects the Subtype base value; result[*]?.int64Value projects the Subtype base value; result[*]?.natValue projects the Subtype base value; result[*]?.intValue projects the Subtype base value; result[*]?.float32Value projects the Subtype base value; result[*]?.float64Value projects the Subtype base value; result[*]?.textValue projects the Subtype base value; result[*]?.bytesValue projects the Subtype base value; result[*]?.charValue projects the Subtype base value; result[*]?.usizeValue projects the Subtype base value; result[*]?.isizeValue projects the Subtype base value; result[*]?.digit < 3.
    def produce_group(arg0)
      
      Native.call3(arg0)
    end
    # arg0: RawPacket
    # Returns: Pair
    # Checked Lean Fin bounds: result.left[*]?.unitValue projects the Subtype base value; result.left[*]?.boolValue projects the Subtype base value; result.left[*]?.uint8Value projects the Subtype base value; result.left[*]?.uint16Value projects the Subtype base value; result.left[*]?.uint32Value projects the Subtype base value; result.left[*]?.uint64Value projects the Subtype base value; result.left[*]?.int8Value projects the Subtype base value; result.left[*]?.int16Value projects the Subtype base value; result.left[*]?.int32Value projects the Subtype base value; result.left[*]?.int64Value projects the Subtype base value; result.left[*]?.natValue projects the Subtype base value; result.left[*]?.intValue projects the Subtype base value; result.left[*]?.float32Value projects the Subtype base value; result.left[*]?.float64Value projects the Subtype base value; result.left[*]?.textValue projects the Subtype base value; result.left[*]?.bytesValue projects the Subtype base value; result.left[*]?.charValue projects the Subtype base value; result.left[*]?.usizeValue projects the Subtype base value; result.left[*]?.isizeValue projects the Subtype base value; result.left[*]?.digit < 3; result.right[*]?.unitValue projects the Subtype base value; result.right[*]?.boolValue projects the Subtype base value; result.right[*]?.uint8Value projects the Subtype base value; result.right[*]?.uint16Value projects the Subtype base value; result.right[*]?.uint32Value projects the Subtype base value; result.right[*]?.uint64Value projects the Subtype base value; result.right[*]?.int8Value projects the Subtype base value; result.right[*]?.int16Value projects the Subtype base value; result.right[*]?.int32Value projects the Subtype base value; result.right[*]?.int64Value projects the Subtype base value; result.right[*]?.natValue projects the Subtype base value; result.right[*]?.intValue projects the Subtype base value; result.right[*]?.float32Value projects the Subtype base value; result.right[*]?.float64Value projects the Subtype base value; result.right[*]?.textValue projects the Subtype base value; result.right[*]?.bytesValue projects the Subtype base value; result.right[*]?.charValue projects the Subtype base value; result.right[*]?.usizeValue projects the Subtype base value; result.right[*]?.isizeValue projects the Subtype base value; result.right[*]?.digit < 3.
    def produce_pair(arg0)
      
      Native.call4(arg0)
    end
    # Returns: uint32
    def word_bits()
      
      Native.call5()
    end
  end
end
require_relative "nominalprimitivesubtypes/native"
LeanBridge::Nominalprimitivesubtypes.private_constant :Native
