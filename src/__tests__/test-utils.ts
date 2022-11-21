// Contains common test utils and types
import * as path from 'path';
import * as process from 'process';
import * as cp from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import fs from 'fs';
export interface ExecError {
  message: string;
  stdout: Buffer | string;
  stderr: Buffer | string;
}

export interface ActionResult {
  isError: boolean;
  stdout: string;
  stderr: string;
  outputs: OutputVariables;
}

export interface OutputVariables {
  [key: string]: string;
}

export function getAllErrors(result: ActionResult): string[] {
  const errors = result.stdout.match(/^::error::.*$/m)?.map((e) => {
    return e.replace(/^::error::/, '');
  });

  return errors ?? [];
}

export function getAllWarnings(result: ActionResult): string[] {
  const warnings = result.stdout.match(/^::warning::.*$/m)?.map((e) => {
    return e.replace(/^::warning::/, '');
  });

  return warnings ?? [];
}

function getOutputVariables(stdout: string): OutputVariables {
  const regexp = /^::set-output name=(.+)::(.*)$/m;
  const v = stdout.split(/\r?\n/).reduce((acc, item) => {
    const match = regexp.exec(item);
    if (match) {
      const x = match[1];
      acc[x] = match[2];
    }
    return acc;
  }, {} as OutputVariables);

  return v || {};
}

interface OutputAccumulator {
  outputs: OutputVariables;
  state: 'start' | 'invar';
  currentVar: string | null;
  currentValue: string | null;
  currentDelim: string | null;
}

// An outputs file looks like this:
// release-version<<ghadelimiter_d9271482-ec14-488a-9699-ae0de6bcb61a
// 1.1.0
// ghadelimiter_d9271482-ec14-488a-9699-ae0de6bcb61a
// release-notes<<ghadelimiter_f2fb4fc3-cceb-4a47-be65-5e9af3b915d9
// ### Added
//
// - Initial content including change log
//
// ghadelimiter_f2fb4fc3-cceb-4a47-be65-5e9af3b915d9
function getOutputVariablesV2(stdout: string): OutputVariables {
  const accumulator: OutputAccumulator = {
    outputs: {},
    state: 'start',
    currentVar: null,
    currentValue: null,
    currentDelim: null,
  };
  const regexp = /^(.+)<<(ghadelimiter_.+)$/m;
  const v = stdout.split(/\r?\n/).reduce((acc, item) => {
    switch (acc.state) {
      case 'start':
        const match = regexp.exec(item);
        if (match) {
          acc.currentVar = match[1];
          acc.currentDelim = match[2];
          acc.state = 'invar';
        }
        break;

      case 'invar':
        if (item === acc.currentDelim) {
          acc.outputs[acc.currentVar!] = acc.currentValue ?? '';
          acc.state = 'start';
          acc.currentVar = null;
          acc.currentDelim = null;
          acc.currentValue = null;
        } else {
          if (acc.currentValue === null) {
            acc.currentValue = item;
          } else {
            acc.currentValue += '%0A' + item;
          }
        }
        break;
    }
    return acc;
  }, accumulator);

  return v.outputs || {};
}

/**
 * Invokes a GH action script.
 *
 * @export
 * @param {string} filePath
 * @param {NodeJS.ProcessEnv} env
 * @param {boolean} [newOutputMechanism=false] Whether to use the new GH output mechanism, see
 *               https://github.blog/changelog/2022-10-11-github-actions-deprecating-save-state-and-set-output-commands/
 * @returns {ActionResult}
 */
export function invokeActionScript(filePath: string, env: NodeJS.ProcessEnv, newOutputMechanism = false): ActionResult {
  const np = process.execPath;
  const ip = path.join(filePath);
  const fileId = uuidv4();
  const filepath = path.join(os.tmpdir(), fileId);

  delete process.env.GITHUB_OUTPUT;
  const extraEnv = newOutputMechanism ? { GITHUB_OUTPUT: filepath } : {};

  const innerEnv = { ...process.env, ...extraEnv, ...env };

  const options: cp.ExecFileSyncOptions = {
    env: innerEnv,
  };

  try {
    // Touch the GITHUB_OUTPUT file
    fs.closeSync(fs.openSync(filepath, 'w'));

    const stdout = cp.execFileSync(np, [ip], options).toString();

    const data = fs.readFileSync(filepath, 'utf8');
    const outputs = newOutputMechanism ? getOutputVariablesV2(data) : getOutputVariables(stdout);

    return {
      isError: false,
      stdout,
      stderr: '',
      outputs: outputs,
    };
  } catch (error) {
    if (isExecError(error)) {
      return {
        isError: true,
        stdout: error.stdout.toString(),
        stderr: error.stderr.toString(),
        outputs: {},
      };
    }

    return {
      isError: true,
      stdout: 'Unknown error',
      stderr: '',
      outputs: {},
    };
  } finally {
    fs.unlinkSync(filepath);
  }
}

function isExecError(maybe: unknown): maybe is ExecError {
  return maybe !== null && maybe !== undefined && typeof maybe === 'object' && 'stdout' in maybe && 'stderr' in maybe;
}

// function parseWarnings(filepath: string): string[] {
//   throw new Error('Function not implemented.');
// }
