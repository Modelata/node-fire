import { SubMFDao } from '../mf-sub-dao';

/**
 * List of sub-daos used in flattable dao (auto-generated)
 */
export interface IMFSubDAOs {
  [daoPath: string]: {
    dao: SubMFDao,
    ids: string[],
  };
}
