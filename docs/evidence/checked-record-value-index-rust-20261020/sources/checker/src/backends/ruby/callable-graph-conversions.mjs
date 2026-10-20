/**
 * Scoped Ruby callbacks and owned closures over bounded recursive values.
 * Temporary callback results remain alive until native copying finishes.
 *
 * @file
 */
import { generateCopiedRubyGraphConversions } from "./copied-graph-conversions.mjs";
import { compileCallableRubyGraphPackageModel } from "./callable-graph-model.mjs";

const support = `
      def graph_context
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError.new(5, reason)
        end
        active = ::Thread.current.thread_variable_get(:lean_bridge_native_call_fiber_v1)
        raise LeanBridgeError.new(5, "A native Lean call is suspended on another Fiber") if active && !active[0].equal?(::Fiber.current)
      end
      def graph_enter_call
        graph_context
        thread = ::Thread.current
        active = thread.thread_variable_get(:lean_bridge_native_call_fiber_v1)
        thread.thread_variable_set(:lean_bridge_native_call_fiber_v1, [::Fiber.current, active ? active[1] + 1 : 1])
      end
      def graph_leave_call
        thread = ::Thread.current
        active = thread.thread_variable_get(:lean_bridge_native_call_fiber_v1)
        active[1] -= 1
        thread.thread_variable_set(:lean_bridge_native_call_fiber_v1, nil) if active[1].zero?
      end
      def graph_require_callback(value)
        raise TypeError, "Expected a synchronous callable" unless value.respond_to?(:call)
      end
      def graph_dispose(pointer, dispose)
        token = pointer[0, 8].unpack1("Q<")
        pointer[0, 8] = "\\0" * 8
        dispose.call(token) unless token.zero?
      end
      def graph_owned_output
        graph_checkpoint
        pointer = ::Fiddle::Pointer.malloc(8, ::Fiddle::RUBY_FREE)
        begin
          pointer[0, 8] = "\\0" * 8
        rescue Exception
          pointer.call_free
          raise
        end
        pointer
      end
      class GraphCallableFrame
        attr_reader :scope, :thread, :alive, :nonlocal_failure
        attr_accessor :failure
        def initialize
          @callbacks = []
          @scope = GraphScope.new
          @thread = ::Thread.current
          @alive, @failure = true, nil
          @nonlocal_failure = LocalJumpError.new("Callbacks must return normally; non-local exits are not supported")
        end
        def retain(function)
          begin
            @callbacks << function
          rescue Exception
            function.free
            raise
          end
        end
        def close
          @alive = false
          begin
            @callbacks.reverse_each { |function| function.free unless function.freed? }
          ensure
            @callbacks.clear
            @scope.close
          end
        end
      end
      class GraphLease
        def initialize(invoke, dispose, pointer)
          @invoke, @dispose, @pointer = invoke, dispose, pointer
          @thread, @lock = ::Thread.current, ::Monitor.new
          @active, @closed = 0, false
          ::ObjectSpace.define_finalizer(self, self.class.finalizer(pointer, dispose))
        end
        def self.finalizer(pointer, dispose)
          proc do
            begin
              Native.graph_dispose(pointer, dispose) unless NativeCopiedRuntimeV1.context_error
            rescue Exception
              # Finalization must not raise into unrelated application work.
            end
          end
        end
        def closed?; @closed; end
        def ensure_open
          Native.graph_context
          raise LeanBridgeError.new(1, "Lean closure is closed") if @closed
          raise LeanBridgeError.new(1, "Lean closure must be called on its creating thread") unless ::Thread.current.equal?(@thread)
        end
        def call(*args)
          Native.graph_context
          ::Thread.handle_interrupt(Exception => :never) do
            @lock.synchronize do
              ensure_open
              @active += 1
              begin
                @invoke.call(@pointer[0, 8].unpack1("Q<"), *args)
              ensure
                @active -= 1
                Native.graph_dispose(@pointer, @dispose) if @closed && @active.zero?
              end
            end
          end
        end
        def close
          Native.graph_context
          ::Thread.handle_interrupt(Exception => :never) do
            @lock.synchronize do
              @closed = true
              Native.graph_dispose(@pointer, @dispose) if @active.zero?
            end
          end
          nil
        end
      end
      def graph_own(output, invoke, dispose)
        raise GraphInvalidNative, "Native result has a missing Lean closure" if output[0, 8].unpack1("Q<").zero?
        graph_checkpoint
        result = LeanClosure.allocate
        graph_checkpoint
        result.instance_variable_set(:@lease, GraphLease.new(invoke, dispose, output))
        result
      end
`;

/**
 * Generate contained callback trampolines and deterministic native cleanup.
 *
 * @param ir - Checked copied and synchronous callable Binding IR.
 */
export const generateCallableRubyGraphConversions = ir => {
	const model = compileCallableRubyGraphPackageModel(ir), generated = generateCopiedRubyGraphConversions(model.payloads.ir);
	const methods = [support], constants = [];
	const read = (node, value) => node.aggregate ? value : `${value}[0, ${node.size}].unpack1("${node.pack}")`;
	const write = (node, value) => node.aggregate ? `${value}[0, ${node.size}]` : `[${value}].pack("${node.pack}")`;
	const callableStatus = `raise frame.failure if frame.failure\n            raise LeanBridgeError.new(6, "Host callback failed") if status == 6\n            graph_status(status)`;
	const makeCall = (name, symbol, parameters, result, leading = false) => {
		const args = parameters.map((_, i) => `arg${i}`);
		const input = (parameter, i, checking) => parameter.callback
			? checking ? `graph_require_callback(arg${i})` : `callback${parameter.callback.index}(arg${i}, frame)`
			: `graph_input${parameter.node.index}(arg${i}, ${checking ? "checked" : "frame.scope"})`;
		return `      def ${name}(${[...leading ? ["token"] : [], ...args].join(", ")})
        graph_context
        ::Thread.handle_interrupt(Exception => :never) do
          checked = GraphScope.new(true)
          begin
${parameters.map((parameter, i) => `            ${input(parameter, i, true)}`).join("\n")}
          ensure
            checked.close
          end
          frame = GraphCallableFrame.new
          output = nil
          begin
${parameters.map((parameter, i) => parameter.callback || parameter.node.aggregate ? `            input${i} = ${input(parameter, i, false)}` : `            raw${i} = ${input(parameter, i, false)}\n            input${i} = frame.scope.allocate(${parameter.node.size})\n            input${i}[0, ${parameter.node.size}] = ${write(parameter.node, "raw" + i)}`).join("\n")}
            output = ${result.callback ? "graph_owned_output" : `frame.scope.allocate(${result.node.size})`}
${result.node?.kind === "variant" ? '            output[16, 4] = [(1 << 32) - 1].pack("L<")' : ""}
            graph_status(INITIALIZE.call)
            graph_enter_call
            begin
              status = ${symbol}.call(${[...leading ? ["token"] : [], ...args.map((_, i) => "input" + i), "output"].join(", ")})
            ensure
              graph_leave_call
            end
            ${callableStatus}
            raise LeanBridgeError.new(5, "Lean runtime is unavailable") if READY.call == 0
${result.callback ? `            owned = graph_own(output, method(:invoke${result.callback.index}), DISPOSE${result.callback.index})\n            output = nil\n            owned` : `            graph_output${result.node.index}(${read(result.node, "output")}, frame.scope)`}
          rescue GraphInvalidNative
            RETIRE.call
            raise
          ensure
            begin
              ${result.callback ? `graph_dispose(output, DISPOSE${result.callback.index}) if output` : result.node.aggregate ? "CLEAR.call(output) if output" : "# Scalar outputs have no native owner."}
            ensure
              frame.close
            end
          end
        end
      end`;
	};
	for(const callback of model.callbacks.values())
	{
		const { index, parameters, result } = callback, args = parameters.map((_, i) => "arg" + i);
		const ffi = Array(parameters.length + 2).fill("::Fiddle::TYPE_VOIDP");
		constants.push(`      ARGS${index} = [${ffi.join(", ")}].freeze\n      OWNED${index} = ::Fiddle::Function.new(LIBRARY["${callback.call}"], [-::Fiddle::TYPE_LONG_LONG, ${ffi.slice(1).join(", ")}], ::Fiddle::TYPE_INT, need_gvl: true)\n      DISPOSE${index} = ::Fiddle::Function.new(LIBRARY["${callback.dispose}"], [-::Fiddle::TYPE_LONG_LONG], ::Fiddle::TYPE_VOID, need_gvl: true)`);
		methods.push(`      def callback${index}(value, frame)
        graph_require_callback(value)
        function = ::Fiddle::Closure::BlockCaller.new(::Fiddle::TYPE_INT, ARGS${index}) do |context, ${[...args, "output"].join(", ")}|
          callback_invoke${index}(value, frame, context, ${[...args, "output"].join(", ")})
        end
        frame.retain(function)
        result = frame.scope.allocate(16)
        result[0, 16] = [function.to_i, 0].pack("Q<Q<")
        result
      end
      def callback_invoke${index}(value, frame, _context, ${[...args, "output"].join(", ")})
        status = 6
        begin
          if frame.alive && !frame.failure && ::Thread.current.equal?(frame.thread)
${parameters.map((node, i) => `            value${i} = graph_output${node.index}(${read(node, args[i])}, frame.scope)`).join("\n")}
            result = value.call(${args.map((_, i) => "value" + i).join(", ")})
            converted = graph_input${result.index}(result, frame.scope)
            output[0, ${result.size}] = ${write(result, "converted")}
            status = 0
          end
        rescue Exception => failure
          RETIRE.call if EXACT.bind_call(failure, GraphInvalidNative)
          frame.failure ||= failure
        ensure
          frame.failure ||= frame.nonlocal_failure unless status.zero?
          return status
        end
      end`);
		methods.push(makeCall("invoke" + index, "OWNED" + index, parameters.map(node => ({ node })), { node: result }, true));
	}
	for(const fn of model.functions)
	{
		constants.push(`      CALL${fn.index} = ::Fiddle::Function.new(LIBRARY["${fn.native}"], [${Array(fn.parameters.length + 1).fill("::Fiddle::TYPE_VOIDP").join(", ")}], ::Fiddle::TYPE_INT, need_gvl: true)`);
		methods.push(makeCall("call" + fn.index, "CALL" + fn.index, fn.parameters, fn.result));
	}
	return { model, source: generated.source, constants: constants.join("\n"), methods: methods.join("\n") };
};
