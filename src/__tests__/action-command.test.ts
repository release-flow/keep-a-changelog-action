import * as path from 'path';
import { fileURLToPath } from 'url';

import { invokeActionScript, getActionErrors } from './test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runAction(command: string | null) {
  const env: NodeJS.ProcessEnv = {
    GITHUB_WORKSPACE: __dirname,
    INPUT_CHANGELOG: 'good_changelog.md',
    INPUT_VERSION: 'latest',
  };

  if (command !== null) {
    env['INPUT_COMMAND'] = command;
  }

  return invokeActionScript(path.join(__dirname, '../index.js'), env);
}

describe('command input', () => {
  it('errors when the command is invalid', () => {
    const result = runAction('bogus');

    expect(result.isError).toBeTruthy();
    expect(getActionErrors(result)).toContain(
      "Input 'command' has an invalid value 'bogus'. The value must be one of: bump, query."
    );
  });

  it('errors when the command is omitted', () => {
    const result = runAction(null);

    expect(result.isError).toBeTruthy();
    expect(getActionErrors(result)).toContain(
      "Input 'command' has an invalid value ''. The value must be one of: bump, query."
    );
  });
});
