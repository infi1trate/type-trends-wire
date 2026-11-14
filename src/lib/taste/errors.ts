// Dependency-free caller-safe error: its message is written for the remote caller and may be shown verbatim.
export class TasteError extends Error {
  constructor(message: string, public status = 503) { super(message); this.name = "TasteError"; }
}
