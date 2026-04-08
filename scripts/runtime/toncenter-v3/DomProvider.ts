import {
  Address,
  Cell,
  Contract,
  ContractState,
  openContract,
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

    throw new Error('intractive inputAddress isnot implemented: ${message}');
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
    private readonly uiTmpl: UIProvider
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
        this.uiTmpl.clearActionPrompt();
        this.uiTmpl.write(
          `Contract deployed at ${address.toString({ testOnly: this.networkType === 'testnet'})}`
        );
        return;
      }

      await sleep(sleepDuration);
    }

    this.uiTmpl.clearActionPrompt();
    throw new Error(`Deploy timeout for ${address.toString()}`);
  }

  async waitForLastTransaction(attempts = 60, sleepDuration = 2_000): Promise<void> {
    
  }
}