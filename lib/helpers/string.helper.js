"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function mustache(str, data) {
    if (data === void 0) { data = {}; }
    return Object.entries(data)
        .reduce(function (res, _a) {
        var key = _a[0], valueToReplace = _a[1];
        return res.replace(new RegExp("{\\s*" + key + "\\s*}", 'g'), valueToReplace);
    }, str);
}
exports.mustache = mustache;
