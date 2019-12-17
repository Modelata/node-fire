import { MFDao } from './mf-dao';
import { MFModel } from './mf-model';
import * as admin from 'firebase-admin';
import { MFAuthUserProperties, IMFAuthDaoSyncOptions, getAuthUserProperties } from '@modelata/fire/lib/node';
import { MFFlattableDao } from './mf-flattable-dao';

export abstract class MFAuthDAO<UserModel extends MFModel<UserModel>, UserDao extends MFDao<UserModel> | MFFlattableDao<UserModel>> {
  usersCollectionPath: string = Reflect.getMetadata('usersCollectionPath', this.constructor);

  constructor(
    private auth: admin.auth.Auth,
    private db: FirebaseFirestore.Firestore,
    private userDao: UserDao,
  ) { }

  updateUserDocumentFromAuth(userId: string, options?: IMFAuthDaoSyncOptions): Promise<void> {
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
        console.log('MFAuthDAO.updateUserDocumentFromAuth nothing to update');
        return Promise.resolve();
      });
  }

  updateAuthUserFromDocument(userId: string, options?: IMFAuthDaoSyncOptions): Promise<void> {
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
        console.log('MFAuthDAO.updateAuthUserFromDocument nothing to update');
        return Promise.resolve();
      });
  }
}
