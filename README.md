# Steem Interface
An interface to the Steem blockchain which supports multi-node redundancy for high availability systems.

## Installation

```
npm install steem-interface
```

## Usage

```
const steem_interface = require('steem-interface');

steem_interface.init();
steem_interface.stream({ on_op: onOperation });
```

## Methods

### Init
Initialize the library and connect to the RPC nodes. Calling init() with no parameters will initialize with the default options, or you can specify an options object as shown below.

```
steem_interface.init({
  logging_level: 3,   // Level of console logging. 1 = minimal, 4 = full
	rpc_error_limit: 5,   // The number of errors responses from an RPC node in a 1 minute period before it's disabled for an hour
	rpc_nodes: ["https://api.steemit.com", "https://anyx.io", "https://rpc.usesteem.com"],  // Array of RPC node URLs
	save_state: saveState,  // Function to call to save the last block read to persistent storage. The last block number will be passed as a function parameter.
	load_state: loadState   // Function to call to load the last block from persistent storage so the app can pick up from where it left off after a downtime
});
```

### Stream
Streams blocks from the blockchain as they come in.

```
steem_interface.stream({ 
  on_op: onOperation,   // Function to call every time a new operation is received
  on_block: onBlock     // Function to call every time a new block is received
});

function onBlock(block) { ... }
function onOperation(op, block_num, block_id, previous_block_id, transaction_id, block_time) { ... }
```

### Api
Make a database API to the Steem RPC node(s).

```
steem_interface.api(method_name, params)
  .then(result => console.log(result))
  .catch(err => console.log(err));
```

### Broadcast
Broadcast a transaction to the Steem blockchain.

```
steem_interface.broadcast(method_name, params, key)
  .then(result => console.log(result))
  .catch(err => console.log(err));
```

### Transfer
Helper function to broadcast a transfer operation. Note that amount must be in the format `#.### [STEEM|SBD]`.

```
steem_interface.transfer(from, to, amount, memo, key);
```

### Custom JSON
Helper function to broadcast a custom_json operation. This function will retry the transaction up to 3 times if it fails after a delay to deal with the one custom_json transaction per account per block restriction on the Steem blockchain. After HF21 (scheduled for August, 2019) this limit will be increased
to 5 custom_json transactions per account per block so this may no longer be necessary.

```
steem_interface.custom_json(id, json, account, key, use_active);
```
