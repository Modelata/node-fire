import { MFAuthUserProperties } from '../enums/mf-auth-user-properties.enum';

export interface IMFAuthDaoPathMap {
  documentPath: string;
  properties: {
    [authUserProperty in MFAuthUserProperties]?: string;
  };
}
