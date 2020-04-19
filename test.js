const ss = require('./steem-interface');

start();

async function start() { 
	ss.init();

	// This should throw an error due to invalid key
	ss.custom_json('test', { test: 'test' }, 'test', 'abc123')
	.then(console.log)
	.catch(e => console.log(`Error: ${e}`));

	//ss.stream({
	//	on_op: on_op,
	//	wait_blocks: 2
	//});
}

async function process_op(op, ssc_block_num, ssc_block_time, block_num, block_id, prev_block_id, payload, events) {
	console.log(block_id);
}

async function process_block(block_num, block) {
	console.log(block_num);
}

async function on_op(op, block_num, block_id, previous, trx_id, block_time) {
	console.log(op);
}