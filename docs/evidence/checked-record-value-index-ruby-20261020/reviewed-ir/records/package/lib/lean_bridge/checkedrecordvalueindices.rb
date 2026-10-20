# frozen_string_literal: true
module LeanBridge
  module Checkedrecordvalueindices
    UNIT = ::Object.new.freeze
    class LeanBridgeError < ::StandardError; end
    class Ab
      attr_reader :size
      def initialize(size:)
        @size = size
        freeze
      end
      def ==(other)
        Native.exact?(other, self.class) && @size == Native::STORED_FIELD.bind_call(other, :@size)
      end
      def eql?(other)
        Native.exact?(other, self.class) && @size.eql?(Native::STORED_FIELD.bind_call(other, :@size))
      end
      def hash
        [self.class, @size].hash
      end
      def deconstruct_keys(_keys)
        { size: @size }
      end
    end
    class EmptySized
      attr_reader :data
      def initialize(data:)
        @data = data
        freeze
      end
      def ==(other)
        Native.exact?(other, self.class) && @data == Native::STORED_FIELD.bind_call(other, :@data)
      end
      def eql?(other)
        Native.exact?(other, self.class) && @data.eql?(Native::STORED_FIELD.bind_call(other, :@data))
      end
      def hash
        [self.class, @data].hash
      end
      def deconstruct_keys(_keys)
        { data: @data }
      end
    end
    class EmptyToken
      attr_reader :count
      def initialize(count:)
        @count = count
        freeze
      end
      def ==(other)
        Native.exact?(other, self.class) && @count == Native::STORED_FIELD.bind_call(other, :@count)
      end
      def eql?(other)
        Native.exact?(other, self.class) && @count.eql?(Native::STORED_FIELD.bind_call(other, :@count))
      end
      def hash
        [self.class, @count].hash
      end
      def deconstruct_keys(_keys)
        { count: @count }
      end
    end
    class Off
      attr_reader :count
      def initialize(count:)
        @count = count
        freeze
      end
      def ==(other)
        Native.exact?(other, self.class) && @count == Native::STORED_FIELD.bind_call(other, :@count)
      end
      def eql?(other)
        Native.exact?(other, self.class) && @count.eql?(Native::STORED_FIELD.bind_call(other, :@count))
      end
      def hash
        [self.class, @count].hash
      end
      def deconstruct_keys(_keys)
        { count: @count }
      end
    end
    class On
      attr_reader :count
      def initialize(count:)
        @count = count
        freeze
      end
      def ==(other)
        Native.exact?(other, self.class) && @count == Native::STORED_FIELD.bind_call(other, :@count)
      end
      def eql?(other)
        Native.exact?(other, self.class) && @count.eql?(Native::STORED_FIELD.bind_call(other, :@count))
      end
      def hash
        [self.class, @count].hash
      end
      def deconstruct_keys(_keys)
        { count: @count }
      end
    end
    class UnicodeToken
      attr_reader :count
      def initialize(count:)
        @count = count
        freeze
      end
      def ==(other)
        Native.exact?(other, self.class) && @count == Native::STORED_FIELD.bind_call(other, :@count)
      end
      def eql?(other)
        Native.exact?(other, self.class) && @count.eql?(Native::STORED_FIELD.bind_call(other, :@count))
      end
      def hash
        [self.class, @count].hash
      end
      def deconstruct_keys(_keys)
        { count: @count }
      end
    end
    class WideToken
      attr_reader :count
      def initialize(count:)
        @count = count
        freeze
      end
      def ==(other)
        Native.exact?(other, self.class) && @count == Native::STORED_FIELD.bind_call(other, :@count)
      end
      def eql?(other)
        Native.exact?(other, self.class) && @count.eql?(Native::STORED_FIELD.bind_call(other, :@count))
      end
      def hash
        [self.class, @count].hash
      end
      def deconstruct_keys(_keys)
        { count: @count }
      end
    end
    class ZeroToken
      attr_reader :count
      def initialize(count:)
        @count = count
        freeze
      end
      def ==(other)
        Native.exact?(other, self.class) && @count == Native::STORED_FIELD.bind_call(other, :@count)
      end
      def eql?(other)
        Native.exact?(other, self.class) && @count.eql?(Native::STORED_FIELD.bind_call(other, :@count))
      end
      def hash
        [self.class, @count].hash
      end
      def deconstruct_keys(_keys)
        { count: @count }
      end
    end
    module_function
    # Checked Lean Fin bounds: arg0 checked by CheckedRecordValueIndices.mkAb.
    def ab_string_index(arg0)
      
      Native.call0(arg0)
    end
    # Checked Lean Fin bounds: arg0 checked by CheckedRecordValueIndices.mkEmptySized.
    def empty_sized_index(arg0)
      
      Native.call1(arg0)
    end
    # Checked Lean Fin bounds: arg0 checked by CheckedRecordValueIndices.mkEmptyToken.
    def empty_string_index(arg0)
      
      Native.call2(arg0)
    end
    # Checked Lean Fin bounds: arg0 checked by CheckedRecordValueIndices.mkOff.
    def false_bool_index(arg0)
      
      Native.call3(arg0)
    end
    # Checked Lean Fin bounds: result projects proof-backed record payload fields.
    def produce_ab()
      
      Native.call4()
    end
    # Checked Lean Fin bounds: result projects proof-backed record payload fields.
    def produce_empty_sized()
      
      Native.call5()
    end
    # Checked Lean Fin bounds: result projects proof-backed record payload fields.
    def produce_empty_string(arg0)
      
      Native.call6(arg0)
    end
    # Checked Lean Fin bounds: result projects proof-backed record payload fields.
    def produce_false_bool()
      
      Native.call7()
    end
    # Checked Lean Fin bounds: result projects proof-backed record payload fields.
    def produce_true_bool()
      
      Native.call8()
    end
    # Checked Lean Fin bounds: result projects proof-backed record payload fields.
    def produce_unicode_string(arg0)
      
      Native.call9(arg0)
    end
    # Checked Lean Fin bounds: result projects proof-backed record payload fields.
    def produce_wide_nat(arg0)
      
      Native.call10(arg0)
    end
    # Checked Lean Fin bounds: result projects proof-backed record payload fields.
    def produce_zero_nat(arg0)
      
      Native.call11(arg0)
    end
    # Checked Lean Fin bounds: arg0 checked by CheckedRecordValueIndices.mkOn.
    def true_bool_index(arg0)
      
      Native.call12(arg0)
    end
    # Checked Lean Fin bounds: arg0 checked by CheckedRecordValueIndices.mkUnicodeToken.
    def unicode_string_index(arg0)
      
      Native.call13(arg0)
    end
    # Checked Lean Fin bounds: arg0 checked by CheckedRecordValueIndices.mkWideToken.
    def wide_nat_index(arg0)
      
      Native.call14(arg0)
    end
    # Checked Lean Fin bounds: arg0 checked by CheckedRecordValueIndices.mkZeroToken.
    def zero_nat_index(arg0)
      
      Native.call15(arg0)
    end
  end
end
require_relative "checkedrecordvalueindices/native"
LeanBridge::Checkedrecordvalueindices.private_constant :Native
