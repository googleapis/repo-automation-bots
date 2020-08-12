// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {readFileSync} from 'fs';
import {resolve} from 'path';
import * as Mustache from 'mustache';
import {LicenseType, HeaderType} from './types';

interface HeaderConfiguration {
  type: HeaderType;
  startingLine?: number;
}

const HEADER_CONFIGURATIONS: {[key: string]: HeaderConfiguration} = {
  ts: {type: HeaderType.SLASHES},
  js: {type: HeaderType.SLASHES},
  java: {type: HeaderType.BLOCK},
  py: {type: HeaderType.HASH},
  rb: {type: HeaderType.HASH},
  sh: {type: HeaderType.HASH, startingLine: 1},
};

const TEMPLATE_MAP = {
  'Apache-2.0': 'apache2',
  MIT: 'mit',
  'BSD-3': 'bsd3',
};

export function buildHeader(
  licenseType: LicenseType,
  headerType: HeaderType,
  copyrightHolder: string,
  copyrightYear: string
): string {
  const file = `./content/${TEMPLATE_MAP[licenseType]}/header.hbs`;
  const template = readFileSync(resolve(__dirname, file), 'utf8');
  const headerLines = Mustache.render(template, {
    copyrightHolder: copyrightHolder,
    copyrightYear: copyrightYear,
  }).split('\n');
  const newLines = [];

  if (headerType === HeaderType.BLOCK) {
    newLines.push('/*');
  }
  headerLines.forEach(line => {
    newLines.push(`${headerType}${line}`.trimRight());
  });
  if (headerType === HeaderType.BLOCK) {
    newLines.push(' */');
  }
  return newLines.join('\n');
}

export function injectHeader(
  content: string,
  header: string,
  startingLine = 0
): string {
  const lines = content.split('\n');
  const newLines = [];
  for (let i = 0; i < startingLine; i++) {
    newLines.push(lines.pop());
  }
  return newLines.join('\n') + header + lines.join('\n');
}

export function fixFileHeader(
  content: string,
  fileType: string,
  licenseType: LicenseType,
  copyrightHolder: string,
  copyrightYear: string
): string {
  const config: HeaderConfiguration = HEADER_CONFIGURATIONS[fileType];
  const startingLine =
    config.startingLine === undefined ? 0 : config.startingLine;

  const header = buildHeader(
    licenseType,
    config.type,
    copyrightHolder,
    copyrightYear
  );
  return injectHeader(content, header, startingLine);
}

export function getLicenseContent(licenseType: LicenseType): string {
  return readFileSync(
    resolve(__dirname, `./content/${TEMPLATE_MAP[licenseType]}/license.txt`),
    'utf8'
  );
}
