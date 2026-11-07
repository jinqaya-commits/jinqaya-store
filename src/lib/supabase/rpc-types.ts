import type { Database } from "@/types/database";

type PublicFunctions = Database["public"]["Functions"];

/**
 * Supabase-generated RPC Args describe PostgreSQL argument types but cannot
 * represent nullable required arguments. Use this only for parameters whose
 * SQL function explicitly handles NULL, while preserving checks for every
 * other argument and the generated RPC return type.
 */
export type RpcArgsWithNullableFields<
  Name extends keyof PublicFunctions,
  NullableKeys extends keyof PublicFunctions[Name]["Args"],
> = Omit<PublicFunctions[Name]["Args"], NullableKeys> & {
  [Key in NullableKeys]: PublicFunctions[Name]["Args"][Key] | null;
};
