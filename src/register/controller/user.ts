import Controller from '@curveball/controller';
import { Context } from '@curveball/core';
import { Forbidden, NotFound } from '@curveball/http-errors';
import { getSetting } from '../../server-settings';
import * as userService from '../../user/service';
import { registrationForm } from '../formats/html';
import * as privilegeService from '../../privilege/service';

class UserRegistrationController extends Controller {

  async get(ctx: Context) {

    const firstRun = !(await userService.hasUsers());

    ctx.response.type = 'text/html';
    ctx.response.body = registrationForm(
      ctx.query.msg,
      ctx.query.error,
      getSetting('registration.mfa.enabled'),
      firstRun,
    );

  }

  async post(ctx: Context) {

    const body: any = ctx.request.body;
    const userPassword = body.password;
    const confirmPassword = body.confirmPassword;
    const addMfa = 'addMfa' in body;

    if (userPassword !== confirmPassword) {
      ctx.status = 303;
      ctx.response.headers.set('Location', '/register?error=Password+mismatch.+Please+try+again');
      return;
    }

    try {
      await userService.findByIdentity('mailto:' + body.emailAddress);
      ctx.status = 303;
      ctx.response.headers.set('Location', '/register?error=User+already+exists');
      return;
    } catch (err) {
      if (!(err instanceof NotFound)) {
        throw err;
      }
    }

    const firstRun = !(await userService.hasUsers());

    const user = await userService.save({
      identity: 'mailto:' + body.emailAddress,
      nickname: body.nickname,
      created: new Date(),
      type: 'user',
      // Auto-activating if it's the first user.
      active: firstRun,
    });

    if (firstRun) {
      // The first user will be an admin
      await privilegeService.addPrivilegeForUser(
        user,
        'admin',
        '*'
      );
    }

    await userService.createPassword(user, userPassword);

    if (addMfa && getSetting('registration.mfa.enabled')) {
      ctx.session = {
        registerUser: user,
      };

      ctx.response.status = 303;
      ctx.response.headers.set('Location', '/register/mfa');
      return;
    }

    ctx.status = 303;
    ctx.response.headers.set('Location', '/login?msg=Registration+successful.+Please log in');

  }

  async dispatch(ctx: Context) {

    if (!getSetting('registration.enabled')) {
      throw new Forbidden('This feature is disabled');
    }
    return super.dispatch(ctx);

  }


}

export default new UserRegistrationController();
