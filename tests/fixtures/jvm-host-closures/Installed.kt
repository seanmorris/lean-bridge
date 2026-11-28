import org.leanbridge.workshop.kotlin.Api

fun main() {
    Api.bindHosts(Installed.Box::class).use { binding ->
        val x=binding.make(11); val y=binding.make(19)
        binding.remember(x).use { f -> check(f.invoke(y) === x) }
        binding.reader(y).use { f -> check(f.invoke(2) == 21L) }
        val stale=binding.identityReader(x)
        binding.close()
        check(runCatching { stale.invoke(0) }.exceptionOrNull() is IllegalStateException)
        stale.close()
    }
    println("ok InstalledKt normal")
}
