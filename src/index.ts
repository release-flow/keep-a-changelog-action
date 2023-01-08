import * as core from '@actions/core';

import { default as bump } from './action-bump.js';
import { default as query } from './action-query.js';

async function run(): Promise<void> {
  const action = core.getInput('action');

  switch (action) {
    case 'query':
      await query();
      break;

    case 'bump':
      await bump();
      break;

    default:
      core.error(`'Invalid value for input 'action': '${action}'`);
      break;
  }
}

void run();
