using System;

namespace LeanBridge.ResourceV1.NOMINAL;

// The same Lean definition has the same CLR type in every independently built
// package. Only generated adapters can construct or borrow one in normal C#.
public sealed class RESOURCE : IDisposable
{
    private readonly Func<string, (ulong, ulong)> _borrow;
    private readonly Action _dispose;
    private readonly Func<bool> _closed;
    private readonly Func<RESOURCE> _retain;
    private readonly Func<RESOURCE, bool> _same;

    internal RESOURCE(Func<string, (ulong, ulong)> borrow, Action dispose, Func<bool> closed,
        Func<RESOURCE> retain, Func<RESOURCE, bool> same)
    { _borrow = borrow; _dispose = dispose; _closed = closed; _retain = retain; _same = same; }
    internal (ulong, ulong) Borrow(string ledger) =>
        (_borrow ?? throw new InvalidOperationException("Unissued Lean resource"))(ledger);
    public bool IsClosed => _closed();
    public void Dispose() => _dispose();
    /// <summary>Return another independently disposable lease on the same Lean object.</summary>
    public RESOURCE Retain() => _retain();
    public bool SameResource(RESOURCE other) => _same(other);
}
