import {
  Address,
  Cell,
  Contract,
  ContractState,
  OpenedContract,
  openContract,
  StateInit,
} from '@ton/core';
import {
  NetworkProvider,
  SenderWithSendResult,
  UIProvider,
} from '@ton/blueprint';
import type { Explorer } from '@ton/blueprint/dist/network/Explorer';
import type { Network } from '@ton/blueprint/dist/network/Network';

import { ToncenterV3Client } from './ToncenterV3Client';
import { ToncenterV3ContractProvider } from './ToncenterV3ContractProvider';
import { QrSender } from './QrSender';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeInit(
  init: StateInit | null | undefined
): { code?: Cell; data?: Cell } | undefined {
  if (!init) {
    return undefined;
  }

  return {
    code: init.code ?? undefined,
    data: init.data ?? undefined,
  };
}

class ConsoleUiProvider implements UIProvider {
  write(message: string): void {
    console.log(message);
  }

  async prompt(message: string): Promise<boolean> {
    throw new Error(`Interactive prompt is not implemented: ${message}`);
  }

  async inputAddress(message: string, fallback?: Address): Promise<Address> {
    if (fallback) {
      return fallback;
    }

    throw new Error(`Interactive inputAddress is not implemented: ${message}`);
  }

  async input(message: string): Promise<string> {
    throw new Error(`Interactive input is not implemented: ${message}`);
  }

  async choose<T>(message: string, choices: T[], _display: (v: T) => string): Promise<T> {
    if (choices.length === 0) {
      throw new Error(`No choices provided: ${message}`);
    }

    return choices[0];
  }

  setActionPrompt(message: string): void {
    console.log(message);
  }

  clearActionPrompt(): void {}
}

export class DomProvider implements NetworkProvider {
  constructor(
    private readonly client: ToncenterV3Client,
    private readonly senderImpl: QrSender,
    private readonly networkType: Network,
    private readonly explorerType: Explorer,
    private readonly uiImpl: UIProvider
  ) {}

  network(): Network {
    return this.networkType;
  }

  explorer(): Explorer {
    return this.explorerType;
  }

  sender(): SenderWithSendResult {
    return this.senderImpl;
  }

  api(): any {
    return this.client;
  }

  provider(address: Address, init?: { code?: Cell; data?: Cell }) {
    return new ToncenterV3ContractProvider(this.client, address, init ?? null);
  }

  async isContractDeployed(address: Address): Promise<boolean> {
    return this.client.isContractDeployed(address);
  }

  async getContractState(address: Address): Promise<ContractState> {
    return this.provider(address).getState();
  }

  async waitForDeploy(address: Address, attempts = 60, sleepDuration = 2_000): Promise<void> {
    for (let i = 1; i <= attempts; i++) {
      this.uiImpl.setActionPrompt(`Awaiting deploy ${address.toString()} [${i}/${attempts}]`);

      if (await this.isContractDeployed(address)) {
        this.uiImpl.clearActionPrompt();
        this.uiImpl.write(
          `Contract deployed at ${address.toString({ testOnly: this.networkType === 'testnet' })}`
        );
        return;
      }

      await sleep(sleepDuration);
    }

    this.uiImpl.clearActionPrompt();
    throw new Error(`Deploy timeout for ${address.toString()}`);
  }

  async waitForLastTransaction(attempts = 60, sleepDuration = 2_000): Promise<void> {
    const marker = this.senderImpl.lastSendResult;
    const senderAddress = this.senderImpl.address;

    if (!marker) {
      throw new Error('No last send result available for waitForLastTransaction');
    }

    if (!senderAddress) {
      throw new Error('Sender address is not available');
    }

    for (let i = 1; i <= attempts; i++) {
      this.uiImpl.setActionPrompt(`Awaiting wallet tx [${i}/${attempts}]`);

      const latestTxs = await this.client.getTransactions(senderAddress, 1);

      if (latestTxs.length > 0) {
        const latest = latestTxs[0];
        const latestLtRaw = latest.lt ?? latest.transaction_id?.lt;
        const latestLt = latestLtRaw !== undefined ? String(latestLtRaw) : null;

        const changedLt =
          marker.beforeLt === null
            ? Boolean(latestLt)
            : (latestLt !== null && BigInt(latestLt) > BigInt(marker.beforeLt));

        if (changedLt) {
          const description = latest.description ?? {};
          const computePhase = description.compute_ph ?? {};
          const actionPhase = description.action ?? {};

          if (description.aborted === true) {
            throw new Error('Wallet transaction was aborted');
          }

          if (computePhase.success === false) {
            throw new Error(
              `Wallet tx compute phase failed: exitCode=${computePhase.exit_code ?? 'unknown'}`
            );
          }

          if (actionPhase.success === false) {
            throw new Error(
              `Wallet tx action phase failed: resultCode=${actionPhase.result_code ?? 'unknown'}`
            );
          }

          this.uiImpl.clearActionPrompt();
          this.uiImpl.write(
            `Wallet transaction applied at lt=${latestLt ?? 'unknown'}`
          );

          await sleep(1500);
          return;
        }
      }

      await sleep(sleepDuration);
    }

    this.uiImpl.clearActionPrompt();
    throw new Error('Transaction timeout while waiting for sender wallet update');
  }

  async getConfig(): Promise<any> {
    throw new Error('getConfig() is not implemented in DomProvider');
  }

  async deploy(contract: Contract, value: bigint, body?: Cell, waitAttempts = 20): Promise<void> {
    if (!('init' in contract) || !contract.init) {
      throw new Error('Contract init is required for deploy()');
    }

    await this.senderImpl.send({
      to: contract.address,
      value,
      init: contract.init,
      body,
    });

    if (waitAttempts > 0) {
      await this.waitForDeploy(contract.address, waitAttempts);
    }
  }

  open<T extends Contract>(contract: T): OpenedContract<T> {
    return openContract(
      contract,
      ({ address, init }) => this.provider(address, normalizeInit(init))
    );
  }

  ui(): UIProvider {
    return this.uiImpl;
  }
}

export async function createDomProvider(): Promise<NetworkProvider> {
  const apiKey = process.env.DOMINUM_TESTNET_API_KEY ?? process.env.TONCENTER_API_KEY ?? '';
  const endpoint = process.env.DOMINUM_TONCENTER_V3_URL ?? 'https://testnet.toncenter.com/api/v3';
  const manifestUrl = process.env.DOMINUM_TONCONNECT_MANIFEST_URL;

  if (!apiKey) {
    throw new Error('DOMINUM_TESTNET_API_KEY or TONCENTER_API_KEY is required');
  }

  const ui = new ConsoleUiProvider();
  const client = new ToncenterV3Client(endpoint, apiKey);

  const sender = await QrSender.create({
    client,
    ui,
    network: 'testnet',
    manifestUrl,
  });

  return new DomProvider(client, sender, 'testnet', 'tonviewer', ui);
}