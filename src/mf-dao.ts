import {
  IMFDao,
  IMFLocation,
  IMFGetOneOptions,
  IMFGetListOptions,
  IMFSaveOptions,
  IMFFile,
  IMFOffset,
} from '@modelata/types-fire/lib/node';
import { DocumentReference, DocumentSnapshot, FieldValue, CollectionReference } from '@google-cloud/firestore';
import 'reflect-metadata';
import { MFModel } from './mf-model';
import { isCompatiblePath, getPath, getLocation, allDataExistInModel, getSavableData, getLocationFromPath, getSplittedPath } from './helpers/model.helper';
import { createHiddenProperty } from './helpers/object.helper';

export abstract class MFDao<M extends MFModel<M>> implements IMFDao<M> {
  mustachePath: string = Reflect.getMetadata('mustachePath', this.constructor);
  private db: FirebaseFirestore.Firestore;

  constructor(db: FirebaseFirestore.Firestore) {
    this.db = db;
  }

  abstract getNewModel(data?: Partial<M>, location?: Partial<IMFLocation>): M;

  getReference(location: string | Partial<IMFLocation>): DocumentReference | CollectionReference {
    const realLocation = getLocation(location);

    return realLocation.id
      ? this.db.doc(getPath(this.mustachePath, realLocation))
      : this.db.collection(getPath(this.mustachePath, realLocation));
  }

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
      return this.getByReference(this.db.doc(path));
    }
    throw new Error('getByPath missing parameter : path');
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

    const getDataToSave = this.beforeSave(data).then(data2 => getSavableData(data2));
    const realLocation = location ? getLocation(location) : getLocationFromPath(data._collectionPath, this.mustachePath, data._id);
    const reference = this.getReference(realLocation);

    let setOrAddPromise: Promise<any>;

    if (realLocation && realLocation.id) {
      setOrAddPromise = getDataToSave.then((dataToSave) => {
        return (reference as DocumentReference)
          .set(dataToSave, { merge: options && options.overwrite ? false : true });
      });
    } else {
      setOrAddPromise = getDataToSave.then((dataToSave) => {
        return (reference as CollectionReference)
          .add(dataToSave);
      });
    }

    return setOrAddPromise
      .then(ref =>
        this.getNewModel(data, ref ? ({ ...realLocation, id: ref.id }) : realLocation)
      ).catch((error) => {
        console.error(error);
        console.log('error for ', data);
        return Promise.reject(error);
      });
  }

  async update(data: Partial<M>, location?: string | IMFLocation, options?: IMFSaveOptions): Promise<Partial<M>> {
    if (!allDataExistInModel(data, this.getNewModel())) {
      return Promise.reject('try to update/add an attribute that is not defined in the model');
    }

    const realLocation = location ? getLocation(location) : getLocationFromPath(data._collectionPath, this.mustachePath, data._id);

    (data as any)['updateDate'] = FieldValue.serverTimestamp();

    return (this.getReference(realLocation) as DocumentReference).update(data)
      .then(() => data);
  }

  async delete(location: string | IMFLocation): Promise<void> {
    return (this.getReference(location) as DocumentReference).delete().then();
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

  async beforeSave(model: Partial<M>): Promise<Partial<M>> {
    return Promise.resolve(model);
  }

  saveFile(fileObject: IMFFile, location: string | IMFLocation): IMFFile {
    throw new Error('Method saveFile not yet implemented in @modelata/node-fire.');
  }

  public isCompatible(doc: M | DocumentReference | CollectionReference): boolean {
    return isCompatiblePath(
      this.mustachePath,
      (doc as M)._collectionPath ||
      (doc as DocumentReference).path ||
      (doc as CollectionReference).path
    );
  }

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
}
