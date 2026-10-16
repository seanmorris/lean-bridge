package `org`.`leanbridge`.`nestedcheckedrecords`.`kotlin`

class Pair<out A : kotlin.Any, out B : kotlin.Any>(@kotlin.jvm.JvmField val first: A, @kotlin.jvm.JvmField val second: B) {
    init { java.util.Objects.requireNonNull(first); java.util.Objects.requireNonNull(second) }
    fun first(): A = first
    fun second(): B = second
    override fun equals(other: kotlin.Any?): kotlin.Boolean {
        if (this === other) return true
        return other is Pair<*, *>
            && java.util.Objects.deepEquals(this.`first`, other.`first`)
            && java.util.Objects.deepEquals(this.`second`, other.`second`)
    }
    override fun hashCode(): kotlin.Int = java.util.Arrays.deepHashCode(kotlin.arrayOf<kotlin.Any?>(Pair::class.java, this.`first`, this.`second`))
}
