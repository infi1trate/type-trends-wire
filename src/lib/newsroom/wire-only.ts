// N1 · "wire only": the owner's switch that takes stories off the front page while the tape, brands, signals, studies and the Digest
// stay as they are. Off unless the owner turned it on through the desk. Pure.
export const frontStories = <T,>(all: readonly T[], wireOnly: boolean): T[] => (wireOnly ? [] : [...all]);
