import { IMFLocation } from '@modelata/types-fire/lib/node';
import { mustache } from './string.helper';

export function getPath(collectionPath: string, location?: string | Partial<IMFLocation>): string {
  if (!location) {
    location = {};
  } else if (typeof location === 'string') {
    location = { id: location };
  }
  if (!(collectionPath && collectionPath.length)) {
    throw new Error('collectionPath must be defined');
  }
  let path = mustache(collectionPath, location);
  if (path.split('{').length > 1) {
    // TODO: Return missing ids
    throw new Error('some collectionIds missing !!!!');
  }
  if (location.id) {
    path += `${path.endsWith('/') ? '' : '/'}${location.id}`;
  }
  return path;
}

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

