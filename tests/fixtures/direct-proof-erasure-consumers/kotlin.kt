import org.leanbridge.directprooferasure.kotlin.Api

fun main(arguments: Array<String>) {
    check(arguments.isEmpty()) { "unexpected arguments" }
    var checks = 0
    repeat(1005) { value ->
        check(Api.keep(value.toLong()) == value.toLong()) { "payload changed" }
        ++checks
    }
    println("direct-proof-kotlin:$checks")
}
