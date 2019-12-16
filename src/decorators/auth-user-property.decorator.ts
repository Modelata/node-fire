import 'reflect-metadata';
import { IMFStorageOptions } from '@modelata/fire/lib/node';

/**
 * Declares the decorated property as a file property (to upload in storage)
 *
 * @param options (deleteOnDelete, deletePreviousOnUpdate)
 */
export function AuthUserProperty(): any {
  return (target: any, propertyKey: string) => {
    Reflect.defineMetadata(
      'authUserProperty',
      true,
      target,
      propertyKey
    );
  };
}
