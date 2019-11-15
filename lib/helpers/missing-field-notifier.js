"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var MissingFieldNotifier = /** @class */ (function () {
    function MissingFieldNotifier() {
    }
    MissingFieldNotifier.notifyMissingField = function (clazz, field) {
        if (!MissingFieldNotifier.notifiedFields.find(function (notifiedField) { return notifiedField.clazz === clazz && notifiedField.field === field; })) {
            console.warn("property " + field + " does not exist in class " + clazz + " => consider to add it in \"models-lib\"");
            MissingFieldNotifier.notifiedFields.push({ clazz: clazz, field: field });
        }
    };
    MissingFieldNotifier.notifiedFields = [];
    return MissingFieldNotifier;
}());
exports.MissingFieldNotifier = MissingFieldNotifier;
