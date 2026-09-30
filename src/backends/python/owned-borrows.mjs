/**
 * Whole-result Python owners and original-slot input consumption.
 *
 * @file
 */

export const ownedPythonAnchoredValues = `
from typing import Generic as _Generic, TypeVar as _TypeVar
_ValueT = _TypeVar("_ValueT")

class _OwnedValueStorage:
    __slots__ = ("lease", "value", "copy")
    def __init__(self, lease, value, copier):
        self.lease = lease
        self.value = value
        self.copy = copier

class Value(_Generic[_ValueT]):
    __slots__ = ("_storage",)
    __hash__ = None

    def __init__(self, *_):
        raise TypeError("Value owners come from Lean functions or copy_value()")

    @classmethod
    def _from_owned(cls, lease, value, copier):
        try:
            lease.require()
            _owned_checkpoint()
            storage = _OwnedValueStorage(lease, value, copier)
            _owned_checkpoint()
            result = object.__new__(cls)
            result._storage = storage
            return result
        finally:
            lease = value = copier = storage = None

    def _lease(self, state):
        storage = None
        try:
            storage = self._storage
            if storage is None:
                raise LeanBridgeError(4)
            storage.lease.require()
            if storage.lease.state is not state:
                raise LeanBridgeError(1)
            return storage.lease
        finally:
            storage = None

    def get(self):
        storage = None
        try:
            storage = self._storage
            if storage is None:
                raise LeanBridgeError(4)
            storage.lease.require()
            return storage.value
        finally:
            storage = None

    @property
    def is_closed(self):
        return self._storage is None or self._storage.lease.closed

    def close(self):
        self._storage = None

    def retain(self):
        storage = None
        try:
            value = self.get()
            storage = self._storage
            return storage.copy(value, _whole=True)
        finally:
            storage = value = None

    def __copy__(self):
        self.get()
        _owned_checkpoint()
        result = object.__new__(type(self))
        result._storage = self._storage
        return result

    def __deepcopy__(self, memo):
        raise TypeError("Use retain() for independent Lean ownership")

    def __reduce__(self):
        raise TypeError("Lean owners cannot be serialized")

    def __reduce_ex__(self, protocol):
        raise TypeError("Lean owners cannot be serialized")

    def __enter__(self):
        self.get()
        return self

    def __exit__(self, *_):
        self.close()

    def __call__(self, *args, **kwargs):
        return self.get()(*args, **kwargs)

    def __eq__(self, other):
        if type(other) is not Value:
            return NotImplemented
        return self.get() == other.get()
`;

export const ownedPythonAnchoredTransfers = `
class _OwnedInputTransfers:
    def __init__(self, state, count, scope):
        self.state = state
        self.finished = False
        self.armed = False
        scope.charge("storage", count, 256)
        _R._owned_checkpoint()
        self.groups = [None] * count

    def ready(self, lease):
        try:
            lease.require()
            if lease.state is not self.state or lease.scope is not None or lease.borrowed_result:
                raise _R.LeanBridgeError(1, "A transferred input requires an original owning result")
            if lease.input_move is not None:
                raise _R.LeanBridgeError(8, "The input owner already belongs to a handoff")
        finally:
            lease = None

    def add(self, lease, group):
        try:
            self.ready(lease)
            if self.groups[group] is not None or any(previous is lease for previous in self.groups):
                raise _R.LeanBridgeError(1, "Two transferred inputs cannot consume the same owner")
            _R._owned_checkpoint()
            self.groups[group] = lease
        finally:
            lease = None

    def slot(self, group):
        return _c.byref(self.groups[group].slot.value)

    def arm(self):
        lease = None
        try:
            for lease in self.groups:
                self.ready(lease)
            self.armed = True
            for lease in self.groups:
                lease.input_move = lease.slot
        finally:
            lease = None

    def finish(self):
        if self.finished or not self.armed:
            return
        for lease in self.groups:
            if not lease.slot.value.value:
                lease.slot.pending = True
            lease.input_move = None
        self.finished = True
        self.state.drain()

    def close(self):
        try:
            self.finish()
        finally:
            self.groups.clear()
`;

/**
 * Generate a call that keeps whole owners, including empty output constructors.
 *
 * @param model - Typed native call and public group.
 * @param all - Ordered native call table.
 * @param c - Checked native ownership contract.
 */
export const ownedPythonAnchoredCall = (model, all, c) => {
	const { name, native, parameters, result } = model;
	const moving = model.transfers ?? [], anchored = model.anchor;
	const wraps = index => anchored === index || moving.includes(index);
	const signature = { ...model, parameters: parameters.map(node => node.id) };
	const host = parameters.map((_, i) => c.hostArgument(signature, i));
	const input = (node, i, checking) => host[i]
		? `_owned_host${node.index}(arg${i}, ${checking ? "checked" : "scope, frame"})`
		: `_owned_input${node.index}(${wraps(i) ? `arg${i}.get()` : `arg${i}`}, ${checking ? "checked" : "scope"})`;
	const helper = ["copy", "retain"].includes(model.group);
	const copy = all.find(item => (item.copy || item.retain) && item.id === result.id);
	const copied = result.representation === "copied";
	const copyName = copy ? `_${copy.copy ? "copy" : "retain"}${result.index}` : "None";
	const arguments_ = ["session"
		, ...parameters.flatMap((node, i) => [host[i] || !node.leaf ? `_c.byref(input${i})` : `input${i}`
			, ...moving.includes(i) ? [`moves.slot(${moving.indexOf(i)})`] : []
			, ...anchored === i ? ["anchor"] : []])
		, "_c.byref(raw)", "_c.byref(owner.value)"];
	return [`def ${name}(${[...parameters.map((_, i) => `arg${i}`), ...helper ? ["*, _whole=False"] : []].join(", ")}):`
		, "    if _runtime is None: raise RuntimeError('Build the native adapter before calling this API')"
		, "    state = _runtime.current_state()"
		, "    checked = _OwnedScope(state, True)"
		, "    scope = frame = moves = output = value = None"
		, ...parameters.flatMap((_, i) => wraps(i) ? [`    owner${i} = None`] : [])
		, "    try:"
		, ...parameters.flatMap((node, i) => [...wraps(i) ? [
			`        if type(arg${i}) is not _R.Value: raise TypeError("arg${i} requires a Value owner")`
			, `        owner${i} = arg${i}._lease(state)`] : []
		, `        ${input(node, i, true)}`])
		, "        scope = _OwnedScope(state)"
		, "        frame = _OwnedCall(state, scope)"
		, ...moving.length ? [`        moves = _OwnedInputTransfers(state, ${moving.length}, scope)`
			, ...moving.map((parameter, group) => `        moves.add(owner${parameter}, ${group})`)] : []
		, ...parameters.map((node, i) => `        input${i} = ${input(node, i, false)}`)
		, `        raw = scope.value(${result.raw})`
		, "        with _R._OwnedNativeOwner(state) as owner:"
		, "            session = state.require()"
		, ...anchored !== undefined ? [`            anchor = owner${anchored}.owner(state)`] : []
		, ...moving.length ? ["            moves.arm()", "            try:"] : []
		, `            ${moving.length ? "    " : ""}status = ${native}(${arguments_.join(", ")})`
		, ...moving.length ? ["            finally:", "                moves.finish()"] : []
		, "            frame.finish(status)"
		, `            output = _OwnedOutput(owner, anchored=${anchored === undefined ? "False" : "True"})`
		, `            value = _owned_output${result.index}(raw, scope, output)`
		, ...copied ? ["            return value"] : [
			...helper ? ["            if not _whole: return value"] : []
			, `            return _R.Value._from_owned(output.hold(), value, ${copyName})`]
		, "    except _OwnedInvalidNative:"
		, "        _runtime.retire()", "        raise"
		, "    finally:", "        if moves is not None: moves.close()"
		, "        if frame is not None: frame.close()"
		, "        if scope is not None: scope.close()"
		, "        checked.close()", "        output = value = None"
		, ...parameters.flatMap((_, i) => wraps(i) ? [`        owner${i} = None`] : [])
		, ...parameters.map((_, i) => `        arg${i} = None`)
		, "" ];
};

/**
 * Use named values or a generated declaration to choose an exact copy type.
 *
 * @param values - Public Python declaration model.
 * @param models - Bound private calls.
 */
export const ownedPythonValueCopies = (values, models) => {
	const copy = node => models.find(model => (model.copy || model.retain) && model.id === node.id).name;
	const nodes = new Map(values.types.map(node => [node.id, node]));
	const roots = values.types.filter(node => node.representation !== "copied");
	return ["_value_nominals = {"
		, ...roots.flatMap(node => (node.kind === "variant" ? node.cases.map(branch => branch.publicName)
			: node.identity || node.kind === "record" ? [node.publicType] : []).map(name => `    _V.${name}: ${copy(node)},`))
		, "}"
		, "_value_results = {"
		, ...values.functions.filter(fn => nodes.get(fn.result).representation !== "copied")
			.map(fn => `    _V.${fn.publicName}: ${copy(nodes.get(fn.result))},`)
		, "}"
		, "_value_parameters = {"
		, ...values.functions.flatMap(fn => fn.parameters.flatMap((id, i) => nodes.get(id).representation === "copied" ? []
			: [`    (_V.${fn.publicName}, "arg${i}"): ${copy(nodes.get(id))},`]))
		, "}"
		, "", "def _copy_value(value, *, result_of=None, parameter_of=None):"
		, "    if result_of is not None and parameter_of is not None:"
		, '        raise TypeError("Choose result_of or parameter_of, not both")'
		, "    copier = None", "    try:"
		, "        if result_of is not None: copier = _value_results.get(result_of)"
		, "        elif parameter_of is not None: copier = _value_parameters.get(parameter_of)"
		, "        else: copier = _value_nominals.get(type(value))"
		, "        if copier is None:"
		, '            raise TypeError("Choose a generated result_of=function or parameter_of=(function, argument_name) for this value")'
		, "        return copier(value, _whole=True)", "    finally:"
		, "        value = copier = None", ""].join("\n");
};
