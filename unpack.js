module.exports = unpackSnapshot

function unpackSnapshot(snapshot) {
    var allValues = flattenValue(snapshot)
    var ts = snapshot.__lastTimestamp__ || 0

    var actualValues = allValues.filter(isEvent)
    var cleansedValues = cleanse([snapshot].concat(actualValues))

    return cleansedValues.map(function (value) {
        return { eventType: "add", timestamp: ts, value: value }
    })
}

function isEvent(value) {
    return value && value.type && Array.isArray(value.parentId)
}

function cleanse(list) {
    return list.map(function (item) {
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
    var values = keys.map(function (key) { return value[key] })
    return [value].concat(flattenArrays(values))
}

function isObject(x) {
    return typeof x === "object" && x !== null
}

function flattenArrays(arr) {
    return flatten(arr.map(function (value) {
        if (Array.isArray(value)) {
            return flattenArrays(value)
        } else if (isObject(value)) {
            return flattenValue(value)
        } else {
            return [value]
        }
    }))
}

// flatten := (list:Array<Array<T>>) => Array<T>
function flatten(list) {
    return [].concat.apply([], list)
}
