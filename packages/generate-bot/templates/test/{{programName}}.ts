import myProbotApp from '../src/{{programName}}'
import { Probot } from 'probot';
import * as fs from 'fs';
import { resolve } from 'path';


const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('responding to events', ()) => {
    it('responds to an issue') {
        const payload = require(resolve(
            fixturesPath,
            './events/issue'
          ));
    }

    it('responds to a pull request') {
        const payload = require(resolve(
            fixturesPath,
            './events/pull_request'
          ));
    }

    it('responds to a commit') {
        const payload = require(resolve(
            fixturesPath,
            './events/commit'
          ));
    }

}