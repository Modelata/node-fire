import 'reflect-metadata';

/**
 * Sets userCollectionPath attribute of the targetted AuthDAO
 *
 * @param path user collection path
 */
export function UsersCollectionPath(path: string): any {
  return (target: Object) => {
    Reflect.defineMetadata('usersCollectionPath', path, target);
  };
}
