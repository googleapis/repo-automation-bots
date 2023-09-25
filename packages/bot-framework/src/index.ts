// Copyright 2023 Google LLC
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

import {GCFLogger} from './logging/gcf-logger';

export {Bootstrapper} from './bootstrapper';
export {GCFLogger} from './logging/gcf-logger';
export {getContextLogger} from './context/context-logger';

// Default logger. In general, avoid using this global logger. Instead,
// configure your own instance with context.
export const logger = new GCFLogger();
