/**
 * Managed input leases follow the pinned native snapshot-owner slots.
 *
 * @file
 */

/** Consume the converted lease set at the C handoff, including callback reentry. */
export const ownedDotnetTransfers = `internal sealed class OwnedInputTransfers : global::System.IDisposable
{
    private readonly OwnedState state;
    internal readonly OwnedResult[] Owners;
    private readonly global::System.Collections.Generic.Dictionary<OwnedLease, int> leases;
    private bool finished;
    internal OwnedInputTransfers(OwnedState state, int count, OwnedValueScope scope)
    {
        this.state = state;
        scope.Storage((nuint)count, 256); OwnedRuntime.Checkpoint();
        Owners = new OwnedResult[count];
        OwnedRuntime.Checkpoint();
        leases = new(global::System.Collections.Generic.ReferenceEqualityComparer.Instance);
        try
        {
            for (int index = 0; index < count; index++)
            { OwnedRuntime.Checkpoint(); Owners[index] = new OwnedResult(state); }
        }
        catch { Dispose(); throw; }
    }
    private void Ready(OwnedLease lease)
    {
        lease.Require();
        if (!global::System.Object.ReferenceEquals(lease.State, state) || lease.Scope is not null) OwnedRuntime.Check(1);
        if (lease.InputMove is not null) OwnedRuntime.Check(8);
    }
    internal void Add(OwnedLease lease, int group, OwnedValueScope scope)
    {
        Ready(lease);
        if (leases.TryGetValue(lease, out int previous))
        {
            if (previous != group) OwnedRuntime.Check(1);
            return;
        }
        scope.Storage(256); OwnedRuntime.Checkpoint(); leases.Add(lease, group);
    }
    internal void Arm()
    {
        state.Require();
        foreach (var owner in Owners) if (owner.TransferSlot.Value == 0) OwnedRuntime.Check(9);
        foreach (var lease in leases.Keys) Ready(lease);
        foreach (var pair in leases) pair.Key.InputMove = Owners[pair.Value].TransferSlot;
    }
    internal void Finish()
    {
        if (finished) return;
        // Mark every original owner before releases can run user finalizers.
        foreach (var pair in leases)
        {
            var signal = Owners[pair.Value].TransferSlot;
            if (global::System.Object.ReferenceEquals(pair.Key.InputMove, signal) && signal.Value == 0)
                global::System.Threading.Volatile.Write(ref pair.Key.Slot!.Pending, 1);
        }
        foreach (var pair in leases)
            if (global::System.Object.ReferenceEquals(pair.Key.InputMove, Owners[pair.Value].TransferSlot)) pair.Key.InputMove = null;
        finished = true;
        state.Drain();
    }
    public void Dispose()
    {
        try { Finish(); }
        finally
        {
            global::System.Exception? failure = null;
            for (int index = Owners.Length - 1; index >= 0; index--)
                try { Owners[index]?.Dispose(); } catch (global::System.Exception error) { failure ??= error; }
            leases.Clear();
            if (failure is not null) global::System.Runtime.ExceptionServices.ExceptionDispatchInfo.Capture(failure).Throw();
        }
    }
}
`;
