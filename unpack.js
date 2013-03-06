var expand = require("reducers/expand")
var map = require("reducers/map")
var filter = require("reducers/filter")
var merge = require("reducers/merge")
var concat = require("reducers/concat")

var introspect = require("introspect-reduce")

module.exports = unpackSnapshot

function unpackSnapshot(snapshot) {
    return expand(snapshot, function (snapshot) {
        var allValues = flattenValue(snapshot)
        var ts = snapshot.__lastTimestamp__ || 0

        var actualValues = filter(allValues, isEvent)
        var cleansedValues = cleanse(concat(snapshot, actualValues))

        return map(cleansedValues, function (value) {
            return { eventType: "add", timestamp: ts, value: value }
        })
    })
}

function isEvent(value) {
    return value && value.type && Array.isArray(value.parentId)
}

function cleanse(list) {
    return map(list, function (item) {
        return Object.keys(item).reduce(function (acc, key) {
            var value = item[key]

            if (!Array.isArray(value)) {
                acc[key] = value
            } else if (!value.some(isEvent)) {
                acc[key] = value
            }

            return acc
        }, {})
    })
}

function flattenValue(value) {
    var keys = Object.keys(value)
    var values = map(keys, function (key) { return value[key] })
    return concat(value, flattenArrays(values))
}

function isObject(x) {
    return typeof x === "object" && x !== null
}

function flattenArrays(arr) {
    return expand(arr, function (value) {
        if (Array.isArray(value)) {
            return flattenArrays(value)
        } else if (isObject(value)) {
            return flattenValue(value)
        } else {
            return value
        }
    })
}
