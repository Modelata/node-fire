import {
  IMFDao,
  IMFLocation,
  IMFGetOneOptions,
  IMFGetListOptions,
  IMFSaveOptions,
  IMFFile,
  IMFOffset,
  IMFStorageOptions,
} from '@modelata/types-fire/lib/node';
import { DocumentReference, DocumentSnapshot, FieldValue, CollectionReference } from '@google-cloud/firestore';
import { Bucket } from '@google-cloud/storage';
import 'reflect-metadata';
import { MFModel } from './mf-model';
import {
  isCompatiblePath,
  getPath,
  getLocation,
  allDataExistInModel,
  getSavableData,
  getSplittedPath,
  getFileProperties
} from './helpers/model.helper';

/**
 * Abstract DAO class
 */
export abstract class MFDao<M extends MFModel<M>> implements IMFDao<M> {
  public readonly mustachePath: string = Reflect.getMetadata('mustachePath', this.constructor);

  constructor(private db: FirebaseFirestore.Firestore, private storage?: Bucket) { }

  /////////////////////////////////////
  /////////////////////////////////////
  ///////////// PUBLIC API ////////////
  /////////////////////////////////////
  /////////////////////////////////////

  abstract getNewModel(data?: Partial<M>, location?: Partial<IMFLocation>): M;

  async get(location: string | IMFLocation, options?: IMFGetOneOptions): Promise<M> {
    this.warnOnUnusedOptions('MFDao.getById')(options);
    if (location && (typeof location === 'string' || location.id)) {
      const reference = this.getReference(location) as DocumentReference;
      return this.getByReference(reference, options);
    }
    throw new Error('getById missing parameter : location and/or id');
  }

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

  async getByPath(path: string, options?: IMFGetOneOptions): Promise<M> {
    this.warnOnUnusedOptions('MFDao.getByPath')(options);
    if (path) {
      return this.getByReference(this.db.doc(path), options);
    }
    throw new Error('getByPath missing parameter : path');
  }

  getReference(location: string | Partial<IMFLocation>): DocumentReference | CollectionReference {
    const realLocation = getLocation(location, this.mustachePath);

    return realLocation.id
      ? this.db.doc(getPath(this.mustachePath, realLocation))
      : this.db.collection(getPath(this.mustachePath, realLocation));
  }

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

  async create(data: M, location?: string | Partial<IMFLocation>, options?: IMFSaveOptions): Promise<M> {
    if (!allDataExistInModel(data, this.getNewModel())) {
      return Promise.reject('try to update/add an attribute that is not defined in the model');
    }

    (data as any)['updateDate'] = FieldValue.serverTimestamp();
    (data as any)['creationDate'] = FieldValue.serverTimestamp();
    const realLocation = getLocation(location || data, this.mustachePath);

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

  async update(data: Partial<M>, idOrLocationOrModel?: string | IMFLocation | M): Promise<Partial<M>> {
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

  async delete(idLocationOrModel: string | IMFLocation | M): Promise<void> {

    const realLocation = getLocation(idLocationOrModel, this.mustachePath);
    let deleteFilesPromise: Promise<M>;

    if (this.getFileProperties(this.getNewModel()).length) {
      deleteFilesPromise = (idLocationOrModel.hasOwnProperty('_collectionPath') ? // is model ? ok : get model
        Promise.resolve(idLocationOrModel as M) :
        this.get(realLocation as IMFLocation)
      ).then(model => this.deleteFiles(model));
    } else {
      deleteFilesPromise = Promise.resolve(null);
    }

    return deleteFilesPromise.then(() => (this.getReference(realLocation) as DocumentReference).delete()).then();
  }

  deleteByReference(reference: DocumentReference) {
    if (getFileProperties(this.getNewModel()).length) {
      return this.getByReference(reference)
        .then(model => this.delete(model));
    }
    return reference.delete();
  }

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

  async getSnapshot(location: string | IMFLocation, options?: IMFGetOneOptions): Promise<DocumentSnapshot> {
    this.warnOnUnusedOptions('MFDao.getSnapshot')(options);
    return (this.getReference(location) as DocumentReference).get();
  }

  async beforeSave(model: Partial<M>, location?: string | Partial<IMFLocation>): Promise<Partial<M>> {
    return Promise.resolve(model);
  }

  private async saveFiles(newModel: Partial<M>, newLocation: IMFLocation): Promise<{
    newModel: Partial<M>,
    newLocation: IMFLocation
  }> {
    throw new Error('Method saveFiles not yet implemented in @modelata/node-fire.');
  }

  saveFile(fileObject: IMFFile, location: string | IMFLocation): Promise<IMFFile> {
    throw new Error('Method saveFile not yet implemented in @modelata/node-fire.');
  }

  private async deleteFiles(model: M): Promise<M> {
    const fileProperties = getFileProperties(model);

    return fileProperties.length ?
      Promise.all(fileProperties.filter(key => (model as any)[key]).map((key) => {
        const property = (model as any)[key] as IMFFile;
        if (property && property.storagePath && (Reflect.getMetadata('storageProperty', model, key) as IMFStorageOptions).deleteOnDelete) {
          return this.deleteFile(property);
        }
        return Promise.resolve();
      })).then(() => model) :
      Promise.resolve(model);
  }

  public deleteFile(fileObject: IMFFile): Promise<void> {
    if (this.storage) {
      return this.storage.file(fileObject.storagePath).delete().then(() => Promise.resolve()).catch((err) => {
        if (err.code === 'storage/object-not-found') {
          return Promise.resolve();
        }
        return Promise.reject(err);
      });
    }
    return Promise.reject(new Error('AngularFireStorage was not injected'));
  }

  public isCompatible(doc: M | DocumentReference | CollectionReference): boolean {
    return isCompatiblePath(
      this.mustachePath,
      (doc as M)._collectionPath ||
      (doc as DocumentReference).path ||
      (doc as CollectionReference).path
    );
  }

  /////////////////////////////////////
  /////////////////////////////////////
  ////////////// PRIVATE //////////////
  /////////////////////////////////////
  /////////////////////////////////////

  private warnOnUnusedOptions(methodName: string) {
    return function (options?: any) {
      const unusedOptions = [
        'cacheable',
        'completeOnFirst',
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

  private getOffsetSnapshot(offsetOption: IMFOffset<M>, options?: IMFGetOneOptions): Promise<DocumentSnapshot> {
    const offset = offsetOption.startAt || offsetOption.startAfter || offsetOption.endAt || offsetOption.endBefore;
    return typeof offset === 'string' ? this.getSnapshot(offset, options) : Promise.resolve(offset);
  }

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

  private getFileProperties(model?: Partial<M>): string[] {
    return getFileProperties((model || this.getNewModel()) as Object);
  }
}
