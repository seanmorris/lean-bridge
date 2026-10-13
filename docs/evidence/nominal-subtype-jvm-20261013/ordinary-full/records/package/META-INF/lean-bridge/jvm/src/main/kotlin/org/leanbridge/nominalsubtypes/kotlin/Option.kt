package `org`.`leanbridge`.`nominalsubtypes`.`kotlin`

sealed interface Option<out T : kotlin.Any> {
    fun isSome(): kotlin.Boolean
    fun value(): T
    companion object {
        @kotlin.jvm.JvmStatic fun <T : kotlin.Any> none(): Option<T> = None()
        @kotlin.jvm.JvmStatic fun <T : kotlin.Any> some(value: T): Option<T> = Some(value)
    }
    class None<out T : kotlin.Any> : Option<T> {
        override fun isSome(): kotlin.Boolean = false
        override fun value(): T = throw IllegalStateException("None has no value")
    override fun equals(other: kotlin.Any?): kotlin.Boolean {
        if (this === other) return true
        return other is None<*>
    }
    override fun hashCode(): kotlin.Int = java.util.Arrays.deepHashCode(kotlin.arrayOf<kotlin.Any?>(None::class.java))
    }
    class Some<out T : kotlin.Any>(@kotlin.jvm.JvmField val value: T) : Option<T> {
        init { java.util.Objects.requireNonNull(value) }
        override fun isSome(): kotlin.Boolean = true
        override fun value(): T = value
    override fun equals(other: kotlin.Any?): kotlin.Boolean {
        if (this === other) return true
        return other is Some<*>
            && java.util.Objects.deepEquals(this.`value`, other.`value`)
    }
    override fun hashCode(): kotlin.Int = java.util.Arrays.deepHashCode(kotlin.arrayOf<kotlin.Any?>(Some::class.java, this.`value`))
    }
}
