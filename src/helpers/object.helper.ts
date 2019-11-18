/**
 * Adds an hidden property to object. Hidden property name will start with an underscore.
 * @param obj Object to which add an hidden property
 * @param propName Name of the property (without underscore)
 * @param propVal Value of the hidden property
 */
export function createHiddenProperty(obj: Object, propName: string, propVal: any) {
  if (obj) {
    const hiddenPropName = `_${propName}`;
    if (obj.hasOwnProperty(hiddenPropName)) {
      (obj as any)[hiddenPropName] = propVal;
    } else {
      Object.defineProperty(obj, hiddenPropName, {
        value: propVal,
        enumerable: false,
        configurable: true,
        writable: true
      });
    }
  } else {
    console.error('you must define an object to set it an hidden property');
  }
}
