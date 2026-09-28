// Scene registry for s02-s03 (owned by one builder agent).
import type React from "react";
import { S02 } from "./s02";
import { S03 } from "./s03";

export const REG_S02_S03: Record<string, React.FC> = { s02: S02, s03: S03 };
