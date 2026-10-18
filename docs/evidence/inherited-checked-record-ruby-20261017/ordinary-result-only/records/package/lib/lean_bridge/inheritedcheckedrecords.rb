# frozen_string_literal: true
module LeanBridge
  module Inheritedcheckedrecords
    UNIT = ::Object.new.freeze
    class LeanBridgeError < ::StandardError; end
    class Span
      attr_reader :lo, :hi
      def initialize(lo:, hi:)
        @lo = lo
        @hi = hi
        freeze
      end
      def ==(other)
        Native.exact?(other, self.class) && @lo == Native::STORED_FIELD.bind_call(other, :@lo) && @hi == Native::STORED_FIELD.bind_call(other, :@hi)
      end
      def eql?(other)
        Native.exact?(other, self.class) && @lo.eql?(Native::STORED_FIELD.bind_call(other, :@lo)) && @hi.eql?(Native::STORED_FIELD.bind_call(other, :@hi))
      end
      def hash
        [self.class, @lo, @hi].hash
      end
      def deconstruct_keys(_keys)
        { lo: @lo, hi: @hi }
      end
    end
    class Ticket
      attr_reader :to_span, :word
      def initialize(to_span:, word:)
        @to_span = to_span
        @word = word
        freeze
      end
      def ==(other)
        Native.exact?(other, self.class) && @to_span == Native::STORED_FIELD.bind_call(other, :@to_span) && @word == Native::STORED_FIELD.bind_call(other, :@word)
      end
      def eql?(other)
        Native.exact?(other, self.class) && @to_span.eql?(Native::STORED_FIELD.bind_call(other, :@to_span)) && @word.eql?(Native::STORED_FIELD.bind_call(other, :@word))
      end
      def hash
        [self.class, @to_span, @word].hash
      end
      def deconstruct_keys(_keys)
        { to_span: @to_span, word: @word }
      end
    end
    class Stamped
      attr_reader :to_ticket, :mark
      def initialize(to_ticket:, mark:)
        @to_ticket = to_ticket
        @mark = mark
        freeze
      end
      def ==(other)
        Native.exact?(other, self.class) && @to_ticket == Native::STORED_FIELD.bind_call(other, :@to_ticket) && @mark == Native::STORED_FIELD.bind_call(other, :@mark)
      end
      def eql?(other)
        Native.exact?(other, self.class) && @to_ticket.eql?(Native::STORED_FIELD.bind_call(other, :@to_ticket)) && @mark.eql?(Native::STORED_FIELD.bind_call(other, :@mark))
      end
      def hash
        [self.class, @to_ticket, @mark].hash
      end
      def deconstruct_keys(_keys)
        { to_ticket: @to_ticket, mark: @mark }
      end
    end
    module_function
    # Checked Lean Fin bounds: result projects proof-backed record payload fields; result.toSpan projects proof-backed record payload fields; result.word projects the Subtype base value.
    def produce(arg0)
      
      Native.call0(arg0)
    end
    # Checked Lean Fin bounds: result projects proof-backed record payload fields; result.toTicket projects proof-backed record payload fields; result.toTicket.toSpan projects proof-backed record payload fields; result.toTicket.word projects the Subtype base value; result.mark < 8.
    def produce_stamped(arg0)
      
      Native.call1(arg0)
    end
  end
end
require_relative "inheritedcheckedrecords/native"
LeanBridge::Inheritedcheckedrecords.private_constant :Native
