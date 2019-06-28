const utils = require('./utils');
const config = require('./config');
const dsteem = require('dsteem');

var clients = config.rpc_nodes.map(n => new dsteem.Client(n, { timeout: 1000 }));

function get_client() { return clients.find(c => !c.sm_disabled); }

async function database(method_name, params) {
	var result = null;

	for(var i = 0; i < clients.length; i++) {
		if(clients[i].sm_disabled) {
			// Check how recently the node was disabled and re-enable if it's been over an hour
			if(clients[i].sm_last_error_date > Date.now() - 60 * 60 * 1000)
				continue;
			else
				clients[i].sm_disabled = false;
		}

		result = await tryDatabaseCall(clients[i], method_name, params);

		if(result.success)
			return result.result;
	}
	
	utils.log('All nodes failed calling [' + method_name + ']!', 1, 'Red');
	return result;
}

async function tryDatabaseCall(client, method_name, params) {
	return await client.database.call(method_name, params)
		.then(async result => { return { success: true, result: result } })
		.catch(async err => { 
			utils.log('Error calling [' + method_name + '] from node: ' + client.address + ', Error: ' + err, 1, 'Yellow');

			// Record that this client had an error
			updateClientErrors(client);

			return { success: false, error: err } 
		});
}

async function broadcast(op_name, params, key) {
	var op = [op_name, params];

	return await get_client().broadcast.sendOperations([op], dsteem.PrivateKey.fromString(key))
		.then(async result => { return { success: true, result: result } })
		.catch(async err => { 
			utils.log('Error broadcasting operation [' + op_name + '] from node: ' + client.address + ', Error: ' + err, 1, 'Yellow');
			return { success: false, error: err } 
		});
}

function updateClientErrors(client) {
	// Check if the client has had errors within the last 10 minutes
	if(client.sm_last_error_date && client.sm_last_error_date > Date.now() - 10 * 60 * 1000)
		client.sm_errors++;	
	else
		client.sm_errors = 1;

	client.sm_last_error_date = Date.now();

	if(client.sm_errors >= config.rpc_error_limit) {
		utils.log('Disabling node: ' + client.address + ' due to too many errors!', 1, 'Red');
		client.sm_disabled = true;
	}

	// If all clients have been disabled, we're in trouble, but just try re-enabling them all
	if(!clients.find(c => !c.sm_disabled)) {
		utils.log('All clients disabled!!! Re-enabling them...', 1, 'Red');
		clients.forEach(c => c.sm_disabled = false);
	}
}

let json_queue = [];
check_json_queue();

async function queue_custom_json(id, json, use_active) {
	return new Promise(resolve => json_queue.push({ id, json, use_active, resolve }));
}

async function check_json_queue() {
	while(json_queue.length > 0) {
		let op = json_queue.shift();
		op.resolve(await custom_json(op.id, op.json, op.use_active));
	}

	setTimeout(check_json_queue, 3000);
}

async function custom_json(id, json, use_active, retries) {
	if(!retries)
		retries = 0;

	var data = {
		id: id, 
		json: JSON.stringify(json),
		required_auths: use_active ? [config.account] : [],
		required_posting_auths: use_active ? [] : [config.account]
	}

	return await get_client().broadcast.json(data, dsteem.PrivateKey.fromString(use_active ? config.active_key : config.posting_key))
		.then(r => {
			utils.log(`Custom JSON [${id}] broadcast successfully.`);
			return r;
		})
		.catch(async err => {
			log(`Error broadcasting custom_json [${id}]. Error: ${err}`, 2, 'Yellow');

			if(retries < 3)
				return await custom_json(id, json, use_active, retries + 1);
			else
				log(`Broadcasting custom_json [${id}] failed! Error: ${err}`, 1, 'Red');
		});
}

async function transfer(to, amount, memo) {
	return await get_client().broadcast.transfer({ to, from: config.account, amount, memo}, dsteem.PrivateKey.fromString(config.active_key))
		.then(r => {
			utils.log(`Transfer of ${amount} sent to @${to}.`);
			return r;
		})
		.catch(err => utils.log(`Error sending transfer of ${amount} to @${to}. Error: ${err}`));
}

module.exports = {
	database,
	broadcast,
	queue_custom_json,
	transfer
}