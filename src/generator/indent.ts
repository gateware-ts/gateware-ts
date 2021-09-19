export class Indent {
  private level = 0;

  get() { return ' '.repeat(this.level * 2); }

  push() {
    this.level++;
    return this.get();
  }

  pop() {
    this.level = Math.max(0, this.level - 1);
    return this.get();
  }
}
