import {createHash} from 'crypto';

export const isUnsignedInt = (n: number) => (n > 0) && Number.isInteger(n);
export const numberBitsRequired = (n: number) => Math.ceil(Math.log2(Math.abs(n)));

export const arrayDiff = <T>(a1: Array<T>, a2: Array<T>) => a1.filter(e => !a2.includes(e));

export const partialHash = (input: string) => createHash('md5').update(input).digest('hex').slice(0, 6);

export const whenNotEmpty = <T>(a: Array<unknown> | string, value: string) => a.length > 0 ? value : '';
