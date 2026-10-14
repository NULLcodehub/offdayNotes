export class Autosave<T> {
  private timer?: ReturnType<typeof setTimeout>;
  private pending?: { value: T; revision: number };
  private revision = 0;
  private running?: Promise<void>;
  constructor(
    private write: (value: T) => Promise<unknown>,
    private status: (status: "saving" | "saved" | "error") => void,
    private delay = 350,
  ) {}
  change(value: T) {
    this.pending = { value, revision: ++this.revision };
    this.status("saving");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush().catch(() => {});
    }, this.delay);
  }
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.running) {
      await this.running;
      if (this.pending) return this.flush();
      return;
    }
    if (!this.pending) return;
    const task = this.pending;
    this.running = (async () => {
      try {
        await this.write(task.value);
        if (this.pending?.revision === task.revision) this.pending = undefined;
        this.status(this.pending ? "saving" : "saved");
      } catch (e) {
        this.status("error");
        throw e;
      } finally {
        this.running = undefined;
      }
    })();
    await this.running;
    if (this.pending) await this.flush();
  }
}
