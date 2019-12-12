import { MFDao } from './mf-dao';
import { MFModel } from './mf-model';
import * as admin from 'firebase-admin';
import { IMFUserInterface } from './interfaces/mf-user.interface';
import { IMFAuthDaoSyncOptions } from './interfaces/mf-auth-dao-sync-options.interface';
import { getAuthUserProperties } from './helpers/model.helper';

export abstract class MFAuthDAO<UserModel extends MFModel<UserModel>, UserDao extends MFDao<UserModel>> {
  usersCollectionPath: string;

  constructor(
    private auth: admin.auth.Auth,
    private db: FirebaseFirestore.Firestore,
    private userDao: UserDao,
  ) { }

  updateUserDocumentFromAuth(userId: string, options?: IMFAuthDaoSyncOptions): Promise<void> {

  }

  updateAuthUserFromDocument(userId: string, options?: IMFAuthDaoSyncOptions): Promise<void> {
    return this.userDao.getByPath(`${this.usersCollectionPath}/${userId}`)
      .then((user: UserModel) => getAuthUserProperties(user).reduce(
        (updateValue: any, propertyName) => {
          if ((user as any)[propertyName] !== undefined) {
            updateValue[propertyName] = (user as any)[propertyName];
          }
          return updateValue;
        },
        {}
      ))
      .then((updateValue) => {
        if (Object.keys(updateValue)) {
          return this.auth.updateUser(userId, updateValue).then();
        }
        return Promise.resolve();
      });
  }
}
