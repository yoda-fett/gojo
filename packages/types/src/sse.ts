export interface StateEvent<TState = unknown> {
  entityId: string;
  stateVersion: number;
  state: TState;
}
