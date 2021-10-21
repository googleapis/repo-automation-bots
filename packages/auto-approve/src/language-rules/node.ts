const PERMITTED_FILE_PATHS = ['package.json', 'samples/package.json'];
const PERMITTED_AUTHORS = ['renovate-bot', 'release-please[bot'];

export class NodeRules {
  filePath: string;
  author: string;
  permittedFilePaths = PERMITTED_FILE_PATHS;
  permittedAuthors = PERMITTED_AUTHORS;

  constructor(filePath: string, author: string) {
    this.filePath = filePath;
    this.author = author;
  }

  if (this.author === 'renovate-bot') {
      
  }

}
