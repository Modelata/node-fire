"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Helper class for Object manipulations
 */
var ObjectHelper = /** @class */ (function () {
    function ObjectHelper() {
    }
    /**
     * creates an hidden property in the given object
     * @param obj the object to create the attribute on
     * @param propName the name of the property
     * @param propVal the value of the property
     */
    ObjectHelper.createHiddenProperty = function (obj, propName, propVal) {
        if (obj) {
            var hiddenPropName = "_" + propName;
            if (obj.hasOwnProperty(hiddenPropName)) {
                obj[hiddenPropName] = propVal;
            }
            else {
                Object.defineProperty(obj, hiddenPropName, {
                    value: propVal,
                    enumerable: false,
                    configurable: true,
                    writable: true
                });
            }
        }
        else {
            console.error('you must define an object to set it an hidden property');
        }
    };
    return ObjectHelper;
}());
exports.ObjectHelper = ObjectHelper;
