import { IMFModel, IMFLocation } from '@modelata/types-fire/lib/node';
import { MissingFieldNotifier } from '../helpers/missing-field-notifier';
import { ObjectHelper } from '../helpers/object.helper';
import { getPath } from '../helpers/model.helper';
import { Enumerable } from '../decorators/enumerable.decorator';

export abstract class MFModel implements IMFModel {
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
  initialize(data: Partial<this>, mustachePath?: string, location?: Partial<IMFLocation>): void {
    if (data) {
      for (const key in data) {
        if (!key.startsWith('_') && !key.startsWith('$') && typeof data[key] !== 'function') {
          if (this.hasOwnProperty(key)) {
            if (data[key] && typeof (data[key] as any).toDate === 'function') {
              this[key] = (data[key] as any).toDate();
            } else {
              this[key] = data[key];
            }
          } else {
            MissingFieldNotifier.notifyMissingField(this.constructor.name, key);
          }
        }
      }
    }
    if (location.id) {
      ObjectHelper.createHiddenProperty(this, 'id', location.id);
    } else if (data && data['_id']) {
      ObjectHelper.createHiddenProperty(this, 'id', data['_id']);
    }

    if (
      data
      && data['_collectionPath']
      && !(<string>data['_collectionPath']).includes('{')
      && (!mustachePath || !location || Object.keys(location).filter(key => key !== 'id').length === 0)
    ) {
      ObjectHelper.createHiddenProperty(this, 'collectionPath', data['_collectionPath']);
    } else if (mustachePath) {
      ObjectHelper.createHiddenProperty(this, 'collectionPath', getPath(mustachePath, location));
    } else if (data && data['_collectionPath']) {
      ObjectHelper.createHiddenProperty(this, 'collectionPath', data['_collectionPath']);
    }

    if (data && data['updateDate'] && typeof (data['updateDate'] as any).toDate === 'function') {
      ObjectHelper.createHiddenProperty(this, 'updateDate', (data['updateDate'] as any).toDate());
    }

    if (data && data['creationDate'] && typeof (data['creationDate'] as any).toDate === 'function') {
      ObjectHelper.createHiddenProperty(this, 'creationDate', (data['creationDate'] as any).toDate());
    }
  }
}
