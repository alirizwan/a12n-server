// Bring in more definitions
import '@curveball/session';

import { URLSearchParams } from 'url';

import { MemoryRequest, BaseContext, MemoryResponse } from '@curveball/core';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';

import { InvalidRequest } from '../../../src/oauth2/errors';
import * as oauth2Service from '../../../src/oauth2/service';
import * as oauth2ClientService from '../../../src/oauth2-client/service';
import * as userService from '../../../src/user/service';
import * as serverSettings from '../../../src/server-settings';
import { User } from '../../../src/user/types';
import { OAuth2Client } from '../../../src/oauth2-client/types';
import authorize from '../../../src/oauth2/controller/authorize';

chai.use(chaiAsPromised);
const expect = chai.expect;

describe('AuthorizeController', () => {
  const sandbox = sinon.createSandbox();

  const user: User = {
    id: 1,
    identity: 'identity',
    nickname: 'nickname',
    created: new Date(1),
    type: 'user',
    active: true
  };
  const oauth2Client: OAuth2Client = {
    id: 1,
    clientId: 'client-id',
    clientSecret: 'client-secret',
    user: user,
    allowedGrantTypes: ['authorization_code'],
  };


  let codeRedirectMock: sinon.SinonStub;

  beforeEach(function () {
    sandbox.stub(oauth2ClientService, 'getClientByClientId').returns(Promise.resolve(oauth2Client));
    sandbox.stub(oauth2Service, 'validateRedirectUri').returns(Promise.resolve(true));
    sandbox.stub(oauth2Service, 'requireRedirectUri').returns(Promise.resolve());
    codeRedirectMock = sandbox.stub(authorize, 'codeRedirect');
    sandbox.stub(userService, 'findByIdentity').returns(Promise.resolve(user));
    sandbox.stub(userService, 'validatePassword').returns(Promise.resolve(true));
    sandbox.stub(userService, 'hasTotp').returns(Promise.resolve(false));
    sandbox.stub(serverSettings, 'getSetting').returns(true);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('get', () => {
    let params: URLSearchParams;

    beforeEach(function () {
      params = new URLSearchParams({
        response_type: 'code',
        client_id: 'client-id',
        redirect_uri: 'redirect-uri',
        code_challenge: 'challenge-code',
        code_challenge_method: 'S256',
        state: 'state',
      });
    });

    it('should pass valid parameters and call code redirect', async() => {
      const request = new MemoryRequest('GET', '?' + params);
      const context = new BaseContext(request, new MemoryResponse());
      context.session = {
        user: {}
      };

      await authorize.get(context);
      expect(codeRedirectMock.calledOnceWithExactly(
        context, oauth2Client, 'redirect-uri', 'state', 'challenge-code', 'S256'
      )).to.be.true;
    });

    it('should set challenge code method to plain if not provided', async() => {
      params.delete('code_challenge_method');

      const request = new MemoryRequest('GET', '?' + params);
      const context = new BaseContext(request, new MemoryResponse());
      context.session = {
        user: {}
      };

      await authorize.get(context);
      expect(codeRedirectMock.calledOnceWithExactly(
        context, oauth2Client, 'redirect-uri', 'state', 'challenge-code', 'plain'
      )).to.be.true;
    });

    it('should pass valid parameters and call code redirect without PKCE', async() => {
      params.delete('code_challenge');
      params.delete('code_challenge_method');

      const request = new MemoryRequest('GET', '?' + params);
      const context = new BaseContext(request, new MemoryResponse());
      context.session = {
        user: {}
      };

      await authorize.get(context);
      expect(codeRedirectMock.calledOnceWithExactly(
        context, oauth2Client, 'redirect-uri', 'state', undefined, undefined
      )).to.be.true;
    });

    it('should fail code challenge validation', async() => {
      params.set('code_challenge_method', 'bogus-method');

      const request = new MemoryRequest('GET', '?' + params);
      const context = new BaseContext(request, new MemoryResponse());
      context.session = {
        user: {}
      };

      await expect(authorize.get(context)).to.be.rejectedWith(InvalidRequest, 'The "code_challenge_method" must be "plain" or "S256"');
    });

    it('should fail when code method is provided but not challenge', async() => {
      params.delete('code_challenge');

      const request = new MemoryRequest('GET', '?' + params);
      const context = new BaseContext(request, new MemoryResponse());
      context.session = {
        user: {}
      };

      await expect(authorize.get(context)).to.be.rejectedWith(InvalidRequest, 'The "code_challenge" must be provided');
    });
  });
});
