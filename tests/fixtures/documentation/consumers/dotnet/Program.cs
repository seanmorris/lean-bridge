using LeanBridge.Alpha;

static void Check(bool condition, string message)
{
    if (!condition) throw new Exception(message);
}

using var box = new Box(42);
Check(box.Read() == 42 && ReferenceEquals(box.Identity(), box), "Box identity");
Console.WriteLine($"Box: {box.Read()}");

var payload = Alpha.RoundTrip(new Payload(
    true, 41, "Lean λ", new byte[] { 0, 255 }, new uint[] { 0, uint.MaxValue }));
Check(!payload.Enabled && payload.Count == 42 && payload.Label == "Lean λ"
    && payload.Bytes.Span.SequenceEqual(new byte[] { 0, 255 })
    && payload.Values.Span.SequenceEqual(new uint[] { 0, uint.MaxValue }), "Payload");
Console.WriteLine($"Payload count: {payload.Count}");

var callback = Alpha.WithCallback(40, value => value + 2);
Check(callback == 44, "Callback result");
Console.WriteLine($"Callback: {callback}");

using var adder = Alpha.MakeAdder(2);
Check(adder.Invoke(40) == 42, "Returned callable");
Console.WriteLine($"Callable: {adder.Invoke(40)}");

try
{
    Alpha.WithCallback(40, _ => throw new InvalidOperationException("callback marker"));
    throw new Exception("Callback failure was accepted");
}
catch (InvalidOperationException error) when (error.Message == "callback marker") { }

adder.Dispose();
adder.Dispose();
box.Dispose();
box.Dispose();
try
{
    box.Read();
    throw new Exception("Closed Box was accepted");
}
catch (DisposedResourceException) { }
try
{
    adder.Invoke(40);
    throw new Exception("Closed callable was accepted");
}
catch (DisposedResourceException) { }
Console.WriteLine("Errors and cleanup: passed");
