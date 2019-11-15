"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var string_helper_1 = require("./string.helper");
function getPath(collectionPath, location) {
    if (location === void 0) { location = {}; }
    if (!(collectionPath && collectionPath.length)) {
        throw new Error('collectionPath must be defined');
    }
    var path = string_helper_1.mustache(collectionPath, location);
    if (path.split('{').length > 1) {
        // TODO: Return missing ids
        throw new Error('some collectionIds missing !!!!');
    }
    if (location.id) {
        path += "" + (path.endsWith('/') ? '' : '/') + location.id;
    }
    return path;
}
exports.getPath = getPath;
function isCompatiblePath(collectionPath, docPath) {
    if (collectionPath) {
        var docPathSplitted_1 = docPath.split('/');
        var collectionPathSplitted = collectionPath.split('/');
        if (docPathSplitted_1[0] === '') {
            docPathSplitted_1.shift();
        }
        if (docPathSplitted_1[docPathSplitted_1.length - 1] === '') {
            docPathSplitted_1.pop();
        }
        if (collectionPathSplitted[0] === '') {
            collectionPathSplitted.shift();
        }
        if (collectionPathSplitted[collectionPathSplitted.length - 1] === '') {
            collectionPathSplitted.pop();
        }
        if (collectionPathSplitted.length < docPathSplitted_1.length - 1 || collectionPathSplitted.length > docPathSplitted_1.length) {
            return false;
        }
        return collectionPathSplitted.every(function (path, index) {
            return docPathSplitted_1[index] && (path.startsWith('{') || docPathSplitted_1[index] === path);
        });
    }
    return false;
}
exports.isCompatiblePath = isCompatiblePath;
