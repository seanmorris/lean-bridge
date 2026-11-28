# frozen_string_literal: true
# Component-private conversion code over the shared native wire format.
# Neither application code nor the Ruby GC owns a Lean pointer.
require "fiddle"
module LeanBridge::GeneratedSyncComponent
  module NativeSyncWireV1
    LIMIT = 16 * 1024 * 1024
    EXACT = ::Object.instance_method(:instance_of?)
    SAME = ::BasicObject.instance_method(:equal?)
    BYTES = ::String.instance_method(:bytesize)
    SLICE = ::String.instance_method(:byteslice)
    class Frame
      def initialize
        @memory = []
        @remaining = LIMIT
      end
      def charge(count)
        raise ::RangeError, "Lean copy budget exceeded" unless count.between?(0, @remaining)
        @remaining -= count
      end
      def bytes(count)
        p = ::Fiddle::Pointer.malloc([count, 1].max, ::Fiddle::RUBY_FREE)
        begin
          @memory << p
        rescue ::Exception
          p.call_free
          raise
        end
        p
      end
      def close
        begin
          @hosts&.reverse_each { |type, token| Native.drop_host(type, token) }
        ensure
          @memory.reverse_each(&:call_free)
        end
      end
      def pin_host(type, value)
        @hosts ||= []
        token = Native.pin_host(type, value)
        begin
          @hosts << [type, token]
        rescue ::Exception
          Native.drop_host(type, token)
          raise
        end
        [*token.unpack("Q<2"), 0]
      end
      def admit_hosts
        @hosts&.each { |type, token| Native.admit_host(type, token) }
      end
    end
    def self.number(type, value)
      raise ::TypeError, "Expected Integer" unless EXACT.bind_call(value, ::Integer)
      bits = type.end_with?("size") ? 64 : type[/\d+/].to_i
      sign = type.start_with?("i")
      low = sign ? -(1 << (bits - 1)) : 0
      high = (1 << (sign ? bits - 1 : bits)) - 1
      raise ::RangeError, "Value outside #{type}" unless value.between?(low, high)
      value
    end
    def self.text(value, frame, char: false, binary: false)
      raise ::TypeError, "Expected String" unless EXACT.bind_call(value, ::String)
      size = BYTES.bind_call(value)
      raise ::RangeError, "Char requires one Unicode scalar" if char && !size.between?(1, 4)
      frame.charge(size) unless char
      copy = SLICE.bind_call(value, 0, size)
      unless binary || ((copy.encoding == ::Encoding::UTF_8 || copy.encoding == ::Encoding::US_ASCII) && copy.valid_encoding?)
        raise ::EncodingError, "Expected valid UTF-8 or US-ASCII"
      end
      return copy unless char
      raise ::RangeError, "Char requires one Unicode scalar" unless copy.length == 1
      copy.ord
    end
    def self.encode(type, value, frame, unit)
      return frame.pin_host(type, value) if type.start_with?("host:")
      return Native.borrow_resource(type, value) if type.start_with?("lease:")
      case type
      when "unit"
        raise ::TypeError, "Expected UNIT" unless SAME.bind_call(value, unit)
        [0, 0, 0]
      when "bool"
        raise ::TypeError, "Expected true or false" unless SAME.bind_call(value, true) || SAME.bind_call(value, false)
        [value ? 1 : 0, 0, 0]
      when "char" then [text(value, frame, char: true), 0, 0]
      when "float32", "float64"
        raise ::TypeError, "Expected Float" unless EXACT.bind_call(value, ::Float)
        [type == "float32" ? [value].pack("e").unpack1("L<") : [value].pack("E").unpack1("Q<"), 0, 0]
      when "bytes", "string"
        copy = text(value, frame, binary: type == "bytes")
        p = frame.bytes(copy.bytesize); p[0, copy.bytesize] = copy
        [p.to_i, copy.bytesize, 0]
      when "int", "nat"
        raise ::TypeError, "Expected Integer" unless EXACT.bind_call(value, ::Integer)
        raise ::RangeError, "Nat cannot be negative" if type == "nat" && value < 0
        raise ::RangeError, "Lean copy budget exceeded" if value.bit_length > LIMIT * 8
        magnitude = value.abs; count = (magnitude.bit_length + 63) / 64
        frame.charge(count * 8); p = frame.bytes(count * 8)
        p[0, count * 8] = [magnitude.to_s(16).rjust(count * 16, "0")].pack("H*").reverse unless count.zero?
        [p.to_i, count, value < 0 ? 1 : 0]
      else [number(type, value), 0, 0]
      end
    end
    def self.decode(api, type, words, tags, out, level = 0)
      if type.is_a?(::Array)
        arm = tags[level, 1].unpack1("C")
        raise api::BoundaryError, "Invalid native result tag" if arm > 1
        value = decode(api, type[arm == 1 ? 0 : 1], words, tags, out, level + 1)
        return (arm == 1 ? api::Ok : api::Err).new(value)
      end
      a, n, sign, owner = words
      return Native.resolve_host(type, out, owner) if type.start_with?("host:")
      return Native.take_resource(type, out, owner) if type.start_with?("lease:")
      case type
      when "unit" then api::UNIT
      when "bool" then a != 0
      when "char" then a.chr(::Encoding::UTF_8)
      when "float32" then [a].pack("L<").unpack1("e")
      when "float64" then [a].pack("Q<").unpack1("E")
      when "bytes", "string", "int", "nat"
        wide = type == "int" || type == "nat"; size = wide ? n * 8 : n
        raise api::BoundaryError, "Invalid owned result" unless size <= LIMIT && (size == 0 || a != 0) && owner == (wide ? 2 : 1)
        copy = size.zero? ? +"".b : ::Fiddle::Pointer.new(a)[0, size]
        if wide
          magnitude = copy.empty? ? 0 : copy.reverse.unpack1("H*").to_i(16)
          return sign.zero? ? magnitude : -magnitude
        end
        return copy.force_encoding(::Encoding::BINARY) if type == "bytes"
        copy.force_encoding(::Encoding::UTF_8)
        raise ::EncodingError, "Invalid native UTF-8" unless copy.valid_encoding?
        copy
      else type.start_with?("i") ? [a].pack("Q<").unpack1("q<") : a
      end
    end
    def self.call(api, fn, clear, declaration, types, result, error, effect, depth, values)
      # No asynchronous exception may strand a native output or borrowed input.
      ::Thread.handle_interrupt(::Exception => :never) do
        frame = Frame.new
        begin
          input = frame.bytes(24 * types.size); out = frame.bytes(32); tags = frame.bytes(depth)
          out[0, 32] = "\0" * 32
          types.each_with_index { |type, i| input[i * 24, 24] = encode(type, values[i], frame, api::UNIT).pack("Q<3") }
          begin
            status = fn.call(input, out, tags)
            words = out[0, 32].unpack("Q<4")
            return decode(api, result, words, tags, out) if status.zero?
            if status == 3 && effect == "EIO"
              raise api::DeclaredError.new(declaration, decode(api, error, words, tags, out))
            elsif status == 4 && effect == "IO"
              raise api::IOError.new(declaration, decode(api, error, words, tags, out))
            elsif status == 5
              raise ::ArgumentError, "Invalid Lean argument"
            elsif status == 6 && types.any? { |t| t.start_with?("lease:") }
              raise api::ClosedResource, "Lean resource is closed"
            elsif status == 9
              raise api::WrongContext, "Lean requires the original process main thread"
            elsif status == 10
              raise api::Unavailable, "The Lean runtime is unavailable"
            elsif status == 11
              raise ::NoMemoryError, "Lean allocation failed"
            elsif status == 12
              raise ::RangeError, "Lean copy budget exceeded"
            end
            raise api::BoundaryError, "Lean call failed (status #{status})"
          ensure
            clear.call(out)
          end
        ensure
          frame.close
        end
      end
    end
  end
  private_constant :NativeSyncWireV1
end
