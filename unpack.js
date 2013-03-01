var expand = require("reducers/expand")
var map = require("reducers/map")
var filter = require("reducers/filter")
var merge = require("reducers/merge")

module.exports = unpackSnapshot

function unpackSnapshot(snapshot) {
    return expand(snapshot, function (snapshot) {
        var keys = Object.keys(snapshot)
        var values = map(keys, function (key) { return snapshot[key] })
        var allValues = flattenArrays(values)
        var ts = snapshot.__lastTimestamp__ || 0

        var actualValues = filter(allValues, isEvent)

        return map(cleanse(merge([snapshot, actualValues])), function (value) {
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

function flattenArrays(arr) {
    return expand(arr, function (value) {
        return Array.isArray(value) ? flattenArrays(value) : value
    })
}
