export interface CliBumpArguments {
  [x: string]: unknown;
  changelog: string;
  version: string;
  releaseDate: string | undefined;
  preid: string | undefined;
  tagPrefix: string | undefined;
  outputFile: string | undefined;
  keepUnreleasedSection: boolean;
  failOnEmptyReleaseNotes: boolean;
  githubRepo: string | undefined;
  $0: string;
}

export interface CliQueryArguments {
  [x: string]: unknown;
  changelog: string;
  version: string;
  $0: string;
}
