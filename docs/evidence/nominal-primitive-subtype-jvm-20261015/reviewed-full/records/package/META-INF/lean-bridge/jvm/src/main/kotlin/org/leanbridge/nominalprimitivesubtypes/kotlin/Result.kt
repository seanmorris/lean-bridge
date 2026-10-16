package `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`

sealed interface Result<out T : kotlin.Any, out E : kotlin.Any> {
    fun isOk(): kotlin.Boolean
    fun value(): T
    fun error(): E
    companion object {
        @kotlin.jvm.JvmStatic fun <T : kotlin.Any, E : kotlin.Any> ok(value: T): Result<T, E> = Ok(value)
        @kotlin.jvm.JvmStatic fun <T : kotlin.Any, E : kotlin.Any> err(error: E): Result<T, E> = Err(error)
    }
    class Ok<out T : kotlin.Any, out E : kotlin.Any>(@kotlin.jvm.JvmField val value: T) : Result<T, E> {
        init { java.util.Objects.requireNonNull(value) }
        override fun isOk(): kotlin.Boolean = true
        override fun value(): T = value
        override fun error(): E = throw IllegalStateException("Ok has no error")
    override fun equals(other: kotlin.Any?): kotlin.Boolean {
        if (this === other) return true
        return other is Ok<*, *>
            && java.util.Objects.deepEquals(this.`value`, other.`value`)
    }
    override fun hashCode(): kotlin.Int = java.util.Arrays.deepHashCode(kotlin.arrayOf<kotlin.Any?>(Ok::class.java, this.`value`))
    }
    class Err<out T : kotlin.Any, out E : kotlin.Any>(@kotlin.jvm.JvmField val error: E) : Result<T, E> {
        init { java.util.Objects.requireNonNull(error) }
        override fun isOk(): kotlin.Boolean = false
        override fun value(): T = throw IllegalStateException("Err has no success value")
        override fun error(): E = error
    override fun equals(other: kotlin.Any?): kotlin.Boolean {
        if (this === other) return true
        return other is Err<*, *>
            && java.util.Objects.deepEquals(this.`error`, other.`error`)
    }
    override fun hashCode(): kotlin.Int = java.util.Arrays.deepHashCode(kotlin.arrayOf<kotlin.Any?>(Err::class.java, this.`error`))
    }
}
