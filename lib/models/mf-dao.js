"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var firestore_1 = require("@google-cloud/firestore");
require("reflect-metadata");
var model_helper_1 = require("../helpers/model.helper");
var MFDao = /** @class */ (function () {
    function MFDao() {
        this.collectionPath = Reflect.getMetadata('collectionPath', this.constructor);
    }
    MFDao.prototype.getNewModel = function (data, location) {
        throw new Error('Method not implemented.');
    };
    MFDao.prototype.getReference = function (location) {
        throw new Error('Method not implemented.');
    };
    MFDao.prototype.getById = function (location, options) {
        throw new Error('Method not implemented.');
    };
    MFDao.prototype.getByReference = function (reference, options) {
        var _this = this;
        // TODO: Handle cache !
        if (reference) {
            if (this.isCompatible(reference)) {
                return reference.get()
                    .then(function (snapshot) { return _this.getModelFromSnapshot(snapshot); });
            }
            throw new Error('reference is not compatible with this dao!');
        }
        else {
            throw new Error('getByReference missing parameter : reference');
        }
    };
    MFDao.prototype.getByPath = function (path, options) {
        throw new Error('Method not implemented.');
    };
    MFDao.prototype.getList = function (location, options) {
        throw new Error('Method not implemented.');
    };
    MFDao.prototype.create = function (data, location, options) {
        throw new Error('Method not implemented.');
    };
    MFDao.prototype.update = function (data, location, options) {
        throw new Error('Method not implemented.');
    };
    MFDao.prototype.delete = function (id) {
        throw new Error('Method not implemented.');
    };
    MFDao.prototype.getModelFromSnapshot = function (snapshot) {
        if (snapshot.exists) {
            var pathIds = {};
            var pathSplitted = snapshot.ref.path.split('/');
            if (pathSplitted.length > 2) {
                for (var i = 1; i < pathSplitted.length; i += 2) {
                    // take every second element
                    pathIds[pathSplitted[i - 1]] = pathSplitted[i];
                }
            }
            var model = this.getNewModel(snapshot.data(), __assign({ id: snapshot.id }, pathIds));
            return model;
        }
        console.error('[firestoreDao] - getNewModelFromDb return null because dbObj.exists is null or false. dbObj :', snapshot);
        return null;
    };
    MFDao.prototype.getSnapshotFromId = function (id) {
        throw new Error('Method not implemented.');
    };
    MFDao.prototype.beforeSave = function (model) {
        throw new Error('Method not implemented.');
    };
    MFDao.prototype.saveFile = function (fileObject, location) {
        throw new Error('Method not implemented.');
    };
    MFDao.prototype.isCompatible = function (doc) {
        return model_helper_1.isCompatiblePath(this.collectionPath, doc instanceof firestore_1.DocumentReference ? doc.path : doc._collectionPath);
    };
    return MFDao;
}());
exports.MFDao = MFDao;
