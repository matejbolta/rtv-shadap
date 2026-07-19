export class CoalescingTaskRunner {
  private running = false;
  private requested = false;
  private completion: Promise<void> = Promise.resolve();

  constructor(private readonly task: () => Promise<void>) {}

  request(): Promise<void> {
    this.requested = true;
    if (!this.running) {
      this.running = true;
      this.completion = Promise.resolve().then(() => this.drain());
    }
    return this.completion;
  }

  private async drain(): Promise<void> {
    try {
      while (this.requested) {
        this.requested = false;
        await this.task();
      }
    } finally {
      this.running = false;
    }
  }
}
