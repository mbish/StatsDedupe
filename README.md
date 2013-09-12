StatsDedupe
===========

A backend for statsd that aggregates and ages out set data based on arbitrary time limits

The syntax for the age of a set value is

`key:value|s|#age`
OR
`key:value|s|@sampe-rate|#age`

e.g.
`active\_users:joe-bob|s|#1m`

This backend collects all set data but keeps each value for the specified time
Ever flush interval it then reports the size of each set as a gague to a given list of backends
(it's parent statsd server by default).

Aging Specifics
---------------

The set data is kept for the amount of time specified by the MOST RECENT packet so
if you need to expire a key immediately you can just send out
key:value|s|#0

Valid units on the end of the time are
* Milliseconds - ms (default)
* Seconds - s
* Minutes - m
* Hours - h
* Days - d

Configuration
-------------

The statsdedupe key can take the following keys

`realtime: <bool>` (default false)
this specifies weather a packet should be sent out immediately when a new key is added to a set or if it's alright to wait until the flush interval. If this is false then set sizes timestamps will be skewed right by about 1 flush interval

`hosts: [{host: <address>, port: <port>},...]`	(defaults to parent statsd)
this specifies the statsd hosts statsdedupe should send data to.

Output
------

Each set size is output as a simple gague with the same key name as the set
`key:set\_size|g`

Installation
------------

 * Put statsdedupe.js into your backend folder for statsd and priority\_queue.js in your statsd library directory
 * Configure the statsdedupe backend
 * Start the statsd daemon:

    `node stats.js /path/to/config`


Thanks
------
This project was largely inspired by the [Gossip Girl](https://github.com/wanelo/gossip_girl) backend and uses [priority queue code](https://github.com/STRd6/PriorityQueue.js) from Daniel Moore
