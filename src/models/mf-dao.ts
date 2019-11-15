import { IMFDao, IMFLocation, IMFGetOneOptions, IMFGetListOptions, IMFSaveOptions, IMFFile } from '@modelata/types-fire/lib/node';
import { DocumentReference, DocumentSnapshot } from '@google-cloud/firestore';
import 'reflect-metadata';
import { MFModel } from './mf-model';
import { isCompatiblePath, getPath } from '../helpers/model.helper';
import * as admin from 'firebase-admin';

export abstract class MFDao<M extends MFModel> implements IMFDao<M> {
  mustachePath: string = Reflect.getMetadata('collectionPath', this.constructor);
  private db: FirebaseFirestore.Firestore;

  constructor(db: FirebaseFirestore.Firestore) {
    this.db = db;
  }

  abstract getNewModel(data?: Partial<M>, location?: Partial<IMFLocation>): M;

  getReference(location: string | IMFLocation): DocumentReference {
    return this.db.doc(getPath(this.mustachePath, location));
  }

  async get(location: string | IMFLocation, options?: IMFGetOneOptions): Promise<any> {
    this.warnOnUnusedOptions('MFDao.getById')(options);
    if (location) {
      const reference = this.getReference(location);
      if (this.isCompatible(reference)) {
        return reference.get()
          .then(snapshot => this.getModelFromSnapshot(snapshot));
      }
      throw new Error('location is not compatible with this dao!');
    } else {
      throw new Error('getById missing parameter : location');
    }
  }

  async getByReference(reference: DocumentReference, options?: IMFGetOneOptions): Promise<any> {
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

  async getByPath(path: string, options?: IMFGetOneOptions): Promise<any> {
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
  async getList(location?: Omit<IMFLocation, 'id'>, options?: IMFGetListOptions): Promise<any[]> {
    this.warnOnUnusedOptions('MFDao.getList')(options);

    if (location) {
      const reference = this.db.collection(getPath(this.mustachePath, location));
      let query: FirebaseFirestore.Query = reference;

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
        const offsetSnapshot = await this.getSnapshotFromId(
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

      return query.get()
        .then(querySnapshot => querySnapshot.docs.map(documentSnapshot => this.getModelFromSnapshot(documentSnapshot)))
    }

    throw new Error('getList missing parameter : location');
  }

  async create(data: any, location?: string | IMFLocation, options?: IMFSaveOptions): Promise<any> {
    throw new Error('Method not implemented.');
  }
  async update(data: any, location?: string | IMFLocation, options?: IMFSaveOptions): Promise<any> {
    throw new Error('Method not implemented.');
  }

  async delete(location: string | IMFLocation): Promise<void> {
    return this.getReference(location).delete().then();
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

  async getSnapshotFromId(id: string): Promise<DocumentSnapshot> {
    throw new Error('Method not implemented.');
  }

  beforeSave(model: any): Promise<any> {
    throw new Error('Method not implemented.');
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
