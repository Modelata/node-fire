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
      .then(userRecord => Promise.all(
        this.configuration.pathsMap.map(pathMap => this.db.doc(pathMap.documentPath.replace(':userId', userId))
          .set(Object.keys(pathMap.properties)
            .filter(authUserPropertyName => !options || (options as any)[authUserPropertyName])
            .reduce(
              (updateValue: any, authUserPropertyName: string) => {
                updateValue[pathMap.properties[authUserPropertyName]] = (userRecord as any)[authUserPropertyName];
                return updateValue;
              },
              {}
            )
          )
        )
      ))
      .then();
  }

  updateAuthUserFromDocument(userId: string, options?: IMFAuthDaoSyncOptions): Promise<void> {
    return Promise.all(
      this.configuration.pathsMap.map(pathMap => this.db.doc(pathMap.documentPath.replace(':userId', userId)).get()
        .then((docSnap) => {
          const doc = docSnap.data;
          return this.auth.updateUser(userId, Object.keys(pathMap.properties)
            .filter(authUserPropertyName => !options || (options as any)[authUserPropertyName])
            .reduce(
              (updateValue: any, authUserPropertyName: string) => {
                updateValue[authUserPropertyName] = (doc as any)[pathMap.properties[authUserPropertyName]];
                return updateValue;
              },
              {}
            )
          );
        })
      )
    ).then();
  }
}
