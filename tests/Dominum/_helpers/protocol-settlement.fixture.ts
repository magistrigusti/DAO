import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import {
  Address,
  beginCell,
  Builder,
  Cell,
  Dictionary,
  DictionaryValue,
  Slice,
} from '@ton/core';
import { compile } from '@ton/blueprint';
import { DomWallet } from '../../../wrappers/Dominum/dom/DomWallet';
import { GasPool } from '../../../wrappers/Dominum/pools/GasPool';
import {
  TreasuryPool,
} from '../../../wrappers/Dominum/treasury/TreasuryPool';
import {
  TREASURY_TARGET,
} from '../../../wrappers/Dominum/core/constants';
import {
  DOM_COMPILE,
  DOM_FIXTURE,
  DOM_QUERY,
  DOM_VALUE,
} from './dom-test-values';

const INLINE_CELL: DictionaryValue<Cell> = {
  serialize(src: Cell, builder: Builder) {
    builder.storeSlice(src.beginParse());
  },
  parse(src: Slice) {
    return beginCell().storeSlice(src).endCell();
  },
};

export function protocolDictionary() {
  return Dictionary.empty(
    Dictionary.Keys.BigUint(64),
    INLINE_CELL
  );
}

export function buildRouteCell(opts: {
  sourceWallet: Address;
  sourceQueryId: bigint;
  fromOwner: Address;
  toOwner: Address;
  amount: bigint;
  fee: bigint;
  state: number;
  ackMask: number;
  success?: boolean;
}) {
  const details = beginCell()
    .storeAddress(opts.fromOwner)
    .storeAddress(opts.toOwner)
    .storeCoins(opts.amount)
    .storeCoins(opts.fee)
    .endCell();
  return beginCell()
    .storeAddress(opts.sourceWallet)
    .storeUint(opts.sourceQueryId, 64)
    .storeUint(opts.state, 8)
    .storeUint(opts.ackMask, 8)
    .storeBit(opts.success ?? false)
    .storeRef(details)
    .endCell();
}

export function buildPendingTransferCell(opts: {
  totalSpend: bigint;
  kind: number;
  expectedSender: Address;
}) {
  return beginCell()
    .storeCoins(opts.totalSpend)
    .storeUint(opts.kind, 8)
    .storeAddress(opts.expectedSender)
    .endCell();
}

export function buildSourceReceiptCell(opts: {
  sourceQueryId: bigint;
  success: boolean;
}) {
  return beginCell()
    .storeUint(opts.sourceQueryId, 64)
    .storeBit(opts.success)
    .endCell();
}

type Account = SandboxContract<TreasuryContract>;

export type ProtocolFixture = Awaited<
  ReturnType<typeof createProtocolSettlementFixture>
>;

export async function createProtocolSettlementFixture(
  gasMode: true | false | 'rejecting' = true
) {
  const [walletCode, gasPoolCode, treasuryPoolCode] =
    await Promise.all([
      compile(DOM_COMPILE.wallet),
      compile(DOM_COMPILE.gasPool),
      compile(DOM_COMPILE.treasuryPool),
    ]);
  const blockchain = await Blockchain.create();
  const treasuryOwner = await blockchain.treasury('protocol-owner');
  const treasuryManager = await blockchain.treasury('protocol-manager');
  const master = await blockchain.treasury('protocol-master');
  const sourceOwner = await blockchain.treasury('protocol-source');
  const recipient = await blockchain.treasury('protocol-recipient');
  const outsider = await blockchain.treasury('protocol-outsider');
  const bankDao = await blockchain.treasury('protocol-bank-dao');
  const bankDefi = await blockchain.treasury('protocol-bank-defi');
  const bankDominum = await blockchain.treasury('protocol-bank-dom');
  const treasuryWallet = await blockchain.treasury('protocol-wallet');
  const fakeGasPool = await blockchain.treasury('protocol-fake-gas');
  const rejectingGasPool = blockchain.openContract(
    DomWallet.createFromConfig(
      {
        balance: 0n,
        ownerAddress: outsider.address,
        masterAddress: master.address,
        treasuryPoolAddress: outsider.address,
        jettonWalletCode: walletCode,
      },
      walletCode
    )
  );
  if (gasMode === 'rejecting') {
    await rejectingGasPool.sendDeploy(
      outsider.getSender(),
      DOM_VALUE.deploySmall
    );
  }
  const initialGasAddress = gasMode === true
    ? outsider.address
    : gasMode === 'rejecting'
      ? rejectingGasPool.address
      : fakeGasPool.address;
  const treasuryPool = blockchain.openContract(
    TreasuryPool.createFromConfig(
      {
        ownerAddress: treasuryOwner.address,
        treasuryManagerAddress: treasuryManager.address,
        jettonWalletAddress: treasuryWallet.address,
        walletConfigured: false,
        bankDaoAddress: bankDao.address,
        bankDefiAddress: bankDefi.address,
        bankDominumAddress: bankDominum.address,
        gasPoolAddress: initialGasAddress,
        masterAddress: master.address,
        jettonWalletCode: walletCode,
        masterConfigured: true,
      },
      treasuryPoolCode
    )
  );
  await treasuryPool.sendDeploy(
    treasuryOwner.getSender(),
    DOM_VALUE.deployTreasuryPool
  );
  const gasPool = blockchain.openContract(
    GasPool.createFromConfig(
      {
        treasuryPoolAddress: treasuryPool.address,
        masterAddress: master.address,
        jettonWalletCode: walletCode,
        masterConfigured: true,
      },
      gasPoolCode
    )
  );
  if (gasMode === true) {
    await gasPool.sendDeploy(
      treasuryOwner.getSender(),
      DOM_VALUE.deployGasPool
    );
    await treasuryPool.sendReplaceAddressRequest(
      treasuryManager.getSender(),
      {
        value: DOM_VALUE.config,
        targetKind: TREASURY_TARGET.gasPool,
        oldAddress: outsider.address,
        newAddress: gasPool.address,
        queryId: DOM_QUERY.treasuryAddressRequest,
      }
    );
    await treasuryPool.sendConfirmRequest(
      treasuryOwner.getSender(),
      {
        value: DOM_VALUE.config,
        queryId: DOM_QUERY.treasuryAddressConfirm,
      }
    );
  }
  const sourceWallet = blockchain.openContract(
    DomWallet.createFromConfig(
      {
        balance: 0n,
        ownerAddress: sourceOwner.address,
        masterAddress: master.address,
        treasuryPoolAddress: treasuryPool.address,
        jettonWalletCode: walletCode,
      },
      walletCode
    )
  );
  await sourceWallet.sendDeploy(
    sourceOwner.getSender(),
    DOM_VALUE.deploySmall
  );
  await sourceWallet.sendInternalTransfer(
    master.getSender(),
    {
      value: DOM_VALUE.deploySmall,
      amount: DOM_FIXTURE.walletInitialBalance,
      fromOwner: master.address,
      queryId: DOM_QUERY.masterMint,
    }
  );
  const walletForOwner = (ownerAddress: Address) => {
    const wallet = DomWallet.createFromConfig(
      {
        balance: 0n,
        ownerAddress,
        masterAddress: master.address,
        treasuryPoolAddress: treasuryPool.address,
        jettonWalletCode: walletCode,
      },
      walletCode
    );
    return blockchain.openContract(
      DomWallet.createFromAddress(wallet.address)
    );
  };
  return {
    blockchain,
    walletCode,
    gasPoolCode,
    treasuryPoolCode,
    treasuryPool,
    gasPool,
    sourceWallet,
    walletForOwner,
    treasuryOwner,
    treasuryManager,
    master,
    sourceOwner,
    recipient,
    outsider,
    fakeGasPool,
    rejectingGasPool,
  } as const;
}

export async function deployWalletWithAuthority(opts: {
  blockchain: Blockchain;
  walletCode: Cell;
  authority: Account;
  owner: Account;
  master: Account;
}) {
  const wallet = opts.blockchain.openContract(
    DomWallet.createFromConfig(
      {
        balance: 0n,
        ownerAddress: opts.owner.address,
        masterAddress: opts.master.address,
        treasuryPoolAddress: opts.authority.address,
        jettonWalletCode: opts.walletCode,
      },
      opts.walletCode
    )
  );
  await wallet.sendDeploy(
    opts.owner.getSender(),
    DOM_VALUE.deploySmall
  );
  return wallet;
}
