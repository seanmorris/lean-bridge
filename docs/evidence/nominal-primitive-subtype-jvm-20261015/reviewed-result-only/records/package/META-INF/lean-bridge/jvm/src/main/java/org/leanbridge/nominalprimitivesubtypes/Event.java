package org.leanbridge.nominalprimitivesubtypes;
public sealed interface Event permits EventEmpty, EventBox, EventChoices { }
