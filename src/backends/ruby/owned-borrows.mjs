/**
 * Whole Ruby result owners and original-slot transfers for anchored outputs.
 *
 * @file
 */

export const ownedRubyAnchoredValues = `
  class ValueGuard < Guard
    attr_reader :payload
    def initialize(lease, payload)
      @payload = payload
      super(lease, 0, true)
    end
    def close(finalizing = false)
      super
    ensure
      @payload = nil
    end
  end
  class Value
    def initialize(*)
      raise TypeError, "Value owners come from Lean functions or copy_value"
    end
    def self.from_lease(lease, value, copier)
      Owned.atomic do
        lease.require_open
        Owned.checkpoint
        payload = [value, copier].freeze
        Owned.checkpoint
        result = allocate
        result.__send__(:install, lease, payload)
        result
      end
    end
    def install(lease, payload)
      @guard = nil
      Owned.checkpoint
      guard = ValueGuard.new(lease, payload)
      begin
        Owned.checkpoint
        ::ObjectSpace.define_finalizer(self, Guard.finalizer(guard))
        @guard = guard
      rescue Exception
        guard.close
        raise
      end
    end
    private :install
    def lease(state)
      raise Error, 4 unless @guard && !@guard.released?
      @guard.lease.require_open
      raise Error, 1 unless @guard.lease.state.equal?(state)
      @guard.lease
    end
    private :lease
    def get
      raise Error, 4 unless @guard && !@guard.released?
      @guard.lease.require_open
      @guard.payload[0]
    end
    def closed?; !@guard || @guard.closed?; end
    def close
      Owned.atomic { @guard&.close }
      nil
    end
    def retain
      value = get
      @guard.payload[1].call(value, whole: true)
    end
    def dup; Owned.atomic { super }; end
    def clone(**options); Owned.atomic { super(**options) }; end
    def initialize_copy(original)
      ::ObjectSpace.undefine_finalizer(self)
      @guard = nil
      Owned.atomic do
        guard = original.instance_variable_get(:@guard)
        raise Error, 4 unless guard && !guard.released?
        guard.lease.require_open
        install(guard.lease, guard.payload)
      end
    end
    def with
      get
      begin
        yield self
      ensure
        close
      end
    end
    def call(*args, **keywords); get.call(*args, **keywords); end
    def ==(other)
      value = get
      other.instance_of?(Value) && value == other.get
    end
    alias eql? ==
    def hash; raise TypeError, "Lean owners cannot be used as Hash keys"; end
    def marshal_dump; raise TypeError, "Lean owners cannot be serialized"; end
    def _dump(*); raise TypeError, "Lean owners cannot be serialized"; end
    def inspect; "#<#{self.class} #{closed? ? 'closed' : 'open'}>"; end
    alias to_s inspect
  end
`;

export const ownedRubyAnchoredTransfers = `
      class InputTransfers
        def initialize(state, count, scope)
          @state, @armed, @finished = state, false, false
          scope.charge(:storage, count, 256)
          Owned.checkpoint
          @groups = ::Array.new(count)
        end
        def ready(lease)
          lease.require_open
          unless lease.state.equal?(@state) && !lease.scope && !lease.borrowed_result
            raise Owned::Error.new(1, "A transferred input requires an original owning result")
          end
          raise Owned::Error.new(8, "The input owner already belongs to a handoff") if lease.input_move
        end
        def add(lease, group)
          ready(lease)
          if @groups[group] || @groups.any? { |previous| previous.equal?(lease) }
            raise Owned::Error.new(1, "Two transferred inputs cannot consume the same owner")
          end
          Owned.checkpoint
          @groups[group] = lease
        end
        def slot(group); @groups.fetch(group).slot.pointer; end
        def arm
          @groups.each { |lease| ready(lease) }
          @armed = true
          @groups.each { |lease| lease.input_move = lease.slot }
        end
        def finish
          return if @finished || !@armed
          @groups.each do |lease|
            lease.slot.pending = true if lease.slot.value.zero?
            lease.input_move = nil
          end
          @finished = true
          @state.drain
        end
        def close
          begin
            finish
          ensure
            @groups.clear
          end
        end
      end
`;

/**
 * Pass original input owners and preserve the lifetime of empty whole results.
 *
 * @param fn - Typed call boundary.
 * @param boundary - All available copy and retain entry points.
 * @param access - Raw value read and write expressions.
 */
export const ownedRubyAnchoredCall = (fn, boundary, access) => {
	const { parameters, result, hosts } = fn, moving = fn.transfers ?? [];
	const wraps = i => moving.includes(i) || fn.anchor === i;
	const helper = ["copy", "retain"].includes(fn.group);
	const whole = result.representation === "copied" ? "false" : helper ? "whole" : "true";
	const copier = boundary.calls.find(item => (item.copy || item.retain) && item.id === result.id);
	const args = parameters.map((_, i) => `arg${i}`);
	const input = (node, i, check) => hosts[i]
		? `host${node.index}(arg${i}, ${check ? "checked" : "scope, frame"})`
		: `input${node.index}(${wraps(i) ? `VALUE_GET.bind_call(arg${i})` : `arg${i}`}, ${check ? "checked" : "scope"})`;
	const inputs = parameters.flatMap((node, i) => [
		...wraps(i) ? [`            scope.pin_lease(owner${i})`] : []
		, ...hosts[i] || node.aggregate ? [`            input${i} = ${input(node, i, false)}`]
			: [`            converted${i} = ${input(node, i, false)}`
				, `            input${i} = scope.allocate(${node.size})`
				, `            ${access.write(node, `input${i}`, 0, `converted${i}`)}`]
	]);
	const native = ["session"
		, ...parameters.flatMap((_, i) => [`input${i}`
			, ...moving.includes(i) ? [`moves.slot(${moving.indexOf(i)})`] : []
			, ...fn.anchor === i ? ["anchor"] : []])
		, "raw", "owner.pointer"];
	const checks = parameters.flatMap((node, i) => [
		...wraps(i) ? [
			`            raise TypeError, "arg${i} requires a Value owner" unless exact?(arg${i}, Owned::Value)`
			, `            owner${i} = VALUE_LEASE.bind_call(arg${i}, state)`] : []
		, `            ${input(node, i, true)}`]);
	return `      def ${fn.name}(${[...args, ...helper ? ["whole: false"] : []].join(", ")})
        raise RuntimeError, "Build the native adapter before calling this API" unless @runtime
        Owned.atomic do
          state = @runtime.current_state
          checked, scope, frame, moves = nil, nil, nil, nil
          begin
            checked = ValueScope.new(state, true)
${checks.join("\n")}
            scope = ValueScope.new(state)
            frame = CallFrame.new(state, scope)
${moving.length ? `            moves = InputTransfers.new(state, ${moving.length}, scope)
${moving.map((i, group) => `            moves.add(owner${i}, ${group})`).join("\n")}\n` : ""}\
${inputs.join("\n")}
            raw = scope.allocate(${result.size})
            state.with_result do |owner|
              session = state.require_open
${fn.anchor === undefined ? "" : `              anchor = owner${fn.anchor}.owner(state)\n`}\
${moving.length ? "              moves.arm\n              begin\n" : ""}\
              ${moving.length ? "  " : ""}status = @functions[:${fn.name}].call(${native.join(", ")})
${moving.length ? "              ensure\n                moves.finish\n              end\n" : ""}\
              frame.finish(status)
              output = Output.new(owner, nil, ${fn.anchor === undefined ? "false" : "true"}, ${whole})
              value = output${result.index}(${access.read(result, "raw")}, scope, output)
              ${whole === "false" ? "value" : `${whole} ? Owned::Value.from_lease(output.hold, value, method(:${copier.name})) : value`}
            end
          rescue Invalid
            @runtime.retire
            raise
          ensure
            begin
              moves&.close
            ensure
              begin
                frame&.close
              ensure
                begin
                  scope&.close
                ensure
                  checked&.close
                end
              end
            end
          end
        end
      end`;
};

/**
 * Select exact resource-containing copy shapes without executing a declaration.
 *
 * @param model - Public types and functions.
 * @param boundary - Generated private calls.
 */
export const ownedRubyValueCopies = (model, boundary) => {
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const copy = id => boundary.calls.find(fn => (fn.copy || fn.retain) && fn.id === id).name;
	const roots = model.types.filter(node => node.representation !== "copied");
	const parameters = model.functions.flatMap(fn => fn.parameters.flatMap((id, i) => nodes.get(id).representation === "copied" ? []
		: [`            [:${fn.publicName}, :arg${i}] => :${copy(id)}`]));
	const nominals = roots.flatMap(node => (node.kind === "variant" ? node.cases.map(branch => branch.publicName)
		: node.identity || node.kind === "record" ? [node.publicType] : [])
		.map(name => `          copier = :${copy(node.id)} if exact?(value, ::${model.namespace}::${name})`));
	return `      def copy_value(value, result_of: nil, parameter_of: nil)
        raise TypeError, "Choose result_of or parameter_of, not both" if result_of && parameter_of
        copier = nil
        if result_of
          raise TypeError, "result_of requires a generated function Symbol" unless exact?(result_of, ::Symbol)
          copier = {
${model.functions.filter(fn => nodes.get(fn.result).representation !== "copied").map(fn => `            ${fn.publicName}: :${copy(fn.result)}`).join(",\n")}
          }[result_of]
        elsif parameter_of
          unless exact?(parameter_of, ::Array) && parameter_of.length == 2 && parameter_of.all? { |item| exact?(item, ::Symbol) }
            raise TypeError, "parameter_of requires [function_symbol, argument_symbol]"
          end
          copier = {
${parameters.join(",\n")}
          }[parameter_of]
        else
${nominals.join("\n")}
        end
        raise TypeError, "Choose a generated result_of or parameter_of for this value" unless copier
        __send__(copier, value, whole: true)
      end`;
};
