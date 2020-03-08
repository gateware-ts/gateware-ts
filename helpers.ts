export class TabLevel {
  level:number;
  ts:string;

  constructor(ts:string = '  ', level:number) {
    this.level = level;
    this.ts = ts;
  }

  l() { return this.ts.repeat(this.level); }

  push() { this.level++; }
  pop() { this.level--; }
};

export const flatten = a => a.reduce((acc, c) => {
  if (Array.isArray(c)) {
    acc.push(...c);
  } else {
    acc.push(c);
  }
  return acc;
}, []);
