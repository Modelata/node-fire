import { IMFModel, IMFLocation } from '@modelata/types-fire/lib/node';
import { MissingFieldNotifier } from './helpers/missing-field-notifier';
import { getPath } from './helpers/model.helper';
import { Enumerable } from './decorators/enumerable.decorator';
import { createHiddenProperty } from './helpers/object.helper';

export abstract class MFModel<M> implements IMFModel<M> {
  @Enumerable(false)
  _snapshot: FirebaseFirestore.DocumentSnapshot;

  @Enumerable(false)
  _id: string;

  @Enumerable(false)
  _collectionPath: string;

  @Enumerable(false)
  creationDate: Date;

  @Enumerable(false)
  updateDate: Date;

  /**
   * initializes the instance of the model with the given data and location
   * @param data the data to inject in the instance
   * @param mustachePath the mustache path of the collection
   * @param location document id and identifiers to set in mustache path
   */
  initialize(
    data: Partial<M>,
    mustachePath?: string,
    location?: Partial<IMFLocation>
  ): void {
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
    if (location.id) {
      createHiddenProperty(this, 'id', location.id);
    } else if (data && (data as any)['_id']) {
      createHiddenProperty(this, 'id', (data as any)['_id']);
    }

    if (
      data &&
      (data as any)['_collectionPath'] &&
      !(<string>(data as any)['_collectionPath']).includes('{') &&
      (!mustachePath ||
        !location ||
        Object.keys(location).filter(key => key !== 'id').length === 0)
    ) {
      createHiddenProperty(
        this,
        'collectionPath',
        (data as any)['_collectionPath']
      );
    } else if (mustachePath) {
      createHiddenProperty(
        this,
        'collectionPath',
        getPath(mustachePath, location)
      );
    } else if (data && (data as any)['_collectionPath']) {
      createHiddenProperty(
        this,
        'collectionPath',
        (data as any)['_collectionPath']
      );
    }

    if (
      data &&
      (data as any)['updateDate'] &&
      typeof ((data as any)['updateDate'] as any).toDate === 'function'
    ) {
      createHiddenProperty(
        this,
        'updateDate',
        ((data as any)['updateDate'] as any).toDate()
      );
    }

    if (
      data &&
      (data as any)['creationDate'] &&
      typeof ((data as any)['creationDate'] as any).toDate === 'function'
    ) {
      createHiddenProperty(
        this,
        'creationDate',
        ((data as any)['creationDate'] as any).toDate()
      );
    }
  }
}
