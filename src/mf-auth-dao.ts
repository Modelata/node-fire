import { MFDao } from './mf-dao';
import { MFModel } from './mf-model';
import * as admin from 'firebase-admin';
import { IMFAuthDaoConfig } from './interfaces/mf-auth-dao-config.interface';
import { IMFAuthDaoSyncOptions } from './interfaces/mf-auth-dao-sync-options.interface';

export abstract class MFAuthDAO {
  constructor(
    private auth: admin.auth.Auth,
    private configuration: IMFAuthDaoConfig
  ) { }

  updateUserDocumentFromAuth(userId: string, options?: IMFAuthDaoSyncOptions): Promise<void> {
    return this.auth.getUser(userId)
      .then(userRecord => Promise.all(this.configuration.pathsMap.map(pathMap => getReferenceFromPath(pathMap.documentPath).set(Object.keys(pathMap.properties).filter().reduce(authUserProperty => )))))
      .then()
  }

  updateAuthUserFromDocument(userId: string, options?: IMFAuthDaoSyncOptions): Promise<void> {

  }
}
