declare module 'redlock' {
  export interface RedlockOptions {
    retryCount?: number;
  }

  export interface RedlockLock {
    release(): Promise<void>;
  }

  export default class Redlock {
    constructor(clients: unknown[], options?: RedlockOptions);
    acquire(resources: string[], duration: number): Promise<RedlockLock>;
  }
}
