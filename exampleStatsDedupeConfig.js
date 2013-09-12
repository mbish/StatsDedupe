
{
    port: 8200,
    mgmt_port: 8201,
    backends: ['./backends/console', './backends/statsdedupe'],
    statsdedupe: {
    	realtime: false,
    },
    debug: true
}
