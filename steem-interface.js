const utils = require('./utils');
const dsteem = require('dsteem');

let _options = {};
let clients = [];

function init(options) {
	_options = Object.assign(_options, options);
	utils.set_options(_options);
	clients = _options.rpc_nodes.map(n => new dsteem.Client(n, { timeout: 1000 }));
}

async function api(method_name, params) {
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

async function broadcast(method_name, params, key) {
	return new Promise(async (resolve, reject) => {
		for(let i = 0; i < clients.length; i++) {
			if(clients[i].sm_disabled) {
				// Check how recently the node was disabled and re-enable if it's been over an hour
				if(clients[i].sm_last_error_date > Date.now() - 60 * 60 * 1000)
					continue;
				else
					clients[i].sm_disabled = false;
			}

			try {
				let result = await trySteemBroadcast(clients[i], method_name, params, key);

				if(result.success)
					resolve(result.result);
				else
					reject(result.result);

				return;
			} catch { }
		}
		
		utils.log(`All nodes failed broadcasting [${method_name}]!`, 1, 'Red');
		reject();
	});
}

async function trySteemBroadcast(client, method_name, params, key) {
	return new Promise(async (resolve, reject) => {
		client.broadcast.sendOperations([[method_name, params]], dsteem.PrivateKey.fromString(key))
			.then(result => resolve({ success: true, result }))
			.catch(err => { 
				utils.log(`Error calling [${method_name}] from node: ${client.address}, Error: ${err}`, 1, 'Yellow');

				// If it's an RPC error it means the node is working ok but the transaction was bad
				if(err && err.name == 'RPCError') {
					resolve({ success: false, result: err });
					return;
				}

				// Record that this client had an error
				updateClientErrors(client);
				reject(err);
			});
	});
}

function updateClientErrors(client) {
	// Check if the client has had errors within the last 10 minutes
	if(client.sm_last_error_date && client.sm_last_error_date > Date.now() - 10 * 60 * 1000)
		client.sm_errors++;	
	else
		client.sm_errors = 1;

	client.sm_last_error_date = Date.now();

	if(client.sm_errors >= _options.rpc_error_limit) {
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

async function custom_json(id, json, account, key, use_active) {
	return new Promise(resolve => json_queue.push({ id, json, account, key, use_active, resolve }));
}

async function check_json_queue() {
	while(json_queue.length > 0) {
		let op = json_queue.shift();
		op.resolve(await send_custom_json(op.id, op.json, op.account, op.key, op.use_active));
	}

	setTimeout(check_json_queue, 3000);
}

async function send_custom_json(id, json, account, key, use_active, retries) {
	if(!retries)
		retries = 0;

	var data = {
		id: id, 
		json: JSON.stringify(json),
		required_auths: use_active ? [account] : [],
		required_posting_auths: use_active ? [] : [account]
	}

	return await broadcast('custom_json', data, config.key)
		.then(r => {
			utils.log(`Custom JSON [${id}] broadcast successfully.`, 3);
			return r;
		})
		.catch(async err => {
			utils.log(`Error broadcasting custom_json [${id}]. Error: ${err}`, 2, 'Yellow');

			if(retries < 3)
				return await send_custom_json(id, json, use_active, retries + 1);
			else
			utils.log(`Broadcasting custom_json [${id}] failed! Error: ${err}`, 1, 'Red');
		});
}

async function transfer(from, to, amount, memo, key) {
	return await broadcast('transfer', { amount, from, memo, to }, key);
}

module.exports = {
	init,
	api,
	broadcast,
	custom_json,
	transfer
}