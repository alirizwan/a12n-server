import Controller from '@curveball/controller';
import { Context } from '@curveball/core';
import { BadRequest } from '@curveball/http-errors/dist';
import * as userService from '../../user/service';
import * as hal from '../formats/hal';
import * as groupService from '../service';

class GroupMemberCollectionControlller extends Controller {
  async get(ctx: Context) {

    const user = await userService.findById(parseInt(ctx.state.params.id, 10));

    /**
     * Cheks if user type is a group
     */
    const groupUser = await groupService.isGroup(user);

    if (!groupUser) {
      throw new BadRequest('User must be a group to gain access');
    }

    const groupMemebers = await groupService.findAllGroupMemebers(user);
    ctx.response.body = hal.collection(user, groupMemebers);
  }

}

export default new GroupMemberCollectionControlller();
