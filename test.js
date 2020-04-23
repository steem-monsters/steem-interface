const ss = require('./steem-interface');

start();

async function start() { 
	ss.init();

	// This should throw an error due to invalid key
	ss.sendSignedTx({"ref_block_num":50583,"ref_block_prefix":3962697594,"expiration":"2020-04-23T16:27:42","operations":[["custom_json",{"required_auths":[],"required_posting_auths":["yabapmatt"],"id":"test","json":"{ \"test\": 1 }"}]],"extensions":[],"signatures":["207d00c7744bff84a0e5bad4df0ad4f1f190caec3c7c4f741df27277cca6e9b5543b22fc2dbd74af1680d7553bcdd06ab1983947999db2dc7dfff7ae45d05d35fe"]})
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