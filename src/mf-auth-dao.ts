import { MFDao } from './mf-dao';
import { MFModel } from './mf-model';
import * as admin from 'firebase-admin';
import { IMFAuthDaoConfig } from './interfaces/mf-auth-dao-config.interface';
import { IMFAuthDaoSyncOptions } from './interfaces/mf-auth-dao-sync-options.interface';

export abstract class MFAuthDAO {
  constructor(
    private auth: admin.auth.Auth,
    private db: FirebaseFirestore.Firestore,
    private configuration: IMFAuthDaoConfig
  ) { }

  updateUserDocumentFromAuth(userId: string, options?: IMFAuthDaoSyncOptions): Promise<void> {
    return this.auth.getUser(userId)
      .then((userRecord) => {
        console.log('userRecord', userRecord);
        Promise.all(
          this.configuration.pathsMap.map((pathMap) => {
            const updateValue = Object.keys(pathMap.properties)
              .filter(authUserPropertyName => !options || (options as any)[authUserPropertyName])
              .reduce(
                (currentUpdateValue: any, authUserPropertyName: string) => {
                  if ((userRecord as any)[authUserPropertyName] !== undefined) {
                    currentUpdateValue[pathMap.properties[authUserPropertyName]] = (userRecord as any)[authUserPropertyName];
                  }
                  return currentUpdateValue;
                },
                {}
              );
            console.log('updateValue', updateValue);
            return Object.keys(updateValue).length > 0 ? this.db.doc(pathMap.documentPath.replace('{userId}', userId))
              .set(updateValue) : Promise.resolve(null);
          })
        )
      })
      .then();
  }

  updateAuthUserFromDocument(userId: string, options?: IMFAuthDaoSyncOptions): Promise<void> {
    return Promise.all(
      this.configuration.pathsMap.map(pathMap => this.db.doc(pathMap.documentPath.replace(':userId', userId)).get()
        .then((docSnap) => {
          const doc = docSnap.data;
          console.log('doc', doc);
          const updateValue = Object.keys(pathMap.properties)
            .filter(authUserPropertyName => !options || (options as any)[authUserPropertyName])
            .reduce(
              (currentUpdateValue: any, authUserPropertyName: string) => {
                if ((doc as any)[pathMap.properties[authUserPropertyName]] !== undefined) {
                  currentUpdateValue[authUserPropertyName] = (doc as any)[pathMap.properties[authUserPropertyName]];
                }
                return currentUpdateValue;
              },
              {}
            );
          console.log('updateValue', updateValue);
          return Object.keys(updateValue).length > 0 ? this.auth.updateUser(userId, updateValue) : Promise.resolve(null);
        })
      )
    ).then();
  }
}
