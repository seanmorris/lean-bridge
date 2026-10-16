# frozen_string_literal: true
module LeanBridge
  module Nestedcheckedrecords
    UNIT = ::Object.new.freeze
    class LeanBridgeError < ::StandardError; end
    Some = ::Data.define(:value)
    Ok = ::Data.define(:value)
    Err = ::Data.define(:value)
    class Packet
      attr_reader :digit, :word
      def initialize(digit:, word:)
        @digit = digit
        @word = word
        freeze
      end
      def ==(other)
        Native.exact?(other, self.class) && @digit == Native::STORED_FIELD.bind_call(other, :@digit) && @word == Native::STORED_FIELD.bind_call(other, :@word)
      end
      def eql?(other)
        Native.exact?(other, self.class) && @digit.eql?(Native::STORED_FIELD.bind_call(other, :@digit)) && @word.eql?(Native::STORED_FIELD.bind_call(other, :@word))
      end
      def hash
        [self.class, @digit, @word].hash
      end
      def deconstruct_keys(_keys)
        { digit: @digit, word: @word }
      end
    end
    class Holder
      attr_reader :packet, :tag
      def initialize(packet:, tag:)
        @packet = packet
        @tag = tag
        freeze
      end
      def ==(other)
        Native.exact?(other, self.class) && @packet == Native::STORED_FIELD.bind_call(other, :@packet) && @tag == Native::STORED_FIELD.bind_call(other, :@tag)
      end
      def eql?(other)
        Native.exact?(other, self.class) && @packet.eql?(Native::STORED_FIELD.bind_call(other, :@packet)) && @tag.eql?(Native::STORED_FIELD.bind_call(other, :@tag))
      end
      def hash
        [self.class, @packet, @tag].hash
      end
      def deconstruct_keys(_keys)
        { packet: @packet, tag: @tag }
      end
    end
    class Choice
      private_class_method :new
    end
    class Choice::Empty < Choice
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
    class Choice::Packet < Choice
      public_class_method :new
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
    module_function
    # Checked Lean Fin bounds: arg0[*] checked by NestedCheckedRecords.mkPacket; arg0[*].digit < 10; arg0[*].word checked by NestedCheckedRecords.mkWord; result[*] projects proof-backed record payload fields; result[*].digit < 10; result[*].word projects the Subtype base value.
    def echo_array(arg0)
      
      Native.call0(arg0)
    end
    # Checked Lean Fin bounds: arg0 checked by NestedCheckedRecords.mkPacket; arg0.digit < 10; arg0.word checked by NestedCheckedRecords.mkWord.
    def first(arg0)
      
      Native.call1(arg0)
    end
    # Checked Lean Fin bounds: arg0[*] checked by NestedCheckedRecords.mkPacket; arg0[*].digit < 10; arg0[*].word checked by NestedCheckedRecords.mkWord.
    def in_array(arg0)
      
      Native.call2(arg0)
    end
    # Checked Lean Fin bounds: arg0.packet.value checked by NestedCheckedRecords.mkPacket; arg0.packet.value.digit < 10; arg0.packet.value.word checked by NestedCheckedRecords.normalizeWord.
    def in_choice(arg0)
      
      Native.call3(arg0)
    end
    # Checked Lean Fin bounds: arg0.ok checked by NestedCheckedRecords.normalizePacket; arg0.ok.digit < 10; arg0.ok.word checked by NestedCheckedRecords.mkWord; arg0.error checked by NestedCheckedRecords.mkPacket; arg0.error.digit < 10; arg0.error.word checked by NestedCheckedRecords.normalizeWord.
    def in_except(arg0)
      
      Native.call4(arg0)
    end
    # Checked Lean Fin bounds: arg0.packet checked by NestedCheckedRecords.normalizePacket; arg0.packet.digit < 10; arg0.packet.word checked by NestedCheckedRecords.mkWord.
    def in_holder(arg0)
      
      Native.call5(arg0)
    end
    # Checked Lean Fin bounds: arg0[*] checked by NestedCheckedRecords.normalizePacket; arg0[*].digit < 10; arg0[*].word checked by NestedCheckedRecords.normalizeWord.
    def in_list(arg0)
      
      Native.call6(arg0)
    end
    # Checked Lean Fin bounds: arg0? checked by NestedCheckedRecords.mkPacket; arg0?.digit < 10; arg0?.word checked by NestedCheckedRecords.normalizeWord.
    def in_option(arg0)
      
      Native.call7(arg0)
    end
    # Checked Lean Fin bounds: arg0.0 checked by NestedCheckedRecords.mkPacket; arg0.0.digit < 10; arg0.0.word checked by NestedCheckedRecords.mkWord; arg0.1 checked by NestedCheckedRecords.normalizePacket; arg0.1.digit < 10; arg0.1.word checked by NestedCheckedRecords.normalizeWord.
    def in_product(arg0)
      
      Native.call8(arg0)
    end
    # Checked Lean Fin bounds: arg0 checked by NestedCheckedRecords.mkPacket; arg0.digit < 10; arg0.word checked by NestedCheckedRecords.mkWord; arg1 checked by NestedCheckedRecords.normalizePacket; arg1.digit < 10; arg1.word checked by NestedCheckedRecords.normalizeWord.
    def pair(arg0, arg1)
      
      Native.call9(arg0, arg1)
    end
    # Checked Lean Fin bounds: result[*] projects proof-backed record payload fields; result[*].digit < 10; result[*].word projects the Subtype base value.
    def produce_array(arg0)
      
      Native.call10(arg0)
    end
    # Checked Lean Fin bounds: result? projects proof-backed record payload fields; result?.digit < 10; result?.word projects the Subtype base value.
    def produce_option(arg0)
      
      Native.call11(arg0)
    end
    # Checked Lean Fin bounds: arg0 checked by NestedCheckedRecords.normalizePacket; arg0.digit < 10; arg0.word checked by NestedCheckedRecords.normalizeWord.
    def second(arg0)
      
      Native.call12(arg0)
    end
  end
end
require_relative "nestedcheckedrecords/native"
LeanBridge::Nestedcheckedrecords.private_constant :Native
