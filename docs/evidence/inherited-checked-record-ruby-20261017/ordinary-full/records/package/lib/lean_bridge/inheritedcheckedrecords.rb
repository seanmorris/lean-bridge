# frozen_string_literal: true
module LeanBridge
  module Inheritedcheckedrecords
    # Copied Lean aliases use their Ruby target values, not separate constants.
    # TicketAlias = Ticket; Ruby: LeanBridge::Inheritedcheckedrecords::Ticket
    UNIT = ::Object.new.freeze
    class LeanBridgeError < ::StandardError; end
    class Span
      # lo: nat
      # hi: nat
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
      # toSpan: Span
      # word: nat
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
      # toTicket: Ticket
      # mark: nat
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
    # arg0: TicketAlias
    # Returns: nat
    # Checked Lean Fin bounds: arg0 checked by InheritedCheckedRecords.mkTicket; arg0.toSpan checked by InheritedCheckedRecords.normalizeSpan; arg0.word checked by InheritedCheckedRecords.normalizeWord.
    def aliased(arg0)
      
      Native.call0(arg0)
    end
    # arg0: Ticket
    # Returns: Ticket
    # Checked Lean Fin bounds: arg0 checked by InheritedCheckedRecords.normalizeTicket; arg0.toSpan checked by InheritedCheckedRecords.mkSpan; arg0.word checked by InheritedCheckedRecords.normalizeWord; result projects proof-backed record payload fields; result.toSpan projects proof-backed record payload fields; result.word projects the Subtype base value.
    def echo(arg0)
      
      Native.call1(arg0)
    end
    # arg0: Ticket
    # Returns: nat
    # Checked Lean Fin bounds: arg0 checked by InheritedCheckedRecords.mkTicket; arg0.toSpan checked by InheritedCheckedRecords.mkSpan; arg0.word checked by InheritedCheckedRecords.mkWord.
    def first(arg0)
      
      Native.call2(arg0)
    end
    # arg0: Stamped
    # Returns: nat
    # Checked Lean Fin bounds: arg0 checked by InheritedCheckedRecords.mkStamped; arg0.toTicket checked by InheritedCheckedRecords.mkTicket; arg0.toTicket.toSpan checked by InheritedCheckedRecords.mkSpan; arg0.toTicket.word checked by InheritedCheckedRecords.mkWord; arg0.mark < 8.
    def nested(arg0)
      
      Native.call3(arg0)
    end
    # arg0: Ticket
    # Returns: nat
    # Checked Lean Fin bounds: arg0 checked by InheritedCheckedRecords.normalizeTicket; arg0.toSpan checked by InheritedCheckedRecords.normalizeSpan; arg0.word checked by InheritedCheckedRecords.normalizeWord.
    def normalized(arg0)
      
      Native.call4(arg0)
    end
    # arg0: Ticket
    # arg1: Ticket
    # Returns: nat
    # Checked Lean Fin bounds: arg0 checked by InheritedCheckedRecords.mkTicket; arg0.toSpan checked by InheritedCheckedRecords.mkSpan; arg0.word checked by InheritedCheckedRecords.mkWord; arg1 checked by InheritedCheckedRecords.normalizeTicket; arg1.toSpan checked by InheritedCheckedRecords.normalizeSpan; arg1.word checked by InheritedCheckedRecords.normalizeWord.
    def pair(arg0, arg1)
      
      Native.call5(arg0, arg1)
    end
    # arg0: nat
    # Returns: Ticket
    # Checked Lean Fin bounds: result projects proof-backed record payload fields; result.toSpan projects proof-backed record payload fields; result.word projects the Subtype base value.
    def produce(arg0)
      
      Native.call6(arg0)
    end
    # arg0: nat
    # Returns: Stamped
    # Checked Lean Fin bounds: result projects proof-backed record payload fields; result.toTicket projects proof-backed record payload fields; result.toTicket.toSpan projects proof-backed record payload fields; result.toTicket.word projects the Subtype base value; result.mark < 8.
    def produce_stamped(arg0)
      
      Native.call7(arg0)
    end
  end
end
require_relative "inheritedcheckedrecords/native"
LeanBridge::Inheritedcheckedrecords.private_constant :Native
