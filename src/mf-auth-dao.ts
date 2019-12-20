import { MFDao } from './mf-dao';
import { MFModel } from './mf-model';
import * as admin from 'firebase-admin';
import {
  MFAuthUserProperties,
  IMFAuthDaoSyncOptions,
  getAuthUserProperties,
  MFLogger,
} from '@modelata/fire/lib/node';
import { MFFlattableDao } from './mf-flattable-dao';

/**
 * Abstract class allowing to sync user document with authUser
 */
export abstract class MFAuthDAO<UserModel extends MFModel<UserModel>, UserDao extends MFDao<UserModel> | MFFlattableDao<UserModel>> {
  /**
   * Called with super
   *
   * @param auth Firebase auth service
   * @param userDao Dao used to interact with user document
   */
  constructor(
    private auth: admin.auth.Auth,
    private userDao: UserDao,
  ) { }

  /**
   * Updates user document with data from auth user
   *
   * @param userId Uid of the auth user (as well as user document id)
   * @param options (properties to sync)
   */
  async updateUserDocumentFromAuth(userId: string, options?: IMFAuthDaoSyncOptions): Promise<void> {
    return this.auth.getUser(userId)
      .then((authUser) => {
        return getAuthUserProperties(this.userDao.getNewModel()).reduce(
          (updateValue: any, propertyName) => {
            if (
              (authUser as any)[propertyName] !== undefined &&
              (!options || (options && options.propertiesToSync && options.propertiesToSync[propertyName as MFAuthUserProperties]))
            ) {
              updateValue[propertyName] = (authUser as any)[propertyName];
            }
            return updateValue;
          },
          {}
        );
      }
      )
      .then((updateValue) => {
        if (Object.keys(updateValue).length) {
          return this.userDao.update(updateValue, userId)
            .then();
        }
        MFLogger.debugLibrary('MFAuthDAO.updateUserDocumentFromAuth nothing to update');
        return Promise.resolve();
      });
  }

  /**
   * Updates authUser with data from user document
   *
   * @param userId Uid of the auth user (as well as user document id)
   * @param options (properties to sync)
   */
  async updateAuthUserFromDocument(userId: string, options?: IMFAuthDaoSyncOptions): Promise<void> {
    return this.userDao.get(userId)
      .then((user: UserModel) => {
        return getAuthUserProperties(user).reduce(
          (updateValue: any, propertyName) => {
            if (
              (user as any)[propertyName] !== undefined &&
              (!options || (options && options.propertiesToSync && options.propertiesToSync[propertyName as MFAuthUserProperties]))
            ) {
              updateValue[propertyName] = (user as any)[propertyName];
            }
            return updateValue;
          },
          {}
        );
      })
      .then((updateValue) => {
        if (Object.keys(updateValue)) {
          return this.auth.updateUser(userId, updateValue).then();
        }
        MFLogger.debugLibrary('MFAuthDAO.updateAuthUserFromDocument nothing to update');
        return Promise.resolve();
      });
  }
}
