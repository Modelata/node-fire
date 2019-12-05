import { IMFModel, IMFLocation } from '@modelata/types-fire/lib/node';
import { MissingFieldNotifier } from './helpers/missing-field-notifier';
import { getPath } from './helpers/model.helper';
import { Enumerable } from './decorators/enumerable.decorator';
import { createHiddenProperty } from './helpers/object.helper';

export abstract class MFModel<M> implements IMFModel<M> {
  @Enumerable(false)
  _snapshot: FirebaseFirestore.DocumentSnapshot = null;

  @Enumerable(false)
  _id: string = null;

  @Enumerable(false)
  _collectionPath: string = null;

  @Enumerable(false)
  creationDate: Date = null;

  @Enumerable(false)
  updateDate: Date = null;

  /**
   * initializes the instance of the model with the given data and location
   *
   * @param data the data to inject in the instance
   * @param mustachePath the mustache path of the collection
   * @param location document id and identifiers to set in mustache path
   */
  initialize(
    data: Partial<M>,
    mustachePath?: string,
    location?: Partial<IMFLocation>
  ): void {
    if (location && location.id) {
      createHiddenProperty(this, 'id', location.id);
    } else if (data && (data as any)['_id']) {
      createHiddenProperty(this, 'id', (data as any)._id);
    }

    if (mustachePath && location) {
      createHiddenProperty(this, 'collectionPath', getPath(mustachePath, { ...location, id: null }));
    } else if (data && (data as any)._collectionPath) {
      createHiddenProperty(this, 'collectionPath', (data as any)._collectionPath);
    }
    if (data) {
      for (const key in data) {
        if (
          !key.startsWith('_') &&
          !key.startsWith('$') &&
          typeof data[key] !== 'function'
        ) {
          // console.log(this);
          if (this.hasOwnProperty(key)) {
            if (data[key] && typeof (data[key] as any).toDate === 'function') {
              (this as any)[key] = (data[key] as any).toDate();
            } else {
              (this as any)[key] = data[key];
            }
          } else {
            MissingFieldNotifier.notifyMissingField(this.constructor.name, key);
          }
        }
      }
    }
  }
}
