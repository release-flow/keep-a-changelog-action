#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { VFileMessage } from 'vfile-message';
import { default as bump } from './cli-bump.js';
import query from './cli-query.js';

try {
  const yargsInstance = yargs(hideBin(process.argv));
  await yargsInstance
    .version(false)
    .command(
      'bump',
      'Bumps the version.',
      {
        changelog: {
          alias: 'c',
          type: 'string',
          describe:
            'The path to the changelog. If a relative path is specified, it is appended to the current directory.',
          default: 'CHANGELOG.md',
        },
        version: {
          alias: 'v',
          type: 'string',
          describe:
            'Specifies how to calculate the next version number. See the bump command documentation' +
            ' (docs/bump.md) for a full description and a list of special values.',
          demandOption: true,
        },
        'release-date': {
          alias: 'r',
          type: 'string',
          describe:
            'Indicates the release date that is written into the changelog for the new release, in ISO 8601' +
            ' format, e.g. 2022-03-03. Defaults to the current system date.',
        },
        preid: {
          alias: 'p',
          type: 'string',
          describe:
            'The "prerelease identifier" to use as a prefix for the "prerelease" part of a semver. For' +
            ' example, it would specify the "beta" in "1.0.0-beta.1".',
        },
        'tag-prefix': {
          alias: 't',
          type: 'string',
          describe: 'The prefix that is applied to the release number to generate the release tag.',
        },
        'output-file': {
          alias: 'o',
          type: 'string',
          describe:
            'The name of the modified (output) changelog file relative to the input changelog' +
            ' directory. If not specified, the input changelog is overwritten.',
        },
        'keep-unreleased-section': {
          type: 'boolean',
          alias: 'k',
          describe:
            'Keep an empty [Unreleased] section at the top of the output changelog after bumping the input' +
            " changelog's [Unreleased] section.",
          default: false,
        },
        'fail-on-empty-release-notes': {
          type: 'boolean',
          alias: 'f',
          describe: "Fail if the input changelog's [Unreleased] section is empty.",
          default: false,
        },
        'merge-prereleases': {
          type: 'boolean',
          alias: 'm',
          describe:
            'Merge all the prerelease sections since the latest full release into the new release, together with' +
            ' the [Unreleased] section if there is one. The new version must be a full (non-prerelease) version.' +
            ' The [Unreleased] section is not required when there are prereleases to merge.',
          default: false,
        },
        'github-repo': {
          type: 'string',
          alias: 'g',
          describe:
            'The GitHub repository in the format "owner/repo". Used to generate links to releases in the changelog.' +
            ' If not specified or empty, only the version numbers will be included in the changelog.',
          default: '',
        },
      },
      async (argv) => {
        const rc = await bump(argv);
        if (rc) {
          yargsInstance.exit(rc, new Error('An error occurred'));
        }
      }
    )
    .command(
      'query',
      'Queries information about a specific release.',
      {
        changelog: {
          alias: 'c',
          type: 'string',
          describe:
            'The path to the changelog. If a relative path is specified, it is appended to the current directory.',
          default: 'CHANGELOG.md',
        },
        version: {
          alias: 'v',
          type: 'string',
          describe:
            'Indicates the release version for which to extract the release information. See the query command' +
            ' documentation (docs/query.md) for a full description and a list of values.',
          demandOption: true,
        },
      },
      async (argv) => {
        const rc = await query(argv);
        if (rc) {
          yargsInstance.exit(rc, new Error('An error occurred'));
        }
      }
    )
    .demandCommand(1, 'You must specify a command')
    .wrap(yargsInstance.terminalWidth())
    .parse();
} catch (error) {
  if (error instanceof VFileMessage) {
    console.error(`ERROR: ${error.message}`);
    process.exit(-1);
  } else {
    console.error(error);
    process.exit(-2);
  }
}
