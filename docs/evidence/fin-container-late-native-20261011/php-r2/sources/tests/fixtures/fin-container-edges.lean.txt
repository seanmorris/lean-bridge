namespace FinContainers

/-- Only the empty array inhabits this parameter and result type. -/
def emptyArray (values : Array (Fin 0)) : Array (Fin 0) := values

/-- Only the empty list inhabits this parameter and result type. -/
def emptyList (values : List (Fin 0)) : List (Fin 0) := values

/-- Only none inhabits this parameter and result type. -/
def emptyOption (value : Option (Fin 0)) : Option (Fin 0) := value

/-- None and some [] remain distinct; every present digit is checked. -/
def optionalDigits (values : Option (List Digit)) : Option (List Digit) := values

end FinContainers
