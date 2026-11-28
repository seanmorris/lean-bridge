import org.leanbridge.workshop.Api
import org.leanbridge.workshop.Pair

fun wrong(binding: Api.Bound<Installed.Meter>, pair: Pair<Any>) = binding.flip(pair)
