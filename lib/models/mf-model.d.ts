import { IMFModel, IMFLocation } from '@modelata/types-fire/lib/node';
export declare abstract class MFModel implements IMFModel {
    _id: string;
    _collectionPath: string;
    creationDate: Date;
    updateDate: Date;
    initialize(data: Partial<this>, location: Partial<IMFLocation>): void;
}
