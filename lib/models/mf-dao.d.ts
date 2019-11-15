import { IMFDao, IMFLocation, IMFGetOneOptions, IMFGetListOptions, IMFSaveOptions, IMFFile } from '@modelata/types-fire/lib/node';
import { DocumentReference, DocumentSnapshot } from '@google-cloud/firestore';
import 'reflect-metadata';
import { MFModel } from './mf-model';
export declare abstract class MFDao<M extends MFModel> implements IMFDao<M> {
    collectionPath: string;
    getNewModel(data?: Partial<M>, location?: Partial<IMFLocation>): M;
    getReference(location: string | IMFLocation): DocumentReference;
    getById(location: string | IMFLocation, options?: IMFGetOneOptions): Promise<any>;
    getByReference(reference: DocumentReference, options?: IMFGetOneOptions): Promise<any>;
    getByPath(path: string, options?: IMFGetOneOptions): Promise<any>;
    getList(location?: Pick<IMFLocation, string | number>, options?: IMFGetListOptions): Promise<any[]>;
    create(data: any, location?: string | IMFLocation, options?: IMFSaveOptions): Promise<any>;
    update(data: any, location?: string | IMFLocation, options?: IMFSaveOptions): Promise<any>;
    delete(id: string): Promise<void>;
    getModelFromSnapshot(snapshot: DocumentSnapshot): M;
    getSnapshotFromId(id: string): Promise<DocumentSnapshot>;
    beforeSave(model: any): Promise<any>;
    saveFile(fileObject: IMFFile, location: string | IMFLocation): IMFFile;
    private isCompatible;
}
