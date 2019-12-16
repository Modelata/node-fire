import {
  IMFDao,
  IMFLocation,
  IMFGetOneOptions,
  IMFGetListOptions,
  IMFSaveOptions,
  IMFFile,
  IMFOffset,
  IMFStorageOptions,
  IMFUpdateOptions,
  IMFDeleteOptions,
  IMFDeleteOnDeleteFilesOptions,
  isCompatiblePath,
  getPath,
  getLocation,
  allDataExistInModel,
  getSavableData,
  getSplittedPath,
  getFileProperties
} from '@modelata/fire/lib/node';
import { DocumentReference, DocumentSnapshot, FieldValue, CollectionReference } from '@google-cloud/firestore';
import { Bucket } from '@google-cloud/storage';
import 'reflect-metadata';
import { MFModel } from './mf-model';


/**
 * @inheritdoc
 */
export abstract class MFDao<M extends MFModel<M>> implements IMFDao<M> {
  /**
   * @inheritdoc
   */
  public readonly mustachePath: string = Reflect.getMetadata('mustachePath', this.constructor);

  /**
   * Must be called with super()
   *
   * @param db The databse to use to store data
   * @param storage The bucket where files will be stored
   */
  constructor(
    protected db: FirebaseFirestore.Firestore,
    protected storage?: Bucket
  ) { }

  /////////////////////////////////////
  /////////////////////////////////////
  ///////////// PUBLIC API ////////////
  /////////////////////////////////////
  /////////////////////////////////////

  /**
   * @inheritdoc
   *
   * @param data
   * @param location
   */
  abstract getNewModel(data?: Partial<M>, location?: Partial<IMFLocation>): M;

  /**
   * @inheritdoc
   *
   * @param idOrLocation
   * @param options
   */
  async get(idOrLocation: string | IMFLocation, options?: IMFGetOneOptions): Promise<M> {
    this.warnOnUnusedOptions('MFDao.getById')(options);
    if (idOrLocation && (typeof idOrLocation === 'string' || idOrLocation.id)) {
      const reference = this.getReference(idOrLocation) as DocumentReference;
      return this.getByReference(reference, options);
    }
    throw new Error('getById missing parameter : location and/or id');
  }

  /**
   * @inheritdoc
   *
   * @param reference
   * @param options
   */
  async getByReference(reference: DocumentReference, options?: IMFGetOneOptions): Promise<M> {
    this.warnOnUnusedOptions('MFDao.getByReference')(options);
    if (reference) {
      if (this.isCompatible(reference)) {
        return reference.get()
          .then(snapshot => this.getModelFromSnapshot(snapshot));
      }
      throw new Error('reference is not compatible with this dao!');
    } else {
      throw new Error('getByReference missing parameter : reference');
    }
  }

  /**
   * @inheritdoc
   *
   * @param path
   * @param options
   */
  async getByPath(path: string, options?: IMFGetOneOptions): Promise<M> {
    this.warnOnUnusedOptions('MFDao.getByPath')(options);
    if (path) {
      return this.getByReference(this.db.doc(path), options);
    }
    throw new Error('getByPath missing parameter : path');
  }

  /**
   * @inheritdoc
   *
   * @param idOrLocation
   */
  getReference(idOrLocation: string | Partial<IMFLocation>): DocumentReference | CollectionReference {
    const realLocation = getLocation(idOrLocation, this.mustachePath);

    return realLocation.id
      ? this.db.doc(getPath(this.mustachePath, realLocation))
      : this.db.collection(getPath(this.mustachePath, realLocation));
  }

  /**
   * @inheritdoc
   *
   * @param location
   * @param options
   */
  async getList(location?: Omit<IMFLocation, 'id'>, options?: IMFGetListOptions<M>): Promise<M[]> {
    this.warnOnUnusedOptions('MFDao.getList')(options);

    const reference = this.getReference(location) as CollectionReference;
    let query: FirebaseFirestore.Query = reference;

    if (options) {
      if (options.where && options.where.length > 0) {
        options.where.forEach((where) => {
          if (where) {
            query = query.where(where.field, where.operator, where.value);
          }
        });
      }

      if (options.orderBy) {
        query = query.orderBy(options.orderBy.field, options.orderBy.operator);
      }

      if (options.offset && (options.offset.startAt || options.offset.startAfter || options.offset.endAt || options.offset.endBefore)) {
        const getOneOptions: IMFGetOneOptions = {};
        if (options.hasOwnProperty('cacheable')) { getOneOptions.cacheable = options.cacheable; }
        if (options.hasOwnProperty('completeOnFirst')) { getOneOptions.completeOnFirst = options.completeOnFirst; }
        if (options.hasOwnProperty('withSnapshot')) { getOneOptions.withSnapshot = options.withSnapshot; }
        const offsetSnapshot = await this.getOffsetSnapshot(options.offset, getOneOptions);
        if (Object.values(options.offset).filter(value => !!value).length > 1) {
          throw new Error('Two many offset options');
        } else if (options.offset.startAt) {
          query = query.startAt(offsetSnapshot);
        } else if (options.offset.startAfter) {
          query = query.startAfter(offsetSnapshot);
        } else if (options.offset.endAt) {
          query = query.endAt(offsetSnapshot);
        } else if (options.offset.endBefore) {
          query = query.endBefore(offsetSnapshot);
        }
      }

      if (options.limit !== null && options.limit !== undefined && options.limit > -1) {
        query = query.limit(options.limit);
      }
    }

    return query.get()
      .then(querySnapshot => querySnapshot.docs.map(documentSnapshot => this.getModelFromSnapshot(documentSnapshot)));
  }

  /**
   * @inheritdoc
   *
   * @param data
   * @param idOrLocation
   * @param options
   */
  async create(data: M, idOrLocation?: string | Partial<IMFLocation>, options?: IMFSaveOptions): Promise<M> {
    if (!allDataExistInModel(data, this.getNewModel())) {
      return Promise.reject('try to update/add an attribute that is not defined in the model');
    }

    (data as any)['updateDate'] = FieldValue.serverTimestamp();
    (data as any)['creationDate'] = FieldValue.serverTimestamp();
    const realLocation = getLocation(idOrLocation || data, this.mustachePath);

    return this.beforeSave(data, realLocation)
      .then((model) => {

        let testIfdocAlreadyExist: Promise<void>;

        if (realLocation && realLocation.id && !options.overwrite) {
          testIfdocAlreadyExist = (this.getReference(realLocation) as DocumentReference).get()
            .then((snap: DocumentSnapshot) => {
              if (snap.exists) {
                return Promise.reject({
                  message: `conflict ! document ${snap.id} already exists`,
                  code: 409
                });
              }
              return Promise.resolve();
            });
        } else {
          testIfdocAlreadyExist = Promise.resolve();
        }

        return testIfdocAlreadyExist
          .then(() => {
            const ref = this.getReference(realLocation);
            const savableData = getSavableData(model);
            if (realLocation && realLocation.id) {
              return (ref as DocumentReference).set(savableData, { merge: !options.overwrite }).then(() => ref);
            }
            return (ref as CollectionReference).add(savableData);
          })
          .then(ref =>
            this.getNewModel(data, { ...realLocation, id: ref.id })
          )
          .catch((error) => {
            console.error(error);
            console.log('error for ', data);
            return Promise.reject(error);
          });

      });
  }

  /**
   * @inheritdoc
   *
   * @param data
   * @param idOrLocationOrModel
   * @param options
   */
  async update(data: Partial<M>, idOrLocationOrModel?: string | IMFLocation | M, options?: IMFUpdateOptions<M>): Promise<Partial<M>> {
    this.warnOnUnusedOptions('MFDao.update')(options);
    if (!allDataExistInModel(data, this.getNewModel())) {
      return Promise.reject('try to update/add an attribute that is not defined in the model');
    }
    const realLocation = getLocation(idOrLocationOrModel || (data as M), this.mustachePath);

    (data as any)['updateDate'] = FieldValue.serverTimestamp();

    return this.beforeSave(data, realLocation)
      .then(model => getSavableData(model))
      .then(savable => (this.getReference(realLocation) as DocumentReference).update(savable))
      .then(() => data);
  }

  /**
   * @inheritdoc
   *
   * @param idLocationOrModel
   * @param options
   */
  async delete(idLocationOrModel: string | IMFLocation | M, options?: IMFDeleteOptions<M>): Promise<void> {
    this.warnOnUnusedOptions('MFDao.delete')(options);
    const realLocation = getLocation(idLocationOrModel, this.mustachePath);
    let deleteFilesPromise: Promise<M>;

    if (this.getFileProperties(this.getNewModel()).length) {
      deleteFilesPromise = (idLocationOrModel.hasOwnProperty('_collectionPath') ? // is model ? ok : get model
        Promise.resolve(idLocationOrModel as M) :
        this.get(realLocation as IMFLocation)
      ).then(model => this.deleteFiles(model, options ? options.deleteOnDeleteFiles : undefined));
    } else {
      deleteFilesPromise = Promise.resolve(null);
    }

    return deleteFilesPromise.then(() => (this.getReference(realLocation) as DocumentReference).delete()).then();
  }

  /**
   * Delete a model by its reference
   *
   * @param reference Document reference
   */
  deleteByReference(reference: DocumentReference): Promise<void> {
    if (getFileProperties(this.getNewModel()).length) {
      return this.getByReference(reference)
        .then(model => this.delete(model));
    }
    return reference.delete().then();
  }

  /**
   * @inheritdoc
   *
   * @param snapshot
   */
  getModelFromSnapshot(snapshot: DocumentSnapshot): M {
    if (snapshot.exists) {
      return this.getNewModel(
        {
          ...snapshot.data() as Partial<M>,
          _id: snapshot.id,
          _collectionPath: snapshot.ref.path,
          _snapshot: snapshot,
        }
      );
    }
    console.error(
      '[firestoreDao] - getNewModelFromDb return null because dbObj.exists is null or false. dbObj :',
      snapshot
    );
    return null;
  }

  /**
   * @inheritdoc
   *
   * @param idOrLocation
   * @param options
   */
  async getSnapshot(idOrLocation: string | IMFLocation, options?: IMFGetOneOptions): Promise<DocumentSnapshot> {
    this.warnOnUnusedOptions('MFDao.getSnapshot')(options);
    return (this.getReference(idOrLocation) as DocumentReference).get();
  }

  /**
   * @inheritdoc
   *
   * @param model
   * @param idOrLocation
   */
  async beforeSave(model: Partial<M>, idOrLocation?: string | Partial<IMFLocation>): Promise<Partial<M>> {
    return Promise.resolve(model);
  }

  /**
   * Save files from declared file properties and returns the model with storage informations and location with new document id
   *
   * @param model the model for which files must be stored
   * @param location location of the model
   * @returns Promise of an object containing the model with storage informations and location with new document id
   */
  private async saveFiles(model: Partial<M>, location: IMFLocation): Promise<{
    newModel: Partial<M>,
    newLocation: IMFLocation
  }> {
    throw new Error('Method saveFiles not yet implemented in @modelata/node-fire.');
  }

  /**
   * @inheritdoc
   *
   * @param fileObject
   * @param location
   */
  saveFile(fileObject: IMFFile, location: string | IMFLocation): Promise<IMFFile> {
    throw new Error('Method saveFile not yet implemented in @modelata/node-fire.');
  }

  /**
   * Delete files from declared file properties and returns the model
   *
   * @param model the model for which files must be deleted
   * @param options override delete on delete default option
   * @returns Promise of the model
   */
  private async deleteFiles(model: M, options?: IMFDeleteOnDeleteFilesOptions<M>): Promise<M> {
    const fileProperties = getFileProperties(model);

    return fileProperties.length ?
      Promise.all(fileProperties.filter((key: string) => (model as any)[key]).map((key: string) => {
        const property = (model as any)[key] as IMFFile;
        if (
          property
          && (
            (options && typeof (options as any)[key] === 'boolean') ?
              (options as any)[key] :
              property.storagePath && (Reflect.getMetadata('storageProperty', model, key) as IMFStorageOptions).deleteOnDelete
          )
        ) {
          return this.deleteFile(property);
        }
        return Promise.resolve();
      })).then(() => model) :
      Promise.resolve(model);
  }

  /**
   * @inheritdoc
   *
   * @param fileObject
   */
  public async deleteFile(fileObject: IMFFile): Promise<void> {
    if (this.storage) {
      return this.storage.file(fileObject.storagePath).delete().then(() => Promise.resolve()).catch((err) => {
        if (err.code === 404) {
          return Promise.resolve();
        }
        return Promise.reject(err);
      });
    }
    return Promise.reject(new Error('AngularFireStorage was not injected'));
  }

  /**
   * Check if the model or reference is compatible with this DAO based on its path
   *
   * @param modelOrReference Model or reference to chheck
   */
  public isCompatible(modelOrReference: M | DocumentReference | CollectionReference): boolean {
    return isCompatiblePath(
      this.mustachePath,
      (modelOrReference as M)._collectionPath ||
      (modelOrReference as DocumentReference).path ||
      (modelOrReference as CollectionReference).path
    );
  }

  /////////////////////////////////////
  /////////////////////////////////////
  ////////////// PRIVATE //////////////
  /////////////////////////////////////
  /////////////////////////////////////

  /**
   * Returns a function consuming an options object and displaying a warning if some options are not available in nodejs context
   *
   * @param methodName The name of the method where this method was called
   */
  private warnOnUnusedOptions(methodName: string) {
    return function (options?: any) {
      const unusedOptions = [
        'cacheable',
        'completeOnFirst',
        'deletePreviousOnUpdateFiles',
      ];
      if (options) {
        unusedOptions.map((key) => {
          if (options[key]) {
            console.warn(`The '${key}' option is unused in node-fire, it will be ignored...`);
          }
        });
      }
    };
  }

  /**
   * Get the first offset snapshot available (startAt > startAfter > endAt > endBefore)
   *
   * @param offsetOption The offset option value used here
   * @param options get one options to apply
   */
  private getOffsetSnapshot(offsetOption: IMFOffset<M>, options?: IMFGetOneOptions): Promise<DocumentSnapshot> {
    const offset = offsetOption.startAt || offsetOption.startAfter || offsetOption.endAt || offsetOption.endBefore;
    return typeof offset === 'string' ? this.getSnapshot(offset, options) : Promise.resolve(offset);
  }

  /**
   * Get a reference from a compatible path
   *
   * @param path The path for which get a reference
   * @return a CollectionReference or a documentReference depending on the path param
   */
  getReferenceFromPath(path: string): DocumentReference | CollectionReference {
    if (isCompatiblePath(this.mustachePath, path)) {
      const { pathSplitted, mustachePathSplitted } = getSplittedPath(path, this.mustachePath);
      if (pathSplitted.length === mustachePathSplitted.length + 1) {
        return this.db.doc(path);
      }
      if (pathSplitted.length === mustachePathSplitted.length) {
        return this.db.collection(path);
      }
      throw new Error('Unable to establish if path is for doc or collection');
    }
    throw new Error('This path is not compatible with this DAO');
  }

  /**
   * Returns array of file properties names for the partial model consumed or if missing, for the model appliable to this dao
   *
   * @param model Some partial or full model
   */
  private getFileProperties(model?: Partial<M>): string[] {
    return getFileProperties((model || this.getNewModel()) as Object);
  }
}
