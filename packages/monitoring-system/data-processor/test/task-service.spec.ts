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
import {describe, it, beforeEach} from 'mocha';
import chai from 'chai';
import chaiHttp from 'chai-http';
import {TaskService, Task, TaskEndpoints} from '../src/task-service';
import {Factory} from '../src/data-processor-factory';
import {DataProcessor} from '../src/data-processors/data-processor-abstract';
import express from 'express';
import assert from 'assert';

chai.use(chaiHttp);
chai.should();

class MockDataProcessor implements DataProcessor {
  static firestore: FirebaseFirestore.Firestore;

  shouldThrowError = false;

  throwError() {
    this.shouldThrowError = true;
  }

  public collectAndProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.shouldThrowError) {
        reject('Mock error from data processor');
      } else {
        resolve();
      }
    });
  }
}

class MockDataProcessorFactory implements Factory {
  shouldThrowError = false;
  mockDataProcessor: DataProcessor;
  givenTask!: Task;

  constructor(mockDataProcessor: DataProcessor) {
    this.mockDataProcessor = mockDataProcessor;
  }

  throwError() {
    this.shouldThrowError = true;
  }

  getDataProcessor(task: Task): DataProcessor {
    this.givenTask = task;
    if (this.shouldThrowError) {
      throw new Error('Mock Error');
    }
    return this.mockDataProcessor;
  }
}

describe('Task Service', () => {
  let mockProcessor: MockDataProcessor;
  let mockFactory: MockDataProcessorFactory;
  let service: TaskService;
  let app: express.Application;

  beforeEach(async () => {
    mockProcessor = new MockDataProcessor();
    mockFactory = new MockDataProcessorFactory(mockProcessor);
    service = new TaskService(mockFactory);
    app = service['app'];
  });

  describe('404 responses for bad endpoint', () => {
    it('returns 404 for a GET request to a non-existent endpoint', done => {
      chai
        .request(app)
        .get('/foo-bad-endpoint')
        .end((err, res) => {
          res.should.have.status(404);
          done();
        });
    });

    it('returns 404 for a PUT request to a non-existent endpoint', done => {
      chai
        .request(app)
        .put('/foo-bad-endpoint')
        .end((err, res) => {
          res.should.have.status(404);
          done();
        });
    });

    it('returns 404 for a DELETE request to a non-existent endpoint', done => {
      chai
        .request(app)
        .delete('/foo-bad-endpoint')
        .end((err, res) => {
          res.should.have.status(404);
          done();
        });
    });

    it('returns 404 for a PATCH request to a non-existent endpoint', done => {
      chai
        .request(app)
        .patch('/foo-bad-endpoint')
        .end((err, res) => {
          res.should.have.status(404);
          done();
        });
    });

    it('returns 404 for a POST request to a non-existent endpoint', done => {
      chai
        .request(app)
        .post('/foo-bad-endpoint')
        .end((err, res) => {
          res.should.have.status(404);
          done();
        });
    });
  });

  describe('404 responses for bad method', () => {
    for (const endpoint of Object.keys(TaskEndpoints)) {
      it(`returns 404 for a PUT request to ${endpoint}`, done => {
        chai
          .request(app)
          .put(endpoint)
          .end((err, res) => {
            res.should.have.status(404);
            done();
          });
      });
      it(`returns 404 for a POST request to ${endpoint}`, done => {
        chai
          .request(app)
          .post(endpoint)
          .end((err, res) => {
            res.should.have.status(404);
            done();
          });
      });
      it(`returns 404 for a PATCH request to ${endpoint}`, done => {
        chai
          .request(app)
          .patch(endpoint)
          .end((err, res) => {
            res.should.have.status(404);
            done();
          });
      });
      it(`returns 404 for a DELETE request to ${endpoint}`, done => {
        chai
          .request(app)
          .delete(endpoint)
          .end((err, res) => {
            res.should.have.status(404);
            done();
          });
      });
    }
  });

  describe('200 responses for successful tasks', () => {
    for (const endpoint of Object.keys(TaskEndpoints)) {
      it(`returns 200 after successfully completing task: ${TaskEndpoints[endpoint]}`, done => {
        chai
          .request(app)
          .get(endpoint)
          .end((err, res) => {
            res.should.have.status(200);
            assert.equal(mockFactory.givenTask, TaskEndpoints[endpoint]);
            done();
          });
      });
    }
  });

  describe('500 responses for data factory errors', () => {
    beforeEach(() => {
      mockFactory.throwError();
    });

    for (const endpoint of Object.keys(TaskEndpoints)) {
      it(`returns 500 if no processor found for task: ${TaskEndpoints[endpoint]}`, done => {
        chai
          .request(app)
          .get(endpoint)
          .end((err, res) => {
            res.should.have.status(500);
            assert.equal(mockFactory.givenTask, TaskEndpoints[endpoint]);
            done();
          });
      });
    }
  });

  describe('500 responses for data processor errors', () => {
    beforeEach(() => {
      mockProcessor.throwError();
    });

    for (const endpoint of Object.keys(TaskEndpoints)) {
      it(`returns 500 on processing error for task: ${TaskEndpoints[endpoint]}`, done => {
        chai
          .request(app)
          .get(endpoint)
          .end((err, res) => {
            res.should.have.status(500);
            assert.equal(mockFactory.givenTask, TaskEndpoints[endpoint]);
            done();
          });
      });
    }
  });
});
