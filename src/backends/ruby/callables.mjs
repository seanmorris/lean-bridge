/**
 * Ruby callables and owned Lean closures over the shared native C ABI.
 *
 * @file
 */
import { readRubyValue } from "./copied-conversions.mjs";

/**
 * Resolve a copied value or an admitted primitive callable.
 *
 * @param model - Admitted Ruby model.
 * @param ref - Canonical type reference.
 */
export const rubyValue = (model, ref) => model.surface.copy(ref) ?? model.surface.callbacks.get(ref.id);
const callback = value => value.type?.kind === "callback";
const ffi = value => `::Fiddle::TYPE_${value.ffi}`;

/** Public callable ownership without exposing the native representation. */
export const rubyClosurePublic = `    class LeanClosure
      def initialize
        raise TypeError, "Lean closures are returned by generated functions"
      end
      def call(*args)
        @lease.call(*args)
      end
      def closed?
        @lease.closed?
      end
      def close
        @lease.close
      end
      def with
        @lease.ensure_open
        begin
          yield self
        ensure
          close
        end
      end
      def initialize_copy(original)
        raise TypeError, "Lean closures cannot be copied"
      end
      def marshal_dump
        raise TypeError, "Lean closures cannot be serialized"
      end
    end
`;

/**
 * Render one ordinary export or owned-closure call with scoped cleanup.
 *
 * @param model - Admitted Ruby model.
 * @param root0 - Generated private call signature.
 * @param root0.name - Ruby helper name.
 * @param root0.symbol - Bound Fiddle entry point.
 * @param root0.parameters - Canonical parameter sites.
 * @param root0.result - Canonical result site.
 * @param root0.leading - Private arguments for closure invocation.
 */
export const rubyNativeCall = (model, { name, symbol, parameters, result, leading = [] }) => {
	const output = rubyValue(model, result.type), unit = output.scalarName === "unit", owned = callback(output);
	return `      def ${name}(${[...leading, ...parameters.map((_, i) => `arg${i}`)].join(", ")})
        ensure_process
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          output = nil
          begin
${parameters.map((site, i) => { const value = rubyValue(model, site.type); return `            input${i} = ${callback(value) ? "callback" : "to"}${value.index}(arg${i}${value.aggregate || callback(value) ? ", scope" : ""})`; }).join("\n")}
            ${unit ? "" : owned ? "output = owned_output" : `output = scope.allocate(${output.size})`}
            error = scope.allocate(24)
            enter_call
            begin
              check(${symbol}.call(${[...leading, ...parameters.map((_, i) => `input${i}`), ...unit ? [] : ["output"], "error"].join(", ")}), error, scope)
            ensure
              leave_call
            end
            ${owned ? `owned = own${output.index}(output)\n            output = nil\n            owned` : unit ? "UNIT" : `from${output.index}(${readRubyValue(output, "output")})`}
          ensure
            begin
              ${owned ? `DISPOSE${output.index}.call(output) if output` : output.aggregate ? `CLEAR${output.index}.call(output) if output` : ""}
            ensure
              scope.close
            end
          end
        end
      end`;
};

/**
 * Bind callback shapes and owned-closure entry points from the C header.
 *
 * @param model - Admitted Ruby model.
 */
export const rubyCallableTypes = model => [...model.surface.callbacks.values()].map(value => {
	const { parameters, result } = value.type.callable, output = rubyValue(model, result.type);
	const args = ["::Fiddle::TYPE_VOIDP", ...parameters.map(site => ffi(rubyValue(model, site.type))), ...output.scalarName === "unit" ? [] : ["::Fiddle::TYPE_VOIDP"], "::Fiddle::TYPE_VOIDP"];
	return `      ARGS${value.index} = [${args.join(", ")}].freeze
      OWNED${value.index} = ::Fiddle::Function.new(LIBRARY["${model.surface.prefix}_owned_${value.field}_call"], ARGS${value.index}, ::Fiddle::TYPE_INT, need_gvl: true)
      DISPOSE${value.index} = ::Fiddle::Function.new(LIBRARY["${model.surface.prefix}_owned_${value.field}_dispose"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID, need_gvl: true)`;
}).join("\n");

const leaseSupport = `      PID = ::Process.pid
      def owned_output
        pointer = ::Fiddle::Pointer.malloc(8, ::Fiddle::RUBY_FREE)
        begin
          pointer[0, 8] = "\\0" * 8
        rescue Exception
          pointer.call_free
          raise
        end
        pointer
      end
      def ensure_process
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        raise LeanBridgeError, "Lean packages cannot be used after fork; start a fresh process" unless ::Process.pid == PID
        active = ::Thread.current.thread_variable_get(:lean_bridge_native_call_fiber_v1)
        raise LeanBridgeError, "A native Lean call is suspended on another Fiber" if active && !active[0].equal?(::Fiber.current)
      end
      def enter_call
        ensure_process
        thread = ::Thread.current
        active = thread.thread_variable_get(:lean_bridge_native_call_fiber_v1)
        thread.thread_variable_set(:lean_bridge_native_call_fiber_v1, [::Fiber.current, active ? active[1] + 1 : 1])
      end
      def leave_call
        thread = ::Thread.current
        active = thread.thread_variable_get(:lean_bridge_native_call_fiber_v1)
        active[1] -= 1
        thread.thread_variable_set(:lean_bridge_native_call_fiber_v1, nil) if active[1].zero?
      end
      class Lease
        def initialize(invoke, dispose, pointer)
          @invoke, @dispose, @pointer = invoke, dispose, pointer
          @thread = ::Thread.current
          @lock = ::Monitor.new
          @active, @closed = 0, false
          ::ObjectSpace.define_finalizer(self, self.class.finalizer(pointer, dispose))
        end
        def self.finalizer(pointer, dispose)
          proc do
            begin
              dispose.call(pointer) if ::Process.pid == PID
            rescue Exception
              # Process shutdown must not run a second exception path.
            end
          end
        end
        def closed?
          @closed
        end
        def ensure_open
          Native.ensure_process
          raise LeanBridgeError, "Lean closure is closed" if @closed
          raise LeanBridgeError, "Lean closure must be called on its creating thread" unless ::Thread.current.equal?(@thread)
        end
        def call(*args)
          Native.ensure_process
          ::Thread.handle_interrupt(Exception => :never) do
            @lock.synchronize do
              ensure_open
              @active += 1
              begin
                @invoke.call(@pointer[0, 8].unpack1("Q<"), *args)
              ensure
                @active -= 1
                @dispose.call(@pointer) if @closed && @active.zero?
              end
            end
          end
        end
        def close
          Native.ensure_process
          ::Thread.handle_interrupt(Exception => :never) do
            @lock.synchronize do
              @closed = true
              @dispose.call(@pointer) if @active.zero?
            end
          end
          nil
        end
      end
`;

/**
 * Retain callbacks for the call, contain Ruby exits, and transfer leases once.
 *
 * @param model - Admitted Ruby model.
 */
export const rubyCallableSupport = model => `${leaseSupport}
${[...model.surface.callbacks.values()].map(value => {
	const { parameters, result } = value.type.callable, output = rubyValue(model, result.type), unit = output.scalarName === "unit";
	const args = ["_context", ...parameters.map((_, i) => `arg${i}`), ...unit ? [] : ["out"], "_error"];
	return `      def callback${value.index}(value, scope)
        raise TypeError, "Expected a synchronous callable" unless value.respond_to?(:call)
        function = ::Fiddle::Closure::BlockCaller.new(::Fiddle::TYPE_INT, ARGS${value.index}) do |${args.join(", ")}|
          callback_invoke${value.index}(value, scope, ${args.join(", ")})
        end
        scope.retain_callback(function)
        result = scope.allocate(16)
        result[0, 16] = [function.to_i, 0].pack("Q<Q<")
        result
      end
      def callback_invoke${value.index}(value, scope, ${args.join(", ")})
        status = 4
        begin
          unless scope.failure
            result = value.call(${parameters.map((site, i) => { const input = rubyValue(model, site.type); return `from${input.index}(arg${i})`; }).join(", ")})
            converted = to${output.index}(result${output.aggregate ? ", scope" : ""})
            ${unit ? "" : `out[0, ${output.size}] = ${output.aggregate ? `converted[0, ${output.size}]` : `[converted].pack("${output.pack}")`}`}
            status = 0
          end
        rescue Exception => failure
          scope.failure ||= failure
        ensure
          # Returning from this method contains throw/break/non-local return too.
          # Never unwind Ruby control flow through libffi or the Lean runtime.
          scope.failure ||= LocalJumpError.new("Callbacks must return normally; non-local exits are not supported") unless status.zero?
          return status
        end
      end
      def own${value.index}(output)
        raise LeanBridgeError, "Native result has a missing Lean closure" if output[0, 8].unpack1("Q<").zero?
        result = LeanClosure.allocate
        # Share the output box until transfer succeeds. Both cleanup paths clear
        # that box, so an exception after wrapping cannot dispose twice.
        result.instance_variable_set(:@lease, Lease.new(method(:invoke${value.index}), DISPOSE${value.index}, output))
        result
      end
${rubyNativeCall(model, { name: `invoke${value.index}`, symbol: `OWNED${value.index}`, parameters, result, leading: ["self_pointer"] })}`;
}).join("\n")}`;
