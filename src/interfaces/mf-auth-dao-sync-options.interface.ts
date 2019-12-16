import { MFAuthUserProperties } from '../enums/mf-auth-user-properties.enum';

export interface IMFAuthDaoSyncOptions {
  propertiesToSync: {
    [key in MFAuthUserProperties]?: boolean;
  };
}

