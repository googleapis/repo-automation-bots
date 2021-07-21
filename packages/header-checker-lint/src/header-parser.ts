// Copyright 2019 Google LLC
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

export type LicenseType = 'Apache-2.0' | 'MIT' | 'BSD-3' | undefined;

export interface LicenseHeader {
  copyright?: string;
  type?: LicenseType;
  year?: number;
}

const COPYRIGHT_REGEX =
  /\s*(^|[*#]|\/\/) ?\s*Copyright (\d{4}(-\d{4})?) ([\w\s,]+)\.?/;
const APACHE2_REGEX = new RegExp(
  'Licensed under the Apache License, Version 2.0'
);
const BSD3_REGEX = new RegExp(
  'Redistribution and use in source and binary forms, with or without'
);
const MIT_REGEX = new RegExp('Permission is hereby granted, free of charge,');
const MIT_REFERENCE_REGEX = new RegExp(
  'Use of this source code is governed by an MIT-style'
);

// super naive - iterate over lines and use regex
// TODO: look for the header in comments only
export function detectLicenseHeader(contents: string): LicenseHeader {
  const license: LicenseHeader = {};
  contents.split(/\r?\n/).forEach(line => {
    const match = line.match(COPYRIGHT_REGEX);
    if (match) {
      // If it's a ranged date, only consider the newest one.
      if (match[3]) {
        // The extra '-' should be removed.
        license.year = Number(match[3].substring(1));
      } else {
        license.year = Number(match[2]);
      }
      license.copyright = match[4];
    }

    if (line.match(APACHE2_REGEX)) {
      license.type = 'Apache-2.0';
    } else if (line.match(MIT_REGEX) || line.match(MIT_REFERENCE_REGEX)) {
      license.type = 'MIT';
    } else if (line.match(BSD3_REGEX)) {
      license.type = 'BSD-3';
    }
  });
  return license;
}
