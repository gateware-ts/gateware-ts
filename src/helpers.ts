export class TabLevel {
  level:number;
  ts:string;

  constructor(ts:string = '  ', level:number) {
    this.level = level;
    this.ts = ts;

    this.indent = this.indent.bind(this);
  }

  l(offset:number = 0) { return this.ts.repeat(this.level + offset); }

  push() { this.level++; }
  pop() { this.level--; }

  indent(text) {
    return `${this.l()}${text}`;
  }
};

export const flatten = a => a.reduce((acc, c) => {
  if (Array.isArray(c)) {
    acc.push(...c);
  } else {
    acc.push(c);
  }
  return acc;
}, []);
