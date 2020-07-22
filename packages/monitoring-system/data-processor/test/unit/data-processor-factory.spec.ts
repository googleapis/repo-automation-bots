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
//
import {describe, it} from 'mocha';
import assert from 'assert';
import {Task} from '../../src/task-service';
import {DataProcessorFactory} from '../../src/data-processor-factory';
import {DataProcessor} from '../../src/data-processors/data-processor-abstract';
import {CloudLogsProcessor} from '../../src/data-processors/cloud-logs-data-processor';
import {GCFProcessor} from '../../src/data-processors/cloud-functions-data-processor';
import {GitHubProcessor} from '../../src/data-processors/github-data-processor';
import {CloudTasksProcessor} from '../../src/data-processors/cloud-tasks-data-processor';

describe('Data Processor Factory', () => {
  describe('getDataProcessor()', () => {
    it('returns CloudLogsProcessor for ProcessLogs task', () => {
      const processor: DataProcessor = new DataProcessorFactory().getDataProcessor(
        Task.ProcessLogs
      );
      assert(processor instanceof CloudLogsProcessor);
    });
    it('returns GCFProcessor for ProcessGCF task', () => {
      const processor: DataProcessor = new DataProcessorFactory().getDataProcessor(
        Task.ProcessGCF
      );
      assert(processor instanceof GCFProcessor);
    });
    it('returns GitHubProcessor for ProcessGitHub task', () => {
      const processor: DataProcessor = new DataProcessorFactory().getDataProcessor(
        Task.ProcessGitHub
      );
      assert(processor instanceof GitHubProcessor);
    });
    it('returns CloudTasksProcessor for ProcessTaskQueue task', () => {
      const processor: DataProcessor = new DataProcessorFactory().getDataProcessor(
        Task.ProcessTaskQueue
      );
      assert(processor instanceof CloudTasksProcessor);
    });
    it('throws an error for unknown task types', () => {
      try {
        new DataProcessorFactory().getDataProcessor('unsupported task' as Task);
        assert.fail('Expected DataProcessorFactory to throw an error');
      } catch (e) {
        assert(e);
      }
    });
  });
});
