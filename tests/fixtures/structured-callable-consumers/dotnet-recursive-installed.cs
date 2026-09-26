using System;
using System.IO;
using System.Numerics;
using LeanBridge.Structured;

internal static class Program
{
    private static int checks;
    private sealed class Marker : Exception { }
    private static void Check(bool condition) { ++checks; if (!condition) throw new Exception("installed prototype assertion " + checks); }
    private static void Reject<T>(Action action) where T : Exception
    { try { action(); } catch (T) { ++checks; return; } throw new Exception("expected " + typeof(T).Name); }
    private static bool LeanLoaded() => File.ReadAllText("/proc/self/maps").Contains("liblean_bridge_native.so", StringComparison.Ordinal);
    private static int Main(string[] args)
    {
        try
        {
            var mode = args.Length == 0 ? "public" : args[0];
            if (mode == "acyclic") { AcyclicCases.Run(); return 0; }
            var leaf = new TreeLeaf((BigInteger.One << 257) + 19);
            var tree = new TreeBranch(new Tree[] { leaf, new TreeBranch(Array.Empty<Tree>()) });
            if (mode == "cold")
            {
                Check(!LeanLoaded());
                Reject<ArgumentException>(() => Api.CallRecursive(new TreeLeaf(-1), value => value));
                Reject<ArgumentNullException>(() => Api.CallRecursive(tree, null!));
                var cycle = new TreeBranch(new Tree[1]); cycle.Children[0] = cycle;
                Reject<ArgumentException>(() => Api.CallRecursive(cycle, value => value));
                Check(!LeanLoaded());
            }
            else if (mode == "tampered")
            {
                Check(!LeanLoaded()); var rejected = false;
                try { Api.CallRecursive(tree, value => value); }
                catch (InvalidOperationException error) { rejected = error.Message.Contains("differs from the compiled package", StringComparison.Ordinal); }
                Check(rejected); Check(!LeanLoaded());
            }
            else
            {
                Check(!LeanLoaded()); var count = 0;
                var copied = (TreeBranch)Api.CallRecursive(tree, value => {
                    ++count; Check(value.Equals(tree)); Check(!ReferenceEquals(value, tree));
                    GC.Collect(); GC.WaitForPendingFinalizers(); return value;
                });
                Check(LeanLoaded()); Check(count == 1); Check(copied.Equals(tree));
                Check(!ReferenceEquals(copied.Children, tree.Children));
                using (var closure = Api.MakeRecursive(tree))
                {
                    Check(closure.Invoke(true, leaf).Equals(tree));
                    Check(closure.Invoke(false, leaf).Equals(leaf));
                    Check(Api.CallRecursive(tree, value => closure.Invoke(false, value)).Equals(tree));
                    closure.Dispose(); Check(closure.IsClosed); closure.Dispose();
                    Reject<ObjectDisposedException>(() => closure.Invoke(false, leaf));
                }
                var marker = new Marker();
                try { Api.CallRecursive(tree, _ => throw marker); throw new Exception("missing callback exception"); }
                catch (Marker error) { Check(ReferenceEquals(marker, error)); }
                var payload = new Payload("a\0λ", Array.Empty<Option<string>>(), 19, Option<Result<(ulong, Unit), string>>.None);
                using var alias = Api.MakeNestedAlias(payload);
                Check(Api.CallNestedAlias(payload, alias.Invoke) == "a\0λ<none>a\0λ");
                Check(Api.TwiceRecursive(tree, value => value).Equals(tree));
            }
            Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { mode, checks })); return 0;
        }
        catch (Exception error) { Console.Error.WriteLine(error); return 32; }
    }
}
