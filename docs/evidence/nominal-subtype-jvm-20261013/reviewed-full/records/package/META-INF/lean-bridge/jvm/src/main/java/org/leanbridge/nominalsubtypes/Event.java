package org.leanbridge.nominalsubtypes;
public sealed interface Event permits EventEmpty, EventBox, EventChoices { }
