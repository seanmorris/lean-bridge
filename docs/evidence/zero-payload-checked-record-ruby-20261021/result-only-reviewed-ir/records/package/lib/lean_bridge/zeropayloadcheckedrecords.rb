# frozen_string_literal: true
module LeanBridge
  module Zeropayloadcheckedrecords
    UNIT = ::Object.new.freeze
    class LeanBridgeError < ::StandardError; end
    Some = ::Data.define(:value)
    class Witness
      
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
    class Marker
      
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
    class Token
      attr_reader :tag
      def initialize(tag:)
        @tag = tag
        freeze
      end
      def ==(other)
        Native.exact?(other, self.class) && @tag == Native::STORED_FIELD.bind_call(other, :@tag)
      end
      def eql?(other)
        Native.exact?(other, self.class) && @tag.eql?(Native::STORED_FIELD.bind_call(other, :@tag))
      end
      def hash
        [self.class, @tag].hash
      end
      def deconstruct_keys(_keys)
        { tag: @tag }
      end
    end
    class Mark
      private_class_method :new
    end
    class Mark::Blank < Mark
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
    class Mark::Marked < Mark
      public_class_method :new
      attr_reader :witness
      def initialize(witness:)
        @witness = witness
        freeze
      end
      def ==(other)
        Native.exact?(other, self.class) && @witness == Native::STORED_FIELD.bind_call(other, :@witness)
      end
      def eql?(other)
        Native.exact?(other, self.class) && @witness.eql?(Native::STORED_FIELD.bind_call(other, :@witness))
      end
      def hash
        [self.class, @witness].hash
      end
      def deconstruct_keys(_keys)
        { witness: @witness }
      end
    end
    module_function
    # Checked Lean Fin bounds: result? projects proof-backed record payload fields.
    def maybe_witness(arg0)
      
      Native.call0(arg0)
    end
    # Checked Lean Fin bounds: result.marked.witness projects proof-backed record payload fields.
    def produce_mark(arg0)
      
      Native.call1(arg0)
    end
    def produce_marker()
      
      Native.call2()
    end
    # Checked Lean Fin bounds: result projects proof-backed record payload fields.
    def produce_token()
      
      Native.call3()
    end
    # Checked Lean Fin bounds: result projects proof-backed record payload fields.
    def produce_witness()
      
      Native.call4()
    end
    # Checked Lean Fin bounds: result[*] projects proof-backed record payload fields.
    def witnesses(arg0)
      
      Native.call5(arg0)
    end
  end
end
require_relative "zeropayloadcheckedrecords/native"
LeanBridge::Zeropayloadcheckedrecords.private_constant :Native
