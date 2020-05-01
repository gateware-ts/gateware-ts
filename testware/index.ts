import { SIf, Not, display, finish, SimulationSignalLike, SimulationExpression } from '../src/index';

const generateId = () => {
  return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
};

export function expect(testId:string) {
  return function(condition:SimulationSignalLike, description:string) {
    return SIf(Not(condition), [
      display(`Failed ${testId}`),
      display(description),
      finish()
    ]);
  }
}

type ExpectFn = (condition:SimulationSignalLike, description:string) => SimulationExpression;
type TestFn = (expect:ExpectFn) => SimulationExpression[];
type TestCase = {
  description: string;
  testFn: (expect:ExpectFn) => SimulationExpression[];
};

export function test(description:string, testFn:TestFn): TestCase {
  return {
    description,
    testFn
  };
}

export const describe = (suiteDescription:string, testCases:TestCase[]): SimulationExpression[] => {
  const testIds = testCases.map(generateId);
  const tests = testCases.map(({testFn}, i) => {
    const id = testIds[i];
    const statements = testFn(expect(id));

    return [
      display(`Begin ${id}`),
      ...statements,
      display(`End ${id}`),
    ];
  });

  const id = generateId();
  const header = [
    display(`Suite ${id}`),
    display(`--start header--`),
    display(suiteDescription.replace(/\n/g, '\\n')),
    ...testCases.map(({description}, i) => {
      return display(`${testIds[i]}:${description}`);
    }),
    display(`--end header--`),
  ]

  return [
    ...header,
    ...tests.reduce((acc, statements) => {
      return acc.concat(statements)
    }, []),
    display(`End Suite ${id}`),
  ];
};
