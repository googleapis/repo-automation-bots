import languageVersioningRules from './language-versioning-rules.json';

export interface File {
  sha: string;
  filename: string;
  // TODO: Is the patch a string? Confirm
  patch: string;
}

export function getFilePatch(
  changedFiles: File[],
  targetFile: string
): File | undefined {
  return changedFiles.find(x => x.filename === targetFile);
}

export function getVersions(
  versionFile: File[],
  ruleForOldVersion: RegExp,
  ruleForNewVersion: RegExp
) {
  versionFile.patch;
}

export function confirmVersionIsUpgraded(versionFile: File[]) {
  versionFile.patch;
}
