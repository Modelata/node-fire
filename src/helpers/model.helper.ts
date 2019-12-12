import { IMFLocation, mustache } from '@modelata/fire/lib/node';
import { MFModel } from '../mf-model';

/**
 * Returns the path from a collection mustache path ad a location object.
 *
 * @param mustachePath Collection mustache path
 * @param idOrLocation id or Location object containin path ids and document id or not.
 * @returns The path filled with ids
 */
export function getPath(mustachePath: string, idOrLocation?: string | Partial<IMFLocation>): string {
  const realLocation = getLocation(idOrLocation, mustachePath);

  if (!(mustachePath && mustachePath.length)) {
    throw new Error('mustachePath must be defined');
  }
  let path = mustache(mustachePath, realLocation);
  if (path.includes('{')) {
    const missingIdRegex = /{(.*?)}/g;
    const missingIds: string[] = [];
    let missingId;
    while ((missingId = missingIdRegex.exec(path)) !== null) {
      missingIds.push(missingId[1]);
    }
    throw new Error(`collectionIds ${missingIds.join(', ')} missing !!!!`);
  }
  if (realLocation.id) {
    path += `${path.endsWith('/') ? '' : '/'}${realLocation.id}`;
  }
  return path;
}

/**
 * Returns true if the document path is in the same format as the collection path (meaning the document is from this kind of collection)
 * or false if it doesn't
 *
 * @param mustachePath Collection path
 * @param refPath Document path
 */
export function isCompatiblePath(mustachePath: string, refPath: string): boolean {
  if (mustachePath) {
    const { pathSplitted, mustachePathSplitted } = getSplittedPath(refPath, mustachePath);


    if (mustachePathSplitted.length < pathSplitted.length - 1 || mustachePathSplitted.length > pathSplitted.length) {
      return false;
    }
    return mustachePathSplitted.every((path, index) => {
      return pathSplitted[index] && (path.startsWith('{') || pathSplitted[index] === path);
    });
  }
  return false;

}

/**
 * Return a location object from either unvalued, string id, location object or model
 *
 * @param idOrLocationOrModel string id or location object
 * @returns The location built from params
 */
export function getLocation(idOrLocationOrModel: string | Partial<IMFLocation> | MFModel<any>, mustachePath: string): Partial<IMFLocation> {
  if (idOrLocationOrModel) {
    if (typeof idOrLocationOrModel === 'string') {
      return { id: idOrLocationOrModel };
    }
    if (idOrLocationOrModel.hasOwnProperty('_collectionPath')) {
      return getLocationFromPath(idOrLocationOrModel._collectionPath, mustachePath, idOrLocationOrModel._id) as IMFLocation;
    }

    return idOrLocationOrModel as Partial<IMFLocation>;
  }
  return {};
}

/**
 * Returns a location object from path and mustache path
 * @param path the path to convert to a location
 * @param mustachePath the collectionPath with mustache ids
 * @param id document id
 * @returns The location object built from params
 */
export function getLocationFromPath(path: string, mustachePath: string, id?: string): Partial<IMFLocation> {
  if (path && mustachePath) {
    const { pathSplitted, mustachePathSplitted } = getSplittedPath(path, mustachePath);

    return mustachePathSplitted.reduce(
      (location: Partial<IMFLocation>, partOfMustachePath: string, index: number) => {
        if (partOfMustachePath.startsWith('{')) {
          location[partOfMustachePath.slice(1, -1)] = pathSplitted[index];
        }
        return location;
      },
      {
        id
      });
  }
  return {};
}

/**
 * Returns arrays of elements constituting model path and mustache path
 *
 * @param path Model path
 * @param mustachePath Dao mustache path
 * @returns an object containing the path splitted and the mustache path splitted too
 */
export function getSplittedPath(path: String, mustachePath: string): {
  pathSplitted: string[],
  mustachePathSplitted: string[],
} {
  const pathSplitted = path.split('/');
  const mustachePathSplitted = mustachePath.split('/');
  if (pathSplitted[0] === '') {
    pathSplitted.shift();
  }
  if (pathSplitted[pathSplitted.length - 1] === '') {
    pathSplitted.pop();
  }
  if (mustachePathSplitted[0] === '') {
    mustachePathSplitted.shift();
  }
  if (mustachePathSplitted[mustachePathSplitted.length - 1] === '') {
    mustachePathSplitted.pop();
  }

  return {
    pathSplitted,
    mustachePathSplitted,
  };
}

/**
 * Returns true if every property of data exists in model. Else, returns false
 *
 * @param data Data that will be checked
 * @param model Model in wich data must fit
 * @param logInexistingData Optional: display log for property missing in model (default is true)
 */
export function allDataExistInModel<M>(data: Partial<M>, model: M, logInexistingData: boolean = true): boolean {
  for (const key in data) {
    if (!model.hasOwnProperty(key)) {
      if (logInexistingData) {
        console.error(`try to update/add an attribute that is not defined in the model = ${key}`);
      }
      return false;
    }
  }
  return true;
}

/**
 * method used to prepare the data for save
 *
 * @param modelObj the data to save
 * @returns the object cleaned from properties and methods that will not be saved in database
 */
export function getSavableData<M>(modelObj: M): Partial<M> {
  return Object.keys(modelObj)
    .filter(key =>
      !(key as string).startsWith('_') &&
      typeof modelObj[(key as keyof M)] !== 'undefined' &&
      typeof modelObj[(key as keyof M)] !== 'function'
    )
    .reduce(
      (dbObj: Partial<M>, keyp) => {
        const key: keyof M = keyp as keyof M;
        if (modelObj[key] && modelObj[key].constructor.name === 'Object') {
          (dbObj[key] as any) = getSavableData<any>(modelObj[key]);
        } else {
          dbObj[key] = modelObj[key];
        }
        return dbObj;
      },
      {}
    );
}

/**
 * returns list of file(s) properties
 *
 * @param model The model object
 * @return array of file properties names
 */
export function getFileProperties(model: Object): string[] {
  return Object.keys(model).filter((key) => {
    return Reflect.hasMetadata('storageProperty', model as Object, key);
  });
}
