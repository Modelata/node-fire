import 'reflect-metadata';
import {
  IMFGetListOptions,
  IMFGetOneOptions,
  IMFLocation,
  IMFSaveOptions,
  IMFUpdateOptions,
  MFOmit,
  concatMustachePaths,
  getLocation,
  getLocationFromPath,
  getSubPaths,
  mergeModels,
  getPath,
  IMFSubDocWithPath,
  IMFSubDocByPath,
  MFLogger,
} from '@modelata/fire/lib/node';
import { MFDao } from './mf-dao';
import { MFModel } from './mf-model';
import { SubMFDao } from './mf-sub-dao';
import { Bucket } from '@google-cloud/storage';
import { IMFSubDAOs } from './interfaces/mf-sub-daos.interface';
import { DocumentReference } from '@google-cloud/firestore';

/**
 * Abstract Flattable DAO class
 */
export abstract class MFFlattableDao<M extends MFModel<M>> extends MFDao<M>{


  private subDAOs: IMFSubDAOs = {};

  constructor(
    db: FirebaseFirestore.Firestore,
    storage?: Bucket
  ) {
    super(db, storage);
    this.initAllSubDao();
    if (!this.subDAOs || Object.keys(this.subDAOs).length < 1) {
      MFLogger.error(`${this.mustachePath} DAO EXTENDS MFFlattableDao But the model dont use any data stored in other document !! `);
      MFLogger.error(`${this.mustachePath} DAO MUST EXTENDS MFDao instead`);
    }
  }

  private initAllSubDao() {
    const refModel = this.getNewModel();
    const subPaths = getSubPaths(refModel);
    this.subDAOs = subPaths.reduce(
      (daos, subPath: string) => {
        const [daoPath, docId] = subPath.split('/');
        if (!(daos as any)[daoPath]) {
          (daos as any)[daoPath] = {
            dao: this.instantiateSubDao(daoPath),
            ids: [docId]
          };
        } else if (!((daos as any)[daoPath].ids as string[]).includes(docId)) {
          ((daos as any)[daoPath].ids as string[]).push(docId);
        }
        return daos;
      },
      {}
    );
  }


  private instantiateSubDao(subDaoPath: string): SubMFDao {
    const subMustachePath = concatMustachePaths(this.mustachePath, subDaoPath);
    return new SubMFDao(subMustachePath, this.db, this.getNewModel, this.beforeSave, this.storage);
  }



  private async get_subDocs(parentLocation: IMFLocation, options: IMFGetOneOptions = {}): Promise<IMFSubDocByPath> {
    return Promise.all(
      Object.keys(this.subDAOs)
        .map(subDaoPath =>
          this.subDAOs[subDaoPath].ids.map(docId =>
            this.subDAOs[subDaoPath].dao.get(
              {
                ...parentLocation,
                parentId: parentLocation.id,
                id: docId
              },
              {
                ...options,
                warnOnMissing: false
              }
            ).then((model) => {
              return { model, subDocPath: `${subDaoPath}/${docId}` } as IMFSubDocWithPath;
            }).catch((err) => {
              if (err.code === 'permission-denied') {
                return null;
              }
              return Promise.reject(err);
            })
          )
        )
        .reduce(
          (resultArray, subResultArray) => resultArray.concat(subResultArray),
          []
        )
    ).then((subDocsWithPath: IMFSubDocWithPath[]) => subDocsWithPath.reduce(
      (subDocsByPath, docWithPath) => {
        if (docWithPath && docWithPath.model) {
          (subDocsByPath as any)[docWithPath.subDocPath] = docWithPath.model;
        }
        return subDocsByPath;
      },
      {}
    )).then((result) => {
      return result;
    });
  }

  public async getByReference(reference: DocumentReference, options?: IMFGetOneOptions): Promise<M> {
    const realLocation = getLocationFromPath(reference.parent.path, this.mustachePath, reference.id) as IMFLocation;
    let mainModel: M;
    return super.getByReference(reference, options)
      .then((model) => {
        mainModel = model;
        return this.get_subDocs(realLocation, options);
      })
      .then(subDocsByPath => mergeModels(mainModel, subDocsByPath));
  }

  private async getModelWithSubDocsFromMainModel(mainModel: M, options: IMFGetOneOptions = {}): Promise<M> {
    const location = getLocation(mainModel, this.mustachePath) as IMFLocation;
    return this.get_subDocs(location, options)
      .then(subDocsByPath => mergeModels(mainModel, subDocsByPath));
  }

  public async getList(location?: MFOmit<IMFLocation, 'id'>, options: IMFGetListOptions<M> = {}): Promise<M[]> {
    return super.getList(location, options)
      .then(models => Promise.all(
        models.map(mainModel => this.getModelWithSubDocsFromMainModel(mainModel, options)),
      )
      );
  }

  extractMyData(data: Partial<M>): Partial<M> {
    const refModel = this.getNewModel(data);
    return Object.keys(refModel).reduce(
      (myData, key) => {
        if (
          !Reflect.hasMetadata('subDocPath', refModel, key) &&
          data.hasOwnProperty(key)
        ) {
          (myData as any)[key] = (data as any)[key];
        }
        return myData;
      },
      {}
    );
  }

  private create_subDocs(
    data: Partial<M>,
    parentLocation: IMFLocation,
    options: IMFSaveOptions = {}
  ): Promise<{ model: Partial<M>, subDocPath: string }[]> {


    return Promise.all(
      Object.keys(this.subDAOs).reduce(
        (creates: Promise<{ model: Partial<M>, subDocPath: string }>[], pathDao) => {
          // if (this.subDAOs[pathDao].dao.containsSomeValuesForMe(data as object)) { // commented for create empty subDoc
          const docsById = this.subDAOs[pathDao].dao.splitDataByDocId(data);
          return creates.concat(Object.keys(docsById).map(docId => this.subDAOs[pathDao].dao.create(
            docsById[docId],
            {
              ...parentLocation,
              parentId: parentLocation.id,
              id: docId
            },
            options
          ).then(model => ({ model, subDocPath: `${pathDao}/${docId}` }))));
          // }
          // return creates;
        },
        []
      )
    );
  }

  public async create(data: M, location?: string | Partial<IMFLocation>, options: IMFSaveOptions = {}): Promise<M> {
    const realLocation = getLocation(location, this.mustachePath) as IMFLocation;
    if (!realLocation.id) {
      realLocation.id = this.db.collection(getPath(this.mustachePath, realLocation)).doc().id;
    }
    return this.create_subDocs(
      data,
      realLocation,
      options
    ).then((subDocs) => {
      return super.create(this.extractMyData(data) as M, realLocation, options).then(modelSaved => mergeModels(
        modelSaved,
        subDocs.reduce(
          (subDocsByPath, docWithPath) => {
            (subDocsByPath as any)[docWithPath.subDocPath] = docWithPath.model;
            return subDocsByPath;
          }
          ,
          {}
        )
      ));

    });
  }

  private async update_subDocs(data: Partial<M>, parentLocation?: IMFLocation, options: IMFUpdateOptions<M> = {}): Promise<Partial<M>[]> {
    return Promise.all(
      Object.keys(this.subDAOs).reduce(
        (updates: Promise<Partial<M>>[], pathDao) => {
          if (this.subDAOs[pathDao].dao.containsSomeValuesForMe(data as object)) {
            const docsById = this.subDAOs[pathDao].dao.splitDataByDocId(data);
            return updates.concat(Object.keys(docsById).map(docId => this.subDAOs[pathDao].dao.update(
              docsById[docId],
              {
                ...parentLocation,
                parentId: parentLocation.id,
                id: docId
              },
              options
            )));
          }
          return updates;
        },
        []
      )
    );
  }

  public async update(data: Partial<M>, location?: string | IMFLocation | M, options: IMFUpdateOptions<M> = {}): Promise<Partial<M>> {
    const mainData = this.extractMyData(data);
    return Promise.all([
      Object.keys(mainData).length > 0 ? super.update(mainData, location, options) : Promise.resolve(data),
      this.update_subDocs(data, getLocation(location || (data as M), this.mustachePath) as IMFLocation, options)
    ]).then(() => data);
  }
}
