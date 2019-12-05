/**
 * Defines the decorated property as enumarable or not depending on value parameter.
 *
 * @param value value of enumerable descriptor of property.
 */
export function Enumerable(value: boolean) {
  return function (target: any, propertyKey: string) {
    const descriptor = Object.getOwnPropertyDescriptor(target, propertyKey) || {};
    if (descriptor.enumerable !== value) {
      descriptor.enumerable = value;
      descriptor.writable = true;
      Object.defineProperty(target, propertyKey, descriptor);
    }
  };
}
