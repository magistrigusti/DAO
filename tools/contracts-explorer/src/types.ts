export type ContractStatus =
  | "ok"
  | "wip"
  | "draft"
  | "external";

export type ContractLink = {
  id?: string;
  title?: string;
  path?: string;
  status?: ContractStatus;
  label?: string;
};

export type ContractNode = {
  id: string;
  title: string;
  path: string;
  status: ContractStatus;
  summary?: string[];
  ops?: string[];
  links?: ContractLink[];
};

export type ContractSection = {
  id: string;
  title: string;
  nodes: string[];
};

export type ContractGroup = {
  id: string;
  title: string;
  sections: ContractSection[];
};

