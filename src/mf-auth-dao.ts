import { MFDao } from './mf-dao';
import { MFModel } from './mf-model';

export abstract class MFAuthDAO<UserModel extends MFModel<UserModel>, UserDao extends MFDao<UserModel>> {
  constructor(
    private userDao: UserDao,
    private auth:
  ) { }
}
