import path from 'path';
import { default as semver } from 'semver';
import { read } from 'to-vfile';
import { format } from 'date-fns';

import { CliQueryArguments } from './cli-types.js';
import { QueryOptions, QueryVersionOptionSpec } from './options.js';

import { query as queryCommand } from './commands.js';
import reporter from 'vfile-reporter';
import { VFileMessage } from 'vfile-message';

/**
 * Gets a QueryOptions instance with values derived from the action inputs.
 *
 * @returns {(QueryOptions | undefined)}
 */
function getQueryOptions(argv: CliQueryArguments): QueryOptions | string {
  const root = process.cwd();

  let changelogPath: string = argv.changelog ?? 'CHANGELOG.md';
  if (!path.isAbsolute(changelogPath)) {
    changelogPath = path.join(root, changelogPath);
  }

  const version = argv.version ?? 'latest';
  let target: QueryVersionOptionSpec;

  switch (version) {
    case 'unreleased':
    case 'latest':
    case 'latest-or-unreleased':
      target = version;
      break;

    default:
      const parsed = semver.parse(version);
      if (!parsed) {
        return `Input 'version' contains invalid value '${version}'. It must contain a valid version or one of the values ('latest', 'unreleased', 'latest-or-unreleased')`;
      }
      target = parsed;
      break;
  }

  return {
    changelogPath,
    version: target,
  };
}

interface QueryResult {
  version: string;
  'release-date': string | null;
  'release-suffix': string | null;
  'release-notes': string;
  report: string | null;
}

export default async function query(argv: CliQueryArguments): Promise<number> {
  const options = getQueryOptions(argv);
  if (typeof options === 'string') {
    console.error(`ERROR: ${options}`);
    return -3;
  }
  const changelog = await read(options.changelogPath, { encoding: 'utf-8' });

  try {
    const updated = await queryCommand(changelog, options);

    const releaseNotes = updated.toString();

    const result: QueryResult = {
      version: <string>updated.data['matchedReleaseVersion'],
      'release-date': null,
      'release-suffix': <string>updated.data['matchedReleaseSuffix'] ?? '',
      'release-notes': releaseNotes,
      report: null,
    };

    const date = updated.data['matchedReleaseDate'];
    if (date instanceof Date) {
      result['release-date'] = format(date, 'yyyy-MM-dd');
    }

    if (updated.messages.length > 0) {
      result.report = reporter(updated);
    }

    process.stdout.write(JSON.stringify(result));

    return 0;
  } catch (error) {
    if (error instanceof VFileMessage) {
      console.error(`ERROR: ${error.message}`);
      return -1;
    }

    console.error(error);
    return -2;
  }
}
