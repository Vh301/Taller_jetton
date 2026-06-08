import { Address } from "@ton/core";

export type RefundSafetyReport = {
  step: string;
  network: string;
  networkGlobalId: number;
  master: string;
  adminDeployWallet: string;
  holderWallet: string;
  messageValue: string;
  responseDestination: string;
  excessDestination: string;
  refundExcessDestinationSafe: boolean;
  riskTonStuckInMaster: string;
  willSendTx: boolean;
  notes?: string;
};

export function isRefundDestinationSafe(
  destination: Address,
  masterAddress: Address,
  adminWallet: Address,
): boolean {
  if (destination.equals(masterAddress)) {
    return false;
  }
  return destination.equals(adminWallet);
}

export function printRefundSafetyReport(report: RefundSafetyReport): void {
  console.log("\n--- refund / excess safety ---");
  console.log("  Step:", report.step);
  console.log("  Network:", report.network);
  console.log("  networkGlobalId:", report.networkGlobalId);
  console.log("  Master:", report.master);
  console.log("  Admin/deploy wallet:", report.adminDeployWallet);
  console.log("  Holder wallet:", report.holderWallet);
  console.log("  Message value:", report.messageValue);
  console.log("  responseDestination:", report.responseDestination);
  console.log("  excessDestination:", report.excessDestination);
  console.log(
    "  Refund/excess destination safe:",
    report.refundExcessDestinationSafe ? "yes" : "NO",
  );
  console.log("  Risk of TON stuck in master:", report.riskTonStuckInMaster);
  console.log("  Will send tx:", report.willSendTx ? "yes" : "no");
  if (report.notes) {
    console.log("  Notes:", report.notes);
  }
}
