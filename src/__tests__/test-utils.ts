// Contains common test utils and types
import * as path from 'path';
import * as process from 'process';
import * as cp from 'child_process';

export interface ExecError {
  message: string;
  stdout: Buffer | string;
  stderr: Buffer | string;
}

export interface ActionResult {
  isError: boolean;
  stdout: string;
  stderr: string;
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

export function getOutputVariables(result: ActionResult): OutputVariables {
  const regexp = /^::set-output name=(.+)::(.+)$/m;
  const v = result.stdout.match(regexp)?.reduce((acc, item) => {
    const match = regexp.exec(item);
    if (match) {
      const x = match[1];
      acc[x] = match[2];
    }
    return acc;
  }, {} as OutputVariables);

  return v || {};
}

export function invokeActionScript(filePath: string, env: NodeJS.ProcessEnv): ActionResult {
  const np = process.execPath;
  const ip = path.join(filePath);
  const options: cp.ExecFileSyncOptions = {
    env: { ...process.env, ...env },
  };

  try {
    return {
      isError: false,
      stdout: cp.execFileSync(np, [ip], options).toString(),
      stderr: '',
    };
  } catch (error) {
    const err = error as ExecError;

    return {
      isError: true,
      stdout: err.stdout.toString(),
      stderr: err.stderr.toString(),
    };
  }
}
