import 'reflect-metadata';
import { IMFStorageOptions } from '@modelata/types-fire/lib/node';

export function StorageProperty(options: IMFStorageOptions): any {
  return (target: any, propertyKey: string) => {
    Reflect.defineMetadata(
      'storageProperty',
      options,
      target,
      propertyKey
    );
  };
}
