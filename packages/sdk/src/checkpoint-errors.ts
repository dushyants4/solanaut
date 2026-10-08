// Shared lightweight error identity; record storage does not load replay on import.
export class CheckpointPublicationError extends Error{
  readonly code="checkpoint-publication";
  constructor(message:string){super(message);this.name="CheckpointPublicationError";}
}
export class CheckpointRecoveryError extends Error{
  readonly code="checkpoint-recovery";
  constructor(message:string){super(message);this.name="CheckpointRecoveryError";}
}
