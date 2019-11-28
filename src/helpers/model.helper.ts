import { IMFLocation } from '@modelata/types-fire/lib/node';
import { mustache } from './string.helper';

/**
 * Returns the path from a collection mustache path ad a location object.
 * @param collectionPath Collection mustache path
 * @param location Location object containin path ids and document id or not.
 */
export function getPath(collectionPath: string, location?: string | Partial<IMFLocation>): string {
  const realLocation = getLocation(location);

  if (!(collectionPath && collectionPath.length)) {
    throw new Error('collectionPath must be defined');
  }
  let path = mustache(collectionPath, realLocation);
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
 * Return a location object from either unvalued, string id or location object
 * @param location string id or location object
 */
export function getLocation(location?: string | Partial<IMFLocation>): Partial<IMFLocation> {
  if (location) {
    return typeof location === 'string' ?
      { id: location } :
      location;
  }
  return {};
}

/**
 * Return a location object from either unvalued, string id or location object
 * @param location string id or location object
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
  return null;
}

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
* @param modelObj the data to save
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
