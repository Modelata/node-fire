import {
  getPath,
  Enumerable,
  MissingFieldNotifier,
  createHiddenProperty,
  IMFModel,
  IMFLocation
} from '@modelata/fire/lib/node';

export abstract class MFModel<M> implements IMFModel<M> {
  /**
   * @inheritdoc
   */
  @Enumerable(false)
    _snapshot: FirebaseFirestore.DocumentSnapshot = null;

  /**
   * @inheritdoc
   */
  @Enumerable(false)
    _id: string = null;

  /**
   * @inheritdoc
   */
  @Enumerable(false)
    _collectionPath: string = null;

  /**
   * @inheritdoc
   */
  @Enumerable(false)
    creationDate: Date = null;

  /**
   * @inheritdoc
   */
  @Enumerable(false) updateDate: Date = null;


  /**
   * @inheritdoc
   */
  @Enumerable(false)
    deleted = false;

  /**
   * @inheritdoc
   *
   * @param data
   * @param mustachePath
   * @param location
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
          // eslint-disable-next-line no-prototype-builtins
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
