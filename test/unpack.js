var test = require("tape")
var uuid = require("node-uuid")
var into = require("reducers/into")

var unpackSnapshot = require("../unpack")

test("can merge snapshot and raw data", function (assert) {
    var groupId = uuid()
    var memberOne = uuid()
    var memberTwo = uuid()
    var ts = Date.now()

    var snapshot = {
        title: "a"
        , id: groupId
        , type: "colingo-group"
        , timestamp: ts
        , members: [{
            name: "b"
            , id: memberOne
            , type: "colingo-group~members"
            , imageUri: "b"
            , parentId: [groupId]
            , timestamp: ts
        }, {
            name: "c"
            , id: memberTwo
            , type: "colingo-group~members"
            , imageUri: "c"
            , parentId: [groupId]
            , timestamp: ts
        }]
    }

    var list = unpackSnapshot(snapshot)

    assert.deepEqual(into(list), [{
        eventType: "add"
        , value: {
            title: "a"
            , id: groupId
            , type: "colingo-group"
            , timestamp: ts
        }
    }, {
        eventType: "add"
        , value: {
            name: "b"
            , id: memberOne
            , type: "colingo-group~members"
            , imageUri: "b"
            , parentId: [groupId]
            , timestamp: ts
        }
    }, {
        eventType: "add"
        , value: {
            name: "c"
            , id: memberTwo
            , type: "colingo-group~members"
            , imageUri: "c"
            , parentId: [groupId]
            , timestamp: ts
        }
    }])

    assert.end()
})
