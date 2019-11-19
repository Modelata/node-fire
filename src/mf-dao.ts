import { IMFDao, IMFLocation, IMFGetOneOptions, IMFGetListOptions, IMFSaveOptions, IMFFile } from '@modelata/types-fire/lib/node';
import { DocumentReference, DocumentSnapshot, FieldValue, CollectionReference } from '@google-cloud/firestore';
import 'reflect-metadata';
import { MFModel } from './mf-model';
import { isCompatiblePath, getPath, getLocation } from './helpers/model.helper';
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
      ? this.db.doc(getPath(this.mustachePath, location))
      : this.db.collection(getPath(this.mustachePath, location));
  }

  async get(location: string | IMFLocation, options?: IMFGetOneOptions): Promise<M> {
    this.warnOnUnusedOptions('MFDao.getById')(options);
    if (location && (typeof location === 'string' || location.id)) {
      const reference = this.getReference(location) as DocumentReference;
      if (this.isCompatible(reference)) {
        return reference.get()
          .then(snapshot => this.getModelFromSnapshot(snapshot));
      }
      throw new Error('location is not compatible with this dao!');
    } else {
      throw new Error('getById missing parameter : location and/or id');
    }
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
      const reference = this.db.doc(path);
      if (this.isCompatible(reference)) {
        return reference.get()
          .then(snapshot => this.getModelFromSnapshot(snapshot));
      }
      throw new Error('path is not compatible with this dao!');
    } else {
      throw new Error('getByPath missing parameter : path');
    }
  }
  async getList(location?: Omit<IMFLocation, 'id'>, options?: IMFGetListOptions): Promise<M[]> {
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

      if (options.offset && (options.offset.endBefore || options.offset.startAfter || options.offset.endAt || options.offset.startAt)) {
        const offsetSnapshot = await this.getSnapshot(
          options.offset.endBefore || options.offset.startAfter || options.offset.endAt || options.offset.startAt
        );
        if (options.offset.startAt) {
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

  async create(data: M, location?: string | IMFLocation, options?: IMFSaveOptions): Promise<M> {
    const realLocation = getLocation(location);
    const emptyModel = this.getNewModel({}, realLocation);

    for (const key in data) {
      if (!emptyModel.hasOwnProperty(key)) {
        return Promise.reject(`try to update/add an attribute that is not defined in the model = ${key}`);
      }
    }

    (data as any)['updateDate'] = FieldValue.serverTimestamp();
    (data as any)['creationDate'] = FieldValue.serverTimestamp();

    let setOrAddPromise: Promise<any>;
    const reference = this.getReference(realLocation);
    if (realLocation.id) {
      setOrAddPromise = (reference as DocumentReference)
        .set(data, { merge: !options.overwrite })
        .then(() => {
          if (!data['_id']) {
            createHiddenProperty(data, 'id', realLocation.id);
          }
          return data;
        }).catch((error) => {
          console.error(error);
          console.log('error for ', data);
          return Promise.reject(error);
        });
    } else {
      setOrAddPromise = (reference as CollectionReference)
        .add(data)
        .then((ref) => {
          createHiddenProperty(data, 'id', ref.id);
          return data;
        });
    }

    return setOrAddPromise.then(doc =>
      this.getNewModel(doc, { ...realLocation, id: doc._id })
    );
  }
  async update(data: Partial<M>, location?: string | IMFLocation, options?: IMFSaveOptions): Promise<Partial<M>> {
    const realLocation = getLocation(location);
    const emptyModel = this.getNewModel({}, realLocation);

    for (const key in data) {
      if (!emptyModel.hasOwnProperty(key)) {
        return Promise.reject(`try to update/add an attribute that is not defined in the model = ${key}`);
      }
    }

    (data as any)['updateDate'] = FieldValue.serverTimestamp();

    return (this.getReference(realLocation) as DocumentReference).update(data)
      .then(() => data);
  }

  async delete(location: string | IMFLocation): Promise<void> {
    return (this.getReference(location) as DocumentReference).delete().then();
  }

  getModelFromSnapshot(snapshot: DocumentSnapshot): M {
    if (snapshot.exists) {
      const pathIds: Omit<IMFLocation, 'id'> = {};
      const pathSplitted = snapshot.ref.path.split('/');
      if (pathSplitted.length > 2) {
        for (let i = 1; i < pathSplitted.length; i += 2) {
          // take every second element
          pathIds[pathSplitted[i - 1]] = pathSplitted[i];
        }
      }
      const model = this.getNewModel(
        snapshot.data() as Partial<M>,
        {
          id: snapshot.id,
          ...pathIds
        }
      );
      return model;
    }
    console.error(
      '[firestoreDao] - getNewModelFromDb return null because dbObj.exists is null or false. dbObj :',
      snapshot
    );
    return null;
  }

  async getSnapshot(location: string | IMFLocation): Promise<DocumentSnapshot> {
    return (this.getReference(location) as DocumentReference).get();
  }

  async beforeSave(model: any): Promise<any> {
    return Promise.resolve(model);
  }

  saveFile(fileObject: IMFFile, location: string | IMFLocation): IMFFile {
    throw new Error('Method not implemented.');
  }

  private isCompatible(doc: M | DocumentReference): boolean {
    return isCompatiblePath(this.mustachePath, doc instanceof DocumentReference ? doc.path : doc._collectionPath);
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
}
