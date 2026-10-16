# frozen_string_literal: true
module LeanBridge
  module Nestedcheckedrecords
    UNIT = ::Object.new.freeze
    class LeanBridgeError < ::StandardError; end
    Some = ::Data.define(:value)
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
    module_function
    # Checked Lean Fin bounds: result[*] projects proof-backed record payload fields; result[*].digit < 10; result[*].word projects the Subtype base value.
    def produce_array(arg0)
      
      Native.call0(arg0)
    end
    # Checked Lean Fin bounds: result? projects proof-backed record payload fields; result?.digit < 10; result?.word projects the Subtype base value.
    def produce_option(arg0)
      
      Native.call1(arg0)
    end
  end
end
require_relative "nestedcheckedrecords/native"
LeanBridge::Nestedcheckedrecords.private_constant :Native
