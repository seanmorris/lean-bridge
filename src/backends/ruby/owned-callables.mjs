/**
 * Contained synchronous Ruby callbacks with borrowed inputs and owned replies.
 *
 * @file
 */
import { ownedCallbackRecovery } from "../../build/owned-callback-carriers.mjs";

const support = `
      class CallFrame
        attr_reader :state, :scope, :alive, :nonlocal_failure
        attr_accessor :failure
        def initialize(state, scope)
          @state, @scope, @alive, @failure = state, scope, true, nil
          @nonlocal_failure = ::LocalJumpError.new("Callbacks must return normally; non-local exits are not supported")
          @suspension_failure = ::FiberError.new("Owned callbacks must return synchronously without switching Fibers")
          @trace = nil
        end
        def invoke
          unless @trace
            @scope.charge(:storage, 512)
            Owned.checkpoint
            @trace = ::TracePoint.new(:c_call) do |event|
              method = event.method_id
              if (event.defined_class.equal?(::Fiber) && (method == :resume || method == :transfer || method == :raise)) ||
                  (event.defined_class.equal?(::Fiber.singleton_class) && (method == :yield || method == :schedule))
                raise @suspension_failure
              end
            end
          end
          @trace.enable(target_thread: ::Thread.current) { yield }
        end
        def finish(status)
          raise @failure if @failure
          Owned.check(status)
        end
        def close
          @alive = false
          @failure = nil
          @trace&.disable
        end
      end
      def require_callback(value)
        raise TypeError, "Expected a synchronous callable" unless value.respond_to?(:call)
      end
`;

/**
 * Snapshot replies under live borrow frames and contain every Ruby nonlocal exit.
 * Fiber suspension is rejected before the switch, so abandoned native callback
 * stacks cannot strand native ownership scopes on a dead thread.
 *
 * @param model - Resource-aware public Ruby types and layouts.
 * @param boundary - Typed C forwarders and callback trampolines.
 * @param access - Raw storage expression generators.
 */
export const ownedRubyCallbacks = (model, boundary, access) => {
	const lines = [support], { c } = model;
	for(const callback of boundary.callbacks)
	{
		const { node, result, parameters } = callback, i = node.index;
		const args = parameters.map((_, j) => `arg${j}`), automatic = ownedCallbackRecovery(c.native.model, node, id => id) !== null;
		const copy = boundary.calls.find(fn => (fn.retain || fn.copy) && fn.id === result.id);
		const output = (parameter, j) => access.read(parameter, `pointer(arg${j}.to_i, ${parameter.size}, ${parameter.alignment})`);
		lines.push(`      def host${i}(value, scope, frame = nil)
${c.functions.some(fn => fn.anchor !== undefined) ? "        value = VALUE_GET.bind_call(value) if exact?(value, Owned::Value)\n" : ""}\
        scope.enter(nil, 0, 32)
        if exact?(value, ::${model.namespace}::${node.publicType})
          handle = input${i}(value, scope)
          descriptor = scope.allocate(32)
          descriptor[16, 8] = [handle].pack("Q<") unless scope.check_only
          return descriptor
        end
        wrapped = exact?(value, ::${model.namespace}::WithRecovery)
        function, recovery = wrapped ? DATA_FIELDS.bind_call(value) : [value, nil]
        require_callback(function)
${automatic ? "" : '        raise TypeError, "This callback requires with_recovery(function, value)" unless wrapped'}
        converted = input${result.index}(recovery, scope) if wrapped
        return nil if scope.check_only
        descriptor = scope.allocate(32)
        if wrapped
${result.aggregate ? "          recovery_pointer = converted" : `          recovery_pointer = scope.allocate(${result.size})\n          ${access.write(result, "recovery_pointer", 0, "converted")}`}
          descriptor[24, 8] = [recovery_pointer.to_i].pack("Q<")
        end
        Owned.checkpoint
        native = ::Fiddle::Closure::BlockCaller.new(::Fiddle::TYPE_INT, [${Array(parameters.length + 4).fill("::Fiddle::TYPE_VOIDP").join(", ")}]) do |_context, session, ${args.concat("output", "owner").join(", ")}|
          callback${i}(function, frame, session, ${args.concat("output", "owner").join(", ")})
        end
        scope.pin_closure(native)
        descriptor[0, 8] = [native.to_i].pack("Q<")
        descriptor
      end
      def callback${i}(function, frame, session, ${args.concat("destination", "owner").join(", ")})
        status = 10
        borrowed = incoming = reply_scope = nil
        begin
          if frame.alive && !frame.failure
            state = frame.state
            raise Invalid, "Invalid native callback session" unless state.require_open == session.to_i
            destination = pointer(destination.to_i, ${result.size}, ${result.alignment})
            owner = pointer(owner.to_i, 8, 8)
            raise Invalid, "Native callback owner is not empty" unless owner[0, 8].unpack1("Q<").zero?
            borrowed = Owned::BorrowFrame.new(state)
            incoming = ValueScope.new(state, false, frame.scope.budget)
            borrowed_output = Output.new(nil, borrowed.lease)
${parameters.map((parameter, j) => `            value${j} = output${parameter.index}(${output(parameter, j)}, incoming, borrowed_output)`).join("\n")}
            reply = frame.invoke { function.call(${args.map((_, j) => `value${j}`).join(", ")}) }
            reply_scope = ValueScope.new(state, false, frame.scope.budget)
            converted = input${result.index}(reply, reply_scope)
${result.aggregate ? "            raw = converted" : `            raw = reply_scope.allocate(${result.size})\n            ${access.write(result, "raw", 0, "converted")}`}
            # C owns this reply slot, including failure after publication.
            Owned.check(@functions[:${copy.name}].call(state.require_open, raw, destination, owner))
            Owned.checkpoint
            status = 0
          end
        rescue ::Exception => failure
          frame.failure ||= failure
        ensure
          begin
            reply_scope&.close
          rescue ::Exception => failure
            frame.failure ||= failure
            status = 10
          ensure
            begin
              incoming&.close
            rescue ::Exception => failure
              frame.failure ||= failure
              status = 10
            ensure
              borrowed&.close
            end
          end
          frame.failure ||= frame.nonlocal_failure unless status.zero?
          return status
        end
      end`);
	}
	return lines.join("\n");
};
