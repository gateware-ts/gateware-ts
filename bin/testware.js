#!/usr/bin/env node

const A = require('arcsecond');
const { exec } = require('child_process');
const { promisify } = require('util');

const execP = promisify(exec);

const restOfTheLine = A.everythingUntil(A.char('\n')).chain(res => {
  return A.char('\n').map(() => res);
});

const headerParser = A.coroutine(function* () {
  yield A.str('--start header--\n');
  const description = yield restOfTheLine;

  const testMap = yield A.many1(A.sequenceOf([
    A.regex(/^[a-fA-F0-9]+/),
    A.char(':').chain(() => restOfTheLine)
  ]));

  yield A.str('--end header--\n');

  return {
    description,
    testMap
  };
});

const testParser = testId => A.coroutine(function* () {
  yield A.str(`Begin ${testId}\n`);

  const stdout = [];

  while (true) {
    const lineResult = yield A.choice([
      A.str(`End ${testId}\n`).map(() => ({ type: 'pass' })),
      A.str(`Failed ${testId}\n`).map(() => ({ type: 'fail' })),
      restOfTheLine.map(data => ({ type: 'stdout', data })),
    ]);

    if (lineResult.type === 'pass') {
      return { ...lineResult, stdout };
    } else if (lineResult.type === 'fail') {
      const reason = yield restOfTheLine;
      return { ...lineResult, reason, stdout };
    } else {
      stdout.push(lineResult.data);
    }
  }
});

const suiteParser = A.coroutine(function* () {
  yield restOfTheLine;
  yield A.str('Suite ');
  const suiteId = yield restOfTheLine;
  const header = yield headerParser;

  const results = [];
  let passed = true;

  for (let [id, description] of header.testMap) {
    const testResult = yield testParser(id);
    results.push({...testResult, description});

    if (testResult.type === 'fail') {
      passed = false;
      break;
    }
  }

  if (passed) {
    yield A.str(`End Suite ${suiteId}\n`);
  }

  return {
    suiteId,
    header,
    results,
    passed
  };
});

if (process.argv.length < 3) {
  console.log('usage: testware <test path> [opts]');
  process.exit(1);
}

const testPath = process.argv[2];

// run the test
execP(`ts-node ${testPath}`)
.catch(error => {
  console.log('Error when running test:');
  console.error(error);
  process.exit(1);
})
.then(({stdout}) => parseOutput(stdout));


const parseOutput = output => {
  const {result, isError, error} = suiteParser.run(output);

  if (isError) {
    console.log('Couldn\'t parse test output.');
    console.error(error);
    process.exit(1);
  }

  console.log(`${result.header.description.replace(/\\\\n/g, '\n')}`);

  result.results.forEach(({type, description}, i) => {
    console.log(`  ${i+1}) ${type === 'pass' ? '✅' : '❌'} ${description.replace(/\\\\n/g, '\n')}`);
  });

  if (result.passed) {
    console.log('');
    process.exit(0);
  }

  console.error('Failed:');
  console.error(result.results[result.results.length-1].description.replace(/\\\\n/g, '\n'));
  process.exit(1);
}
