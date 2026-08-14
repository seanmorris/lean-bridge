/**
 * Implements the generate module in the Ruby backend.
 *
 * @file
 */

import { compileManagedAlphaModel, managedBindingManifest } from "../managed/alpha-model.mjs";
import { auditManagedBindingPackage } from "../managed/package-audit.mjs";

const publicSource = () => `# frozen_string_literal: true

require_relative "alpha/native"

module LeanBridge
  module Alpha
    class LeanBridgeError < StandardError; end
    class DisposedResourceError < LeanBridgeError; end
    class CallbackThrewError < LeanBridgeError; end

    # A copied Lean value with explicit primitive mappings.
    class Payload
      attr_reader :enabled, :count, :label, :bytes, :values

      def initialize(enabled:, count:, label:, bytes:, values:)
        raise TypeError, "enabled must be true or false" unless enabled == true || enabled == false
        Native.uint32(count, "count")
        raise TypeError, "label must be a String" unless label.is_a?(String)
        raise TypeError, "bytes must be a String" unless bytes.is_a?(String)
        raise TypeError, "values must be an Array" unless values.is_a?(Array)
        values.each_with_index { |value, index| Native.uint32(value, "values[#{index}]") }
        @enabled = enabled
        @count = count
        @label = label.dup.freeze
        @bytes = bytes.b.dup.freeze
        @values = values.dup.freeze
        freeze
      end
    end

    # An identity-bearing Lean Box owned by this wrapper.
    class Box
      def initialize(value)
        @state = Native.box_create(value)
        ObjectSpace.define_finalizer(self, @state.finalizer)
      end

      def read = Native.box_read(@state)

      def identity
        Native.box_identity(@state)
        self
      end

      def close = @state.close
      def closed? = @state.closed?
    end

    # An owned callable returned by Lean.
    class OwnedTransform
      def initialize(state)
        @state = state
        ObjectSpace.define_finalizer(self, @state.finalizer)
      end

      def call(value) = Native.transform_call(@state, value)
      def close = @state.close
      def closed? = @state.closed?
    end

    module_function

    def round_trip(payload)
      raise TypeError, "payload must be a Payload" unless payload.is_a?(Payload)
      Native.round_trip(payload)
    end

    def with_callback(value, transform = nil, &block)
      callable = block || transform
      raise TypeError, "transform must be callable" unless callable.respond_to?(:call)
      Native.with_callback(value, callable)
    end

    def make_adder(base)
      OwnedTransform.new(Native.make_adder(base))
    end
  end
end
`;

const nativeSource = () => `# frozen_string_literal: true

require "fiddle"

module LeanBridge
  module Alpha
    module Native
      extend self

      POINTER_BYTES = Fiddle::SIZEOF_VOIDP
      POINTER_PACK = POINTER_BYTES == 8 ? "Q<" : "L<"
      ERROR_BYTES = 24
      PAYLOAD_BYTES = 104
      UINT32_MAX = (2**32) - 1

      root = ENV["LEAN_BRIDGE_NATIVE_ROOT"]
      root = File.expand_path("../native/linux-x64", __dir__) if root.nil? || root.empty?
      runtime_path = File.join(root, "liblean_bridge_native.so")
      component_path = File.join(root, "liblean_alpha_component.so")
      composition_path = File.join(root, "liblean_beta_component.so")
      flags = Fiddle::RTLD_NOW | Fiddle::RTLD_GLOBAL
      RUNTIME_LIBRARY = Fiddle::Handle.new(runtime_path, flags)
      COMPONENT_LIBRARY = Fiddle::Handle.new(component_path, flags)
      COMPOSITION_LIBRARY = Fiddle::Handle.new(composition_path, flags)

      def bind(name, arguments, result = Fiddle::TYPE_INT)
        Fiddle::Function.new(COMPONENT_LIBRARY[name], arguments, result)
      end

      def bind_composition(name, arguments, result = Fiddle::TYPE_INT)
        Fiddle::Function.new(COMPOSITION_LIBRARY[name], arguments, result)
      end

      BOX_CREATE = bind("lean_alpha_box_create", [Fiddle::TYPE_INT, Fiddle::TYPE_VOIDP, Fiddle::TYPE_VOIDP])
      BOX_READ = bind("lean_alpha_box_read", [Fiddle::TYPE_VOIDP, Fiddle::TYPE_VOIDP, Fiddle::TYPE_VOIDP])
      BOX_IDENTITY = bind("lean_alpha_box_identity", [Fiddle::TYPE_VOIDP, Fiddle::TYPE_VOIDP, Fiddle::TYPE_VOIDP])
      COMPOSITION_READ = bind_composition("lean_beta_composition_read", [Fiddle::TYPE_VOIDP])
      SNAPSHOT_READ = Fiddle::Function.new(RUNTIME_LIBRARY["lean_bridge_native_snapshot_read"], [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID)
      ROUND_TRIP = bind("lean_alpha_round_trip", [Fiddle::TYPE_VOIDP, Fiddle::TYPE_VOIDP, Fiddle::TYPE_VOIDP])
      WITH_CALLBACK = bind("lean_alpha_with_callback", [Fiddle::TYPE_INT, Fiddle::TYPE_VOIDP, Fiddle::TYPE_VOIDP, Fiddle::TYPE_VOIDP])
      MAKE_ADDER = bind("lean_alpha_make_adder", [Fiddle::TYPE_INT, Fiddle::TYPE_VOIDP, Fiddle::TYPE_VOIDP])
      TRANSFORM_CALL = bind("lean_alpha_owned_transform_call", [Fiddle::TYPE_VOIDP, Fiddle::TYPE_INT, Fiddle::TYPE_VOIDP, Fiddle::TYPE_VOIDP])
      BOX_DISPOSE = bind("lean_alpha_box_dispose", [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID)
      TRANSFORM_DISPOSE = bind("lean_alpha_owned_transform_dispose", [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID)
      PAYLOAD_CLEAR = bind("lean_alpha_payload_clear", [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID)

      class ResourceState
        def initialize(handle, dispose, label)
          @handle = handle
          @dispose = dispose
          @label = label
        end

        def require_open
          raise DisposedResourceError, "#{@label} is closed" if @handle.zero?
          @handle
        end

        def close
          return if @handle.zero?
          pointer = Native.pointer_slot(@handle)
          @dispose.call(pointer)
          @handle = 0
          nil
        end

        def closed? = @handle.zero?
        def finalizer = proc { close }
      end

      def uint32(value, name)
        raise TypeError, "#{name} must be an Integer" unless value.is_a?(Integer)
        raise RangeError, "#{name} must be uint32" unless value.between?(0, UINT32_MAX)
        value
      end

      def buffer(bytes)
        value = Fiddle::Pointer.malloc(bytes)
        value[0, bytes] = [0].pack("C") * bytes
        value
      end

      def pointer(value)
        value.is_a?(Fiddle::Pointer) ? value : Fiddle::Pointer.new(value)
      end

      def write_pointer(target, offset, value)
        pointer(target)[offset, POINTER_BYTES] = [value.respond_to?(:to_i) ? value.to_i : value].pack(POINTER_PACK)
      end

      def read_pointer(target, offset = 0)
        pointer(target)[offset, POINTER_BYTES].unpack1(POINTER_PACK)
      end

      def pointer_slot(value = 0)
        result = buffer(POINTER_BYTES)
        write_pointer(result, 0, value)
        result
      end

      def error_buffer = buffer(ERROR_BYTES)

      def check(status, error, callback_error = nil)
        raise callback_error if callback_error
        return if status.zero?
        code = error[0, 4].unpack1("l<")
        address = read_pointer(error, 8)
        length = read_pointer(error, 16)
        message = address.zero? ? "Lean call failed with status #{status}" : Fiddle::Pointer.new(address)[0, length]
        raise DisposedResourceError, message if code == 100
        raise CallbackThrewError, message if code == 101
        raise LeanBridgeError, message
      end

      def box_create(value)
        output = pointer_slot
        error = error_buffer
        check(BOX_CREATE.call(uint32(value, "value"), output, error), error)
        ResourceState.new(read_pointer(output), BOX_DISPOSE, "Box")
      end

      def box_read(state)
        output = buffer(4)
        error = error_buffer
        check(BOX_READ.call(state.require_open, output, error), error)
        output[0, 4].unpack1("L<")
      end

      def box_identity(state)
        expected = state.require_open
        output = pointer_slot
        error = error_buffer
        check(BOX_IDENTITY.call(expected, output, error), error)
        raise LeanBridgeError, "Lean returned a different Box identity" unless read_pointer(output) == expected
        nil
      end

      def composition_read(state)
        COMPOSITION_READ.call(state.require_open)
      end

      def snapshot
        output = buffer(40)
        SNAPSHOT_READ.call(output)
        values = output[0, 40].unpack("L<6Q<2")
        {
          runtime_init_runs: values[2], component_init_runs: values[3],
          attached_components: values[4], live_identities: values[5],
          runtime_instance_id: values[6], identity_domain_id: values[7]
        }.freeze
      end

      def write_slice(payload, offset, data, length)
        write_pointer(payload, offset, data.nil? ? 0 : data)
        write_pointer(payload, offset + 8, length)
        write_pointer(payload, offset + 16, 0)
        write_pointer(payload, offset + 24, 0)
      end

      def read_slice(payload, offset, width = 1)
        address = read_pointer(payload, offset)
        length = read_pointer(payload, offset + 8)
        return "".b if length.zero?
        Fiddle::Pointer.new(address)[0, length * width]
      end

      def round_trip(value)
        input = buffer(PAYLOAD_BYTES)
        label = Fiddle::Pointer[value.label.b]
        bytes = value.bytes.empty? ? nil : Fiddle::Pointer[value.bytes]
        packed_values = value.values.pack("L<*")
        values = packed_values.empty? ? nil : Fiddle::Pointer[packed_values]
        input[0, 1] = [value.enabled ? 1 : 0].pack("C")
        input[4, 4] = [value.count].pack("L<")
        write_slice(input, 8, label, value.label.b.bytesize)
        write_slice(input, 40, bytes, value.bytes.bytesize)
        write_slice(input, 72, values, value.values.length)
        output = buffer(PAYLOAD_BYTES)
        error = error_buffer
        check(ROUND_TRIP.call(input, output, error), error)
        begin
          Payload.new(
            enabled: output[0, 1] != [0].pack("C"),
            count: output[4, 4].unpack1("L<"),
            label: read_slice(output, 8).force_encoding(Encoding::UTF_8),
            bytes: read_slice(output, 40),
            values: read_slice(output, 72, 4).unpack("L<*")
          )
        ensure
          PAYLOAD_CLEAR.call(output)
        end
      end

      def with_callback(value, callable)
        callback_error = nil
        callback_message = nil
        closure = Fiddle::Closure::BlockCaller.new(
          Fiddle::TYPE_INT,
          [Fiddle::TYPE_VOIDP, Fiddle::TYPE_INT, Fiddle::TYPE_VOIDP, Fiddle::TYPE_VOIDP]
        ) do |_context, input, output, error|
          begin
            result = uint32(callable.call(input & UINT32_MAX), "callback result")
            pointer(output)[0, 4] = [result].pack("L<")
            0
          rescue Exception => exception
            callback_error = exception
            callback_message = Fiddle::Pointer[exception.message.to_s.b]
            target = pointer(error)
            target[0, 4] = [101].pack("l<")
            write_pointer(target, 8, callback_message)
            write_pointer(target, 16, exception.message.to_s.b.bytesize)
            4
          end
        end
        descriptor = buffer(POINTER_BYTES * 2)
        write_pointer(descriptor, 0, closure)
        write_pointer(descriptor, POINTER_BYTES, 0)
        output = buffer(4)
        error = error_buffer
        status = WITH_CALLBACK.call(uint32(value, "value"), descriptor, output, error)
        check(status, error, callback_error)
        output[0, 4].unpack1("L<")
      ensure
        closure.free if closure&.respond_to?(:free)
        callback_message = nil
      end

      def make_adder(value)
        output = pointer_slot
        error = error_buffer
        check(MAKE_ADDER.call(uint32(value, "base"), output, error), error)
        ResourceState.new(read_pointer(output), TRANSFORM_DISPOSE, "Transform")
      end

      def transform_call(state, value)
        output = buffer(4)
        error = error_buffer
        check(TRANSFORM_CALL.call(state.require_open, uint32(value, "value"), output, error), error)
        output[0, 4].unpack1("L<")
      end

      private_constant :RUNTIME_LIBRARY, :COMPONENT_LIBRARY, :COMPOSITION_LIBRARY
    end
  end
end
`;

const rbsSource = () => `module LeanBridge
  module Alpha
    class LeanBridgeError < StandardError
    end
    class DisposedResourceError < LeanBridgeError
    end
    class CallbackThrewError < LeanBridgeError
    end
    class Payload
      attr_reader enabled: bool
      attr_reader count: Integer
      attr_reader label: String
      attr_reader bytes: String
      attr_reader values: Array[Integer]
      def initialize: (enabled: bool, count: Integer, label: String, bytes: String, values: Array[Integer]) -> void
    end
    class Box
      def initialize: (Integer value) -> void
      def read: () -> Integer
      def identity: () -> Box
      def close: () -> nil
      def closed?: () -> bool
    end
    class OwnedTransform
      def call: (Integer value) -> Integer
      def close: () -> nil
      def closed?: () -> bool
    end
    def self.round_trip: (Payload payload) -> Payload
    def self.with_callback: (Integer value, ?^(Integer) -> Integer transform) { ?(Integer) -> Integer } -> Integer
    def self.make_adder: (Integer base) -> OwnedTransform
  end
end
`;

const gemspecSource = model => `Gem::Specification.new do |spec|
  spec.name = "lean_bridge_alpha"
  spec.version = "${model.component.version}"
  spec.summary = "Generated ${model.component.name} bindings"
  spec.authors = ["Lean Bridge"]
  spec.license = "MIT"
  spec.files = Dir["lib/**/*", "sig/**/*", "README.md", "binding-manifest.json"].sort
  spec.require_paths = ["lib"]
  spec.required_ruby_version = ">= 3.3"
end
`;

/**
 * Generates ruby binding package from validated semantic input without introducing behavior outside the generated native-language binding pipeline.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 */
export const generateRubyBindingPackage = ir => {
	const model = compileManagedAlphaModel(ir, "ruby");
	const publicFiles = ["lib/lean_bridge/alpha.rb", "sig/lean_bridge/alpha.rbs"];
	const internalFiles = ["lib/lean_bridge/alpha/native.rb"];
	const packageFiles = ["lean_bridge_alpha.gemspec"];
	const files = {
		[publicFiles[0]]: publicSource()
		, [publicFiles[1]]: rbsSource()
		, [internalFiles[0]]: nativeSource()
		, [packageFiles[0]]: gemspecSource(model)
		, "README.md": `# ${model.component.name} Ruby binding\n\nGenerated direct Ruby APIs over one process-wide Lean runtime.\n\nBinding IR SHA-256: \`${model.bindingIrSha256}\`\n`
	};
	const manifest = managedBindingManifest({
		model
		, generator: "ruby"
		, files: [...publicFiles, ...internalFiles, ...packageFiles, "README.md"]
		, publicFiles
		, internalFiles
		, packageFiles
	});
	files["binding-manifest.json"] = `${JSON.stringify(manifest, null, 2)}\n`;
	auditManagedBindingPackage(ir, files, "ruby");
	return Object.freeze(files);
};
