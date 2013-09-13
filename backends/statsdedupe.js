var util = require('util'),
    dgram = require('dgram'),
    queue = require('../lib/priority_queue')

function StatsDedupe(startupTime, config, emitter) {
    var self = this
    self.config = config.statsdedupe || {};
    self.statsd_config = config;
    self.metrics = {};
    self.queue = queue.PriorityQueue({low: true});
    self.hosts = config.statsdedupe.hosts || [{
        address: config.address || '127.0.0.1',
        port: config.port || 8125
    }];
    self.default_retention = self.config.default_retention || '60000';
    
    emitter.on('flush', function(time, metrics) { self.flush(time, metrics); });
    emitter.on('packet', function(packet, rinfo) { self.decode(packet, rinfo); });
}

StatsDedupe.prototype.send = function(packet, host, port) {
  var self = this
  self.sock.send(packet, 0, packet.length, port, host, function(err,bytes) {
    if (err) {
      console.log(err)
    }
  })
}

StatsDedupe.prototype.format = function (key, value, suffix) {
  return new Buffer("'" + key + "':" + value + "|" + suffix)
}

StatsDedupe.prototype.flush = function(time, metrics) {
    var self = this
    hosts = self.hosts;
    var stats, packet
    
    self.sock = dgram.createSocket("udp4")
    self.evict();
    for (var i = 0; i < hosts.length; i++) {
        for(key in self.metrics) {
            var set_size = Object.keys(self.metrics[key]).length;
            packet = self.format(key, set_size, "g")
            self.send(packet, hosts[i].host, hosts[i].port)
        }
    }
}

StatsDedupe.prototype.flush_one = function(key) {
    var self = this
    hosts = self.hosts;
    var stats, packet
    self.sock = dgram.createSocket("udp4")
    self.evict();
    for (var i = 0; i < hosts.length; i++) {
        var set_size = Object.keys(self.metrics[key]).length;
        packet = self.format(key, set_size, "g")
        self.send(packet, hosts[i].host, hosts[i].port)
    }
}

StatsDedupe.prototype.evict = function() {
    var self = this;
    var date = new Date();
    var now = date.getTime();
    var update = [];
    while(!self.queue.empty() && self.queue.top().priority < now) {
        var obj = self.queue.pop();
        if(obj.priority >= self.metrics[obj.key][obj.value]) {
            delete self.metrics[obj.key][obj.value];
            update.push(obj.key);
        }
    }
    if(self.config.realtime) {
        for(var change in update) {
            self.flush_one(change);
        }
    }
}

StatsDedupe.prototype.decode = function(msg, rinfo) {
    var self = this;
    var metrics = msg.toString().split("\n");
    var json_metrics;
    var date = new Date();
    var epoch_offset = date.getTime();
    for (var midx in metrics) {
        var bits = metrics[midx].toString().split(':');
        var key = bits.shift()
            .replace(/\s+/g, '_')
            .replace(/\//g, '-')
            .replace(/[^a-zA-Z_\-0-9\.]/g, '');
        for (var i = 0; i < bits.length; i++) {
            var fields = bits[i].split("|")
            if (fields[1] === undefined) {
                continue;
            }
            var suffix = fields[1].trim();
            if (suffix == "s") {
                var value = fields[0] || 0;
                var retention = self.default_retention;
                if(fields[2] !== undefined ) {
                    if(fields[2].match(/^#(\d+)/)) {
                        var matches = fields[2].match(/^#(\d+)(\w*)/);
                        var unit = matches[2] || 'ms';
                        retention = Number(matches[1])*self.unit_to_milliseconds(unit);
                    }
                    else if(fields[3] !== undefined) {
                        var matches = fields[3].match(/^#(\d+)(\w*)/);
                        var unit = matches[2] || 'ms';
                        if(fields[3].match(/^#(\d+)/)) {
                            retention = Number(matches[1])*self.unit_to_milliseconds(unit);
                        }
                    }
                }
                var new_key = false;
                if(!self.metrics[key]) {
                    self.metrics[key] = {};
                }
                if(self.metrics[key][value] == undefined) {
                    new_key = true;
                }
                var expires = epoch_offset + retention;
                self.metrics[key][value] = expires;
                var queue_obj = {
                    "key" : key,
                    "value" : value,
                    "priority" : expires
                };
                self.queue.push(queue_obj, expires);
                if(self.config.realtime && new_key) {
                    self.flush_one(key);
                }
            }
        }
    }
}

StatsDedupe.prototype.unit_to_milliseconds = function(unit) {
    if(unit == undefined) {
        return 1;
    }
    if(unit == "ms") {
        return 1;
    }
    if(unit == "s") {
        return 1000;
    }
    if(unit == "m") {
        return 60 * 1000;
    }
    if(unit == "h") {
        return 60 * 60 * 1000;
    }
    if(unit == "d") {
        return 24 * 60 * 60 * 1000;
    }
}

exports.init = function(startupTime, config, events) {
  var instance = new StatsDedupe(startupTime, config, events)
  return true
}
