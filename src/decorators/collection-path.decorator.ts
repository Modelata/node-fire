import 'reflect-metadata';

/**
 * Sets mustachePath attribute of the targetted DAO
 *
 * @param path collection path with mustache ids (e.g. collection/{collection}/subcollection)
 */
export function CollectionPath(path: string): any {
  return (target: Object) => {
    Reflect.defineMetadata('mustachePath', path, target);
  };
}
