"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var missing_field_notifier_1 = require("../helpers/missing-field-notifier");
var object_helper_1 = require("../helpers/object.helper");
var MFModel = /** @class */ (function () {
    function MFModel() {
    }
    MFModel.prototype.initialize = function (data, location) {
        if (data) {
            for (var key in data) {
                if (!key.startsWith('_') && !key.startsWith('$') && typeof data[key] !== 'function') {
                    if (this.hasOwnProperty(key)) {
                        if (data[key] && typeof data[key].toDate === 'function') {
                            this[key] = data[key].toDate();
                        }
                        else {
                            this[key] = data[key];
                        }
                    }
                    else {
                        missing_field_notifier_1.MissingFieldNotifier.notifyMissingField(this.constructor.name, key);
                    }
                }
            }
        }
        if (location.id) {
            object_helper_1.ObjectHelper.createHiddenProperty(this, 'id', location.id);
        }
        else if (data && data['_id']) {
            object_helper_1.ObjectHelper.createHiddenProperty(this, 'id', data['_id']);
        }
        if (data
            && data['_collectionPath']
            && !data['_collectionPath'].includes('?')
            && (!path || !pathIds || pathIds.length === 0)) {
            object_helper_1.ObjectHelper.createHiddenProperty(this, 'collectionPath', data['_collectionPath']);
        }
        else if (path) {
            object_helper_1.ObjectHelper.createHiddenProperty(this, 'collectionPath', ModelHelper.getPath(path, pathIds));
        }
        else if (data && data['_collectionPath']) {
            object_helper_1.ObjectHelper.createHiddenProperty(this, 'collectionPath', data['_collectionPath']);
        }
        if (data && data['_fromCache']) {
            object_helper_1.ObjectHelper.createHiddenProperty(this, 'fromCache', data['_fromCache']);
        }
        if (data && data['_updateDate'] && typeof data['_updateDate'].toDate === 'function') {
            object_helper_1.ObjectHelper.createHiddenProperty(this, 'updateDate', data['_updateDate'].toDate());
        }
    };
    return MFModel;
}());
exports.MFModel = MFModel;
