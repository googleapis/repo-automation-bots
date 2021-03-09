import {
    checkPRAgainstConfig,
    checkFilePathsMatch,
    getChangedFiles,
  } from '../src/check-pr.js';
import {describe, it} from 'mocha';
import assert from 'assert';
import * as fs from 'fs';

describe('check pr against config', () => {
    describe('checks that files match at least one of the patterns', () => {
        it('should return true if file matches at least one of the patterns') {
            const pathsMatch = checkFilePathsMatch()
        }
    }) 
})
