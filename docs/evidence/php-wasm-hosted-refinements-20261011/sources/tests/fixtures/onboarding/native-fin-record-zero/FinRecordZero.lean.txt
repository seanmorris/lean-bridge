namespace FinRecordZero

/-- No value inhabits this record, but arrays and lists of it may be empty. -/
structure Zero where
  digit : Fin 0

/-- Heap-backed fields precede the empty-only collections. -/
structure Fields where
  label : String
  payload : Array Nat
  array : Array (Fin 0)
  list : List (Fin 0)

@[noinline] def arrayRecords (values : Array Zero) : Array Zero := values

@[noinline] def listRecords (values : List Zero) : List Zero := values

@[noinline] def fieldCollections (value : Fields) : Fields := value

@[noinline] def arrayFields (values : Array Fields) : Array Fields := values

@[noinline] def listFields (values : List Fields) : List Fields := values

end FinRecordZero
