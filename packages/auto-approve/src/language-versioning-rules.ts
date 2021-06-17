export const languageVersioningRules = [
  {
    prAuthor: 'release-please[bot]',
    process: 'release',
    targetFile: 'package.json',
    // This would match: -  "version": "2.3.0"
    oldVersion: '-[\\s]*"(@?\\S*)":[\\s]"([0-9]*)*\\.([0-9]*\\.[0-9]*)",',
    // This would match: +  "version": "2.3.0"
    newVersion: '\\+[\\s]*"(@?\\S*)":[\\s]"([0-9]*)*\\.([0-9]*\\.[0-9]*)",',
  },
  {
    prAuthor: 'renovate-bot',
    process: 'dependency',
    targetFile: 'package.json',
    dependency:
      '^(fix\\(deps\\)|chore\\(deps\\)): update dependency (@?\\S*) to v(\\S*)$',
    // This would match: -  "version": "^2.3.0"
    oldVersion: '-[\\s]*"(@?\\S*)":[\\s]"([\\^0-9]*)*\\.([0-9]*\\.[0-9]*)",',
    // This would match: +  "version": "^2.3.0"
    newVersion: '\\+[\\s]*"(@?\\S*)":[\\s]"([\\^0-9]*)*\\.([0-9]*\\.[0-9]*)",',
  },
  {
    prAuthor: 'renovate-bot',
    process: 'dependency',
    targetFile: 'samples/package.json',
    dependency:
      '^(fix\\(deps\\)|chore\\(deps\\)): update dependency (@?\\S*) to v(\\S*)$',
    // This would match: -  "version": "^2.3.0"
    oldVersion: '-[\\s]*"(@?\\S*)":[\\s]"([\\^0-9]*)*\\.([0-9]*\\.[0-9]*)",',
    // This would match: +  "version": "^2.3.0"
    newVersion: '\\+[\\s]*"(@?\\S*)":[\\s]"([\\^0-9]*)*\\.([0-9]*\\.[0-9]*)",',
  },
];
