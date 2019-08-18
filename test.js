const ss = require('./steem-interface');

start();

async function start() { 
	ss.init();
	ss.steem_engine.stream(process_op);
}

async function process_op(op, ssc_block_num, ssc_block_time, block_num, block_id, prev_block_id, payload, events) {
	console.log(block_id);
}