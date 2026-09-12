/** Eighth-note focus loops end on a whole beat, preserving the silent return. */
export function loopSlotCount(focus: { startSlot: number; endSlot: number } | null): number {
  return focus ? Math.ceil((focus.endSlot - focus.startSlot + 1) / 2) * 2 : 8;
}
