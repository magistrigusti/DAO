import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

const PENDING_NONE: int = 0;
const PENDING_TON: int = 1;
const PENDING_JETTONS: int = 2;

const OP_CANCEL_PENDING: int = 0x100;

global owner1Address: slice;
global owner2Address: slice;
global walletAddress: slice;

global