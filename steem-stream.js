const fs = require("fs");
const utils = require('./utils');
var steem_interface = require('./steem-interface');

let last_block = 0;
let options = {
	logging_level: 3,
	rpc_error_limit: 5,
	rpc_nodes: ["https://api.steemit.com", "https://anyx.io", "https://rpc.usesteem.com"],
	save_state: saveState,
	load_state: loadState,
	on_block: null,
	on_op: null
}

start();

function start(config) {
	// Set config settings or use defaults
	options = Object.assign(options, config);

	// Load saved state (last block read)
	if(options.load_state)
		options.load_state();

	// Initialize the Steem interface
	steem_interface.init(options);

	// Start streaming blocks
	getNextBlock();
}

async function getNextBlock() {
	var result = await steem_interface.api('get_dynamic_global_properties');

	if(!result) {
		setTimeout(getNextBlock, 1000);
		return;
	}

	if(last_block == 0)
		last_block = result.head_block_number - 1;

	// We are 20+ blocks behind!
	if(result.head_block_number >= last_block + 20)
		utils.log('Streaming is ' + (result.head_block_number - last_block) + ' blocks behind!', 1, 'Red');

	// If we have a new block, process it
	while(result.head_block_number > last_block)
		await processBlock(last_block + 1);

	// Attempt to load the next block after a 1 second delay (or faster if we're behind and need to catch up)
	setTimeout(getNextBlock, 1000);
}

async function processBlock(block_num) {
	var block = await steem_interface.api('get_block', [block_num]);

	// Log every 1000th block loaded just for easy parsing of logs, or every block depending on logging level
	utils.log('Processing block [' + block_num + ']...', block_num % 1000 == 0 ? 1 : 4);

	if(!block || !block.transactions) {
		// Block couldn't be loaded...this is typically because it hasn't been created yet
		utils.log('Error loading block [' + block_num + ']', 4);
		await utils.timeout(1000);
		return;
	}

	if(options.on_block)
		await options.on_block(block);

	if(options.on_op) {
		var block_time = new Date(block.timestamp + 'Z');

		// Loop through all of the transactions and operations in the block
		for(var i = 0; i < block.transactions.length; i++) {
			var trans = block.transactions[i];

			for(var op_index = 0; op_index < trans.operations.length; op_index++) {
				var op = trans.operations[op_index];
				await on_op(op, block_num, block.block_id, block.previous, block.transaction_ids[i], block_time);
			}
		}
	}

	last_block = block_num;

	if(options.save_state)
		options.save_state();
}

function loadState() {
	// Check if state has been saved to disk, in which case load it
	if (fs.existsSync('state.json')) {
		var state = JSON.parse(fs.readFileSync("state.json"));

		if (state.last_block)
			last_block = state.last_block;

		utils.log('Restored saved state: ' + JSON.stringify(state));
	}
}

function saveState() {
  var state = {
		last_block: last_block
  };

  // Save the state of the bot to disk
  fs.writeFile('state.json', JSON.stringify(state), function (err) {
    if (err)
      utils.log(err);
  });
}