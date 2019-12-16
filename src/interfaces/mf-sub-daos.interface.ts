import { SubMFDao } from '../mf-sub-dao';

export interface IMFSubDAOs {
  [daoPath: string]: {
    dao: SubMFDao,
    ids: string[],
  };
}
