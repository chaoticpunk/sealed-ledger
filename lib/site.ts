export const SITE = {
  name: "Sealed Ledger",
  tagline: "Private expense audit, proven in a TEE.",
  docsUrl: "https://docs.near.ai/cloud/quickstart",
  modelsUrl: "https://docs.near.ai/cloud/models",
  verificationUrl: "https://cloud.near.ai/verify",
  intelExplorerUrl: "https://proof.t16z.com/",
  repoUrl:
    process.env.NEXT_PUBLIC_REPO_URL?.trim() ||
    "https://github.com/chaoticpunk/sealed-ledger",
  hackathonUrl: "https://nearhackathon.com",
};
