import * as app from '../src/app';
import {Helper} from '../src/helper';
import sinon, {SinonStub} from 'sinon';
import * as gaxios from 'gaxios';
import {describe, it} from 'mocha';
import assert from 'assert';
import * as http from 'http';

const TEST_SERVER_PORT = 8080;

describe('behavior of Cloud Run service', async () => {
  let server: http.Server;
  let rotateSecretStub: SinonStub;

  beforeEach(() => {
    server = app.app.listen(TEST_SERVER_PORT, () => {
      console.log(`Secret-rotator: listening on port ${TEST_SERVER_PORT}`);
    });
    rotateSecretStub = sinon.stub(Helper.prototype, 'rotateSecret');
  });

  afterEach(done => {
    rotateSecretStub.restore();
    server.close(done);
  });

  it('should get 200 when posting', async () => {
    const response = await gaxios.request({
      method: 'POST',
      url: `http://localhost:${TEST_SERVER_PORT}/`,
    });

    assert.ok(rotateSecretStub.calledOnce);

    assert.deepStrictEqual(response.status, 200);
  });

  it('should parse JSON correctly', async () => {
    const response = await gaxios.request({
      method: 'POST',
      url: `http://localhost:${TEST_SERVER_PORT}/`,
      headers: {'Content-Type': 'application/json'},
      data: {
        serviceAccountProjectId: 'test-service-account',
        serviceAccountEmail: 'test-service-account-email',
        secretManagerProjectId: 'test-secret-project-manager-Id',
        secretName: 'test-secret-name',
      },
    });

    assert.ok(
      rotateSecretStub.calledWith(
        'test-service-account',
        'test-service-account-email',
        'test-secret-project-manager-Id',
        'test-secret-name'
      )
    );
    assert.deepStrictEqual(response.status, 200);
  });

  it('should get 404 when calling with any other method', async () => {
    assert.rejects(async () => {
      await gaxios.request({
        method: 'GET',
        url: `http://localhost:${TEST_SERVER_PORT}/`,
      });
    }, /Error: Request failed with status code 404/);
  });
});
