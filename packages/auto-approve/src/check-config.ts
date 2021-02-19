// Copyright 2019 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {Probot} from 'probot';
import {logger} from 'gcf-utils';
import {join} from 'path';
import yaml from 'js-yaml';
import {Validator} from 'jsonschema';
import { collapseTextChangeRangesAcrossMultipleVersions } from 'typescript';
const validator = new Validator();
console.log(join(__dirname, '../', '../', 'src', 'valid-pr-schema.json'))
const schema = require(join(__dirname, '../', '../', 'src', 'valid-pr-schema.json'));

//TODO: checks that yaml is valid
export function validateYaml(configYaml: string): Boolean {
    try {
        const isYaml = yaml.load(configYaml);
        if(typeof isYaml === 'object') {
            return true;
        } else {
            return false;
        }
    } catch (err) {
        return false;
    }
}

export function validateSchema(configYaml: string | undefined | null | number | object) {
    const isValid = validator.validate(configYaml, schema);
    console.log(JSON.stringify(isValid);
    return isValid;
}

