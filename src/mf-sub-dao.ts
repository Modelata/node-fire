import { IMFLocation } from '@modelata/fire/lib/node';
import { MFDao } from './mf-dao';
import { MFModel } from './mf-model';
import { Bucket } from '@google-cloud/storage';

class BasiqueModel extends MFModel<any> { }

/**
 * Abstract Dao class use for subdocuments of flattable model
 */
export class SubMFDao extends MFDao<any> {
  /**
   * @inheritdoc
   */
  public mustachePath: string;

  /**
   * Must be called with super
   *
   * @param mustachePath subCollection mustache path
   * @param db Firestore database to use
   * @param referentGetNewModel Parent getNewModelMethod
   * @param beforeSave Parent before save method to apply
   * @param storage Bucket if model contains files to save
   */
  constructor(
    mustachePath: string,
    db: FirebaseFirestore.Firestore,
    private referentGetNewModel: (data?: Partial<any>, location?: Partial<IMFLocation>) => any,
    public beforeSave: (model: Partial<any>, location?: string | Partial<IMFLocation>) => Promise<Partial<any>>,
    storage?: Bucket,
  ) {
    super(db, storage);
    this.mustachePath = mustachePath;
  }

  /**
   * Returns true or false denpending on if the data contains values applicable to this subDao's submodel
   *
   * @param data The data to check
   * @return boolean
   */
  containsSomeValuesForMe(data: Object): boolean {
    const refModel = this.referentGetNewModel(data);
    return !!Object.keys(refModel).find(key =>
      Reflect.hasMetadata('subDocPath', refModel, key) &&
      this.mustachePath.endsWith(Reflect.getMetadata('subDocPath', refModel, key).split('/')[0]) &&
      data.hasOwnProperty(key)
    );
  }

  /**
   * Splits the data passed as parameter into data applicable to different documents using the same DAO
   *
   * @param data the data to split
   * @returns An object containing the data splitted by docIds
   */
  splitDataByDocId(data: Partial<any>): { [docId: string]: object } {
    const refModel = this.referentGetNewModel(data);
    return Object.keys(refModel).reduce(
      (dataById, key) => {
        if (
          Reflect.hasMetadata('subDocPath', refModel, key) &&
          this.mustachePath.endsWith(Reflect.getMetadata('subDocPath', refModel, key).split('/')[0])
        ) {
          const docId = Reflect.getMetadata('subDocPath', refModel, key).split('/')[1];
          if (!(dataById as any)[docId]) {
            (dataById as any)[docId] = {};
          }
          if ((data as Object).hasOwnProperty(key)) {
            (dataById as any)[docId][key] = data[key];
          }
        }
        return dataById;
      },
      {}
    );
  }

  /**
   * @inheritdoc
   *
   * @param data
   * @param location
   */
  getNewModel(data?: Partial<any>, location?: Partial<IMFLocation>): any {
    const parentRefModel = this.referentGetNewModel(data, location);
    const basiqueModel = new BasiqueModel();
    Object.keys(parentRefModel).forEach((key) => {
      if (
        !(basiqueModel as Object).hasOwnProperty(key) &&
        (
          !Reflect.hasMetadata('subDocPath', parentRefModel, key) ||
          !this.mustachePath.endsWith(Reflect.getMetadata('subDocPath', parentRefModel, key).split('/')[0])
        )
      ) {
        delete parentRefModel[key];
      }
    });
    return parentRefModel;
  }

}
