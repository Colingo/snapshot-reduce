var incrementalMapReduce = require("incremental-map-reduce")

snapshotReduce.reduce = reduce
snapshotReduce.map = map

module.exports = snapshotReduce

function snapshotReduce(snapshot, opts, callback) {
    var inputCollection = opts.inputCollection
    var outputCollection = opts.outputCollection
    var outputCollectionName = opts.outputName ||
        "snapshot." + snapshot

    incrementalMapReduce(inputCollection, {
        map: map,
        reduce: reduce,
        reducedCollection: outputCollection,
        options: {
            out: {
                reduce: outputCollectionName
            },
            query: {
                "value.type": new RegExp("^" + snapshot)
            },
            finalize: finalize
        },
        timestampPath: "timestamp",
        lastTimestampPath: "__lastTimestamp__"
    }, callback)
}

/*global emit*/
function map() {
    var _emit = typeof emit !== "undefined" ? emit : function () {}

    function handleAdd(eventType) {
        if (eventType === "modify") {
            value.__modified__ = true
        }

        var result, key

        if (parts.length === 1) {
            value.__lastTimestamp__ = doc.timestamp
            _emit(value.id, value)
            return [value.id, value]
        } else if (parts.length === 2) {
            var prop = parts[1]
            key = value.parentId[0]
            result = {
                id: key,
                __lastTimestamp__: doc.timestamp
            }

            result[prop] = [value]
            _emit(key, result)
            return [key, result]
        } else if (parts.length > 2) {
            var paths = parts.slice(1)
            var keys = value.parentId.slice(1)
            result = {
                __lastTimestamp__: doc.timestamp
            }
            key = value.parentId[0]

            var parent = result

            for (var i = 0; i < paths.length; i++) {
                var path = paths[i]
                var item = i === paths.length - 1 ?
                    value : { id: keys[i] }
                parent[path] = [item]
                parent = item
            }

            _emit(key, result)
            return [key, result]
        }
    }

    function handleRemove() {
        var result, key

        if (parts.length === 1) {
            key = value.id
            result = {
                id: value.id,
                __lastTimestamp__: doc.timestamp,
                __deleted__: true
            }

            emit(key, result)
            return [key, result]
        } else if (parts.length === 2) {
            var prop = parts[1]
            result = {
                __lastTimestamp__: doc.timestamp
            }
            key = value.parentId[0]

            result[prop] = [{
                id: value.id,
                __deleted__: true
            }]
            _emit(key, result)
            return [key, result]
        }
    }

    var doc = this
    var value = doc.value
    var type = value.type
    var parts = type.split("~")
    var eventType = doc.eventType

    if (eventType === "add") {
        return handleAdd()
    } else if (eventType === "remove") {
        return handleRemove()
    } else if (eventType === "modify") {
        return handleAdd("modify")
    }
}

function reduce(_, values) {
    function clone(obj) {
        var res = {}

        for (var key in obj) {
            res[key] = obj[key]
        }

        return res
    }

    function isArray(x) {
        return x !== null &&
            x !== undefined &&
            x.constructor === Array
    }

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

            if (index === null && !value.__modified__) {
                target.push(value)
            } else if (index !== null) {
                delete value.__modified__
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

        var res = clone(target)

        for (var key in source) {
            var sourceValue = source[key]
            var targetValue = target[key]

            // if we have a target or the sourceValue is not modified
            if (targetValue || !sourceValue.__modified__) {
                res[key] = mergeValues(targetValue, sourceValue)
            }
        }

        return res
    }

    function mergeValues(targetValue, sourceValue) {
        var result

        if (targetValue === undefined && !sourceValue.__modified__) {
            result = sourceValue
        } else if (isArray(sourceValue)) {
            if (!isArray(targetValue)) {
                targetValue = []
            }

            result = mergeArrays(targetValue.slice(), sourceValue)
        } else if (isObject(sourceValue) && isObject(targetValue)) {
            delete sourceValue.__modified__
            result = merge(targetValue, sourceValue)
        } else {
            result = sourceValue
        }

        return result
    }

    var result = {}
    var lastTimestamp = 0

    values.forEach(function (valueInReduce) {
        if (valueInReduce.__lastTimestamp__ > lastTimestamp) {
            lastTimestamp = valueInReduce.__lastTimestamp__
        }

        result = merge(result, valueInReduce)
    })

    result.__lastTimestamp__ = lastTimestamp

    return result
}

function finalize(key, value) {
    function isNotDeleted(v) {
        return v === null || v === undefined || !v.__deleted__
    }

    function isObject(x) {
        return typeof x === "object" && x !== null
    }

    function isArray(x) {
        return x !== null &&
            x !== undefined &&
            x.constructor === Array
    }

    function byTimestamp(a, b) {
        if (!isObject(a) || !isObject(b)) {
            return 0
        }

        if (!("createdAt" in a) && !("createdAt" in b)) {
            return 0
        }

        if (a.createdAt === b.createdAt) {
            return 0
        } else if (a.createdAt < b.createdAt) {
            return -1
        } else if (a.createdAt > b.createdAt) {
            return 1
        } else {
            return 0
        }
    }

    function cleanse(data) {
        var res = {}

        if (!isObject(data)) {
            return data
        }

        for (var key in data) {
            var value = data[key]

            if (value !== null && value !== undefined && value.__deleted__) {
                continue
            }

            if (isArray(value)) {
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
