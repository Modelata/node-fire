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
  if (path.split('{').length > 1) {
    // TODO: Return missing ids
    throw new Error('some collectionIds missing !!!!');
  }
  if (realLocation.id) {
    path += `${path.endsWith('/') ? '' : '/'}${realLocation.id}`;
  }
  return path;
}

/**
 * Returns true if the document path is in the same format as the collection path (meaning the document is from this kind of collection)
 * or false if it doesn't
 * @param collectionPath Collection path
 * @param docPath Document path
 */
export function isCompatiblePath(collectionPath: string, docPath: string): boolean {
  if (collectionPath) {
    const docPathSplitted = docPath.split('/');
    const collectionPathSplitted = collectionPath.split('/');
    if (docPathSplitted[0] === '') {
      docPathSplitted.shift();
    }
    if (docPathSplitted[docPathSplitted.length - 1] === '') {
      docPathSplitted.pop();
    }
    if (collectionPathSplitted[0] === '') {
      collectionPathSplitted.shift();
    }
    if (collectionPathSplitted[collectionPathSplitted.length - 1] === '') {
      collectionPathSplitted.pop();
    }
    if (collectionPathSplitted.length < docPathSplitted.length - 1 || collectionPathSplitted.length > docPathSplitted.length) {
      return false;
    }
    return collectionPathSplitted.every((path, index) => {
      return docPathSplitted[index] && (path.startsWith('{') || docPathSplitted[index] === path);
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
