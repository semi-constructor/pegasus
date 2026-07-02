import "next-auth/adapters";

declare module "next-auth/adapters" {
  export type AdapterAccountType = "oauth" | "email" | "credentials" | "oidc" | "webauthn";
}
