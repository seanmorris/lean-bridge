/**
 * Transactional Python lease consumption over the C input-owner handoff.
 *
 * @file
 */

/** Collect the leases used by conversion, without traversing mutable inputs twice. */
export const ownedPythonTransfers = `
class _OwnedInputTransfers:
    def __init__(self, state, count, scope):
        self.state = state
        self.finished = False
        self.owners = []
        self.leases = {}
        try:
            scope.charge("storage", count, 512)
            for _ in range(count):
                _R._owned_checkpoint()
                self.owners.append(_R._OwnedNativeOwner(state))
        except BaseException:
            self.close()
            raise

    def ready(self, lease):
        lease.require()
        if lease.state is not self.state or lease.scope is not None:
            raise _R.LeanBridgeError(1, "A transferred input requires an owning lease")
        if lease.input_move is not None:
            raise _R.LeanBridgeError(8, "The input lease already belongs to a handoff")

    def add(self, lease, group, scope):
        previous = None
        try:
            self.ready(lease)
            key = _b.id(lease)
            previous = self.leases.get(key)
            if previous is not None:
                if previous[1] != group:
                    raise _R.LeanBridgeError(1, "Two transferred inputs cannot consume the same lease")
                return
            scope.charge("storage", 256)
            _R._owned_checkpoint()
            self.leases[key] = (lease, group)
        finally:
            # A retained allocation traceback must not keep private owning
            # references after the surrounding transaction closes its ledger.
            lease = previous = None

    def arm(self):
        self.state.require()
        for owner in self.owners:
            if not owner.value.value:
                raise _R.LeanBridgeError(9, "Missing prepared input owner")
        for lease, _ in self.leases.values():
            self.ready(lease)
        # Slots stay alive through the call. C clears them immediately before
        # entering Lean, so a reentrant callback sees every moved alias closed.
        for lease, group in self.leases.values():
            lease.input_move = self.owners[group].slot

    def finish(self):
        if self.finished:
            return
        # Mark all consumed original owners before any release can run user
        # finalizers. A pre-handoff failure leaves every original slot intact.
        for lease, group in self.leases.values():
            signal = self.owners[group].slot
            if lease.input_move is signal and not signal.value.value:
                lease.slot.pending = True
        for lease, group in self.leases.values():
            if lease.input_move is self.owners[group].slot:
                lease.input_move = None
        self.finished = True
        self.state.drain()

    def close(self):
        try:
            self.finish()
        finally:
            for owner in self.owners:
                owner.close()
            self.owners.clear()
            self.leases.clear()

    def __del__(self):
        try:
            self.close()
        except BaseException:
            pass
`;
