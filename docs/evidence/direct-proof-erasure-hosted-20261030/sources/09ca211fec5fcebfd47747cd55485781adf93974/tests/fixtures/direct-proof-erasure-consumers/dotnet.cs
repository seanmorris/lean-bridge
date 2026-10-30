using System;
using LeanBridge.Directprooferasure;

static class Consumer
{
    static int Main()
    {
        var checks = 0;
        for (uint value = 0; value < 1005; ++value)
        {
            if (Api.Keep(value) != value) throw new InvalidOperationException("payload changed");
            ++checks;
        }
        Console.WriteLine($"direct-proof-dotnet:{checks}");
        return 0;
    }
}
