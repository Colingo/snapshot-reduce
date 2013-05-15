# snapshot-reduce

[![build status][1]][2] [![dependency status][3]][4]

<!-- [![browser support][5]][6] -->

Incrementally reduce an event-log into a snapshot view of those events

The idea is that you store all your raw data as a massive log of
append only events, i.e. you never update or delete anything.

Then you use snapshot-reduce to reduce the event log into a
    coherent snapshot of a subset of current state.

## Example

Snapshot reduce allows you to accumulate a subset of a event log
    into a snapshot representation of that data. The actual
    mapReduce is based on mongoDB and is incremental.

```js
var snapshotReduce = require("snapshot-reduce")
var mongo = require("continuable-mongo")

// Get a mongoDB instance however you want or use continuable-mongo
var db = mongo("mongodb://localhost:27017/my-database")
var inputCollection = db.collection("event-log")
var outputCollection = db.collection("snapshot.my-thing")

var command = snapshotReduce("my-thing", {
    inputCollection: inputCollection
    , outputCollection: outputCollection
}, function (err, res) {
    /* ... */
})
```

For this to work you must adhere to some constraints of the
    event-log input. For example if your input is:

```js
{
    "eventType" : "add"
    , "timestamp" : 1360877429848
    , "value" : {
        "title" : "some room"
        , "type" : "colingo-room"
        , "id" : "1"
    }
}
```

This is a message that says "a room was added". You may have
    another message like

```js
{
    "eventType" : "add"
    , "timestamp" : 1360878425642
    , "value" : {
        "name" : "Jake"
        , "message" : "test"
        , "type" : "colingo-room~messages"
        , "parentId" : [ "1" ]
        , "id" : "3dedc0cc-917b-48ed-a3c9-6166011fb458"
    }
}
```

Which says a message was added to a room. The room it was added
    to was the room with id `"1"`

All inputs should have inline `type`, `id` and `timestamp` fields.
    The `type` is used to query a subset of the event-log to
    map reduce. The `timestamp` field is used to support
    incremental map reduce, i.e. it will only reduce values that
    have a timestamp higher then the last one from last time.

The two events above would be reduced to

```js
{
    title: "some room"
    , id: "1"
    , type: "colingo-room"
    , messages: [{
        name: "Jake"
        , message: "test"
        , id: "3dedc0cc-917b-48ed-a3c9-6166011fb458"
        , type: "colingo-room~messages"
        , parentId: ["1"]
    }]
    , __lastTimestamp__: 1360878425642
}
```

The `__lastTimestamp__` field is used to do an incremental map
    reduce and basically allows snapshot-reduce to reduce the
    entire history of the event log again.

### Unpacking snapshots.

You can also do the reverse, turn a snapshot into the minimal
    amount of raw events needed to construct that snapshot

```js
var unpackSnapshot = require("snapshot-reduce/unpack")
var assert = require("assert")

var list = unpackSnapshot({
    id: "1"
    , type: "x"
    , foos: [{
        id: "2"
        , type: "x~foos"
        , parentId: ["1"]
    }]
})

assert.deepEqual(list, [{
    eventType: "add"
    , timestamp: 0
    , value: {
        id: "1"
        , type: "x"
    }
}, {
    eventType: "add"
    , timestamp: 0
    , value: {
        id: "2"
        , type: "x~foos"
        , parentId: ["1"]
    }
}])
```

## Installation

`npm install snapshot-reduce`

## Contributors

 - Raynos

## MIT Licenced

  [1]: https://secure.travis-ci.org/Colingo/snapshot-reduce.png
  [2]: http://travis-ci.org/Colingo/snapshot-reduce
  [3]: http://david-dm.org/Colingo/snapshot-reduce/status.png
  [4]: http://david-dm.org/Colingo/snapshot-reduce
  [5]: http://ci.testling.com/Colingo/snapshot-reduce.png
  [6]: http://ci.testling.com/Colingo/snapshot-reduce
