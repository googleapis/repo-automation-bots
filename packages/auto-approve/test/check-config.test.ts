import {validateYaml, validateSchema} from '../src/check-config.js';
import Octokit from '@octokit/rest';
import {describe, it} from 'mocha';
import assert from 'assert';
import * as fs from 'fs';
import snapshot from 'snap-shot-it';
import yaml from 'js-yaml';

describe('check for config', () => {
  it('should return false if YAML is invalid', () => {
    assert.strictEqual(
      validateYaml(
        fs.readFileSync(
          './test/fixtures/config/invalid-yaml-config.yml',
          'utf8'
        )
      ),
      false
    );
  });

  it('should return true if YAML is valid', () => {
    assert.strictEqual(
      validateYaml(
        fs.readFileSync('./test/fixtures/config/valid-yaml-config.yml', 'utf8')
      ),
      true
    );
  });

  it.only('should return true if YAML has valid schema', () => {
      validateSchema(yaml.load
        (fs.readFileSync('./test/fixtures/config/invalid-schema-config.yml', 'utf8'))
      )
  });
});
