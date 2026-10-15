import * as core from '@actions/core';

import { default as bump } from './action-bump.js';
import { default as query } from './action-query.js';

async function run(): Promise<void> {
  const command = core.getInput('command');

  switch (command) {
    case 'query':
      await query();
      break;

    case 'bump':
      await bump();
      break;

    default:
      core.setFailed(`Input 'command' has an invalid value '${command}'. The value must be one of: bump, query.`);
      break;
  }
}

void run();
