namespace NativeFin
structure CallbackRecord where
  digit : Fin 5
  callback : Nat → Nat
def callbackRecordSite (value : CallbackRecord) : Nat := value.callback value.digit.val
end NativeFin
