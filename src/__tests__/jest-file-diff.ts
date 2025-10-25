import fs from 'fs';
import { diffLinesUnified, DiffOptions } from 'jest-diff';

export {};

declare global {
  namespace jest {
    interface Matchers<R> {
      myMatcher: (received: string) => R;
      toMatchFileSnapshot: (received: string) => R;
    }
  }
}

function myMatcher(this: jest.MatcherUtils, received: string, expected: string): jest.CustomMatcherResult {
  const pass = received === expected;
  return {
    pass,
    message: (): string => `expected ${received} to be ${expected}`,
  };
}

function toMatchFileSnapshot(this: jest.MatcherUtils, received: string, expected: string): jest.CustomMatcherResult {
  // Split on Windows or non-Windows line endings
  const expectedContent = fs.readFileSync(expected, 'utf8').split(/\r?\n/);
  const receivedContent = fs.readFileSync(received, 'utf8').split(/\r?\n/);

  const { isNot, utils } = this;
  const { RECEIVED_COLOR, EXPECTED_COLOR } = utils;

  const equals = (a: string[], b: string[]): boolean => a.length === b.length && a.every((v, i) => v === b[i]);

  const pass = equals(expectedContent, receivedContent);

  let message: string;
  if (pass) {
    message = '';
  } else {
    function replaceSpacesWithMiddleDot(s: string): string {
      return '·'.repeat(s.length);
    }
    const options: DiffOptions = {
      aAnnotation: 'Snapshot',
      bAnnotation: 'Test output',
      contextLines: 2,
      expand: false,
      changeLineTrailingSpaceColor: replaceSpacesWithMiddleDot,
    };
    const difference = diffLinesUnified(expectedContent, receivedContent, options);
    const not = isNot ? 'not ' : '';
    message =
      `Expected ${RECEIVED_COLOR(options.bAnnotation)} ` +
      `${not}to match the ${EXPECTED_COLOR(options.aAnnotation)}.\n\n${difference}`;
  }
  return {
    pass,
    message: () => message,
  };
}

expect.extend({
  myMatcher,
  toMatchFileSnapshot,
});
