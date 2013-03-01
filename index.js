var incrementalMapReduce = require("incremental-map-reduce")

snapshotReduce.reduce = reduce
snapshotReduce.map = map

module.exports = snapshotReduce

function snapshotReduce(snapshot, opts) {
    var inputCollection = opts.inputCollection
    var outputCollection = opts.outputCollection
    var outputCollectionName = opts.outputName ||
        "snapshot." + snapshot

    var result = incrementalMapReduce(inputCollection, {
        map: map
        , reduce: reduce
        , reducedCollection: outputCollection
        , options: {
            out: {
                reduce: outputCollectionName
            }
            , query: {
                "value.type": new RegExp("^" + snapshot)
            }
            , finalize: finalize
        }
        , timestampPath: "timestamp"
        , lastTimestampPath: "__lastTimestamp__"
    })

    return result
}

/*global emit*/
function map() {
    function handleAdd() {
        if (parts.length === 1) {
            value.__lastTimestamp__ = doc.timestamp
            emit(value.id, value)
        } else if (parts.length === 2) {
            var prop = parts[1]
            var result = {
                __lastTimestamp__: doc.timestamp
            }
            var key = value.parentId[0]

            result[prop] = [value]
            emit(key, result)
        }
    }

    function handleRemove() {
        if (parts.length === 1) {
            emit(value.id, {
                id: value.id
                , __lastTimestamp__: doc.timestamp
                , __deleted__: true
            })
        } else if (parts.length === 2) {
            var prop = parts[1]
            var result = {
                __lastTimestamp__: doc.timestamp
            }
            var key = value.parentId[0]

            result[prop] = [{
                id: value.id
                , __deleted__: true
            }]
            emit(key, result)
        }
    }

    var doc = this
    var value = doc.value
    var type = value.type
    var parts = type.split("~")
    var eventType = doc.eventType

    if (eventType === "add") {
        handleAdd()
    } else if (eventType === "remove") {
        handleRemove()
    }
}

function reduce(key, values) {
    function find(arr, id) {
        for (var i = 0; i < arr.length; i++) {
            var item = arr[i]
            if (item.id === id) {
                return i
            }
        }

        return null
    }

    function mergeArrays(target, source) {
        source.forEach(function (value) {
            var index = find(target, value.id)

            if (index === null) {
                target.push(value)
            } else {
                target[index] = merge(target[index], value)
            }
        })

        return target
    }

    function isObject(value) {
        return typeof value === "object" && value !== null
    }

    function merge(target, source) {
        if (typeof source !== "object" || source === null) {
            return source
        }

        for (var key in source) {
            var sourceValue = source[key]
            var targetValue = target[key]

            target[key] = mergeValues(targetValue, sourceValue)
        }

        return target
    }

    function mergeValues(targetValue, sourceValue) {
        var result

        if (targetValue === undefined) {
            result = sourceValue
        } else if (Array.isArray(sourceValue)) {
            if (!Array.isArray(targetValue)) {
                targetValue = []
            }

            result = mergeArrays(targetValue.slice(), sourceValue)
        } else if (isObject(sourceValue) && isObject(targetValue)) {
            result = merge(targetValue, sourceValue)
        } else {
            result = sourceValue
        }

        return result
    }

    var result = {}
    var lastTimestamp = 0

    values.forEach(function (v) {
        if (v.__lastTimestamp__ > lastTimestamp) {
            lastTimestamp = v.__lastTimestamp__
        }

        result = merge(result, v)
    })

    result.__lastTimestamp__ = lastTimestamp

    return result
}

function finalize(key, value) {
    function isNotDeleted(v) {
        return !v.__deleted__
    }

    function byTimestamp(a, b) {
        if (!("timestamp" in a) && !("timestamp" in b)) {
            return 0
        }

        return a.timestamp < b.timestamp ? -1 : 1
    }

    function cleanse(data) {
        var res = {}

        if (typeof data !== "object" || data === null) {
            return data
        }

        for (var key in data) {
            var value = data[key]

            if (value.__deleted__) {
                continue
            }

            if (Array.isArray(value)) {
                res[key] = value.
                    filter(isNotDeleted).
                    map(cleanse).
                    sort(byTimestamp)
            } else if (typeof value === "object" && value !== null) {
                res[key] = cleanse(value)
            } else {
                res[key] = value
            }
        }

        return res
    }

    return cleanse(value)
}
