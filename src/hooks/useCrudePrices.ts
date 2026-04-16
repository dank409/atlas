import { useEffect, useMemo, useState } from "react";
import { loadCrudePriceSnapshot } from "../services/eiaPrices";
import { loadDmeOmanSnapshot } from "../services/dmeOman";
import { loadMurbanSnapshot } from "../services/murban";
import {
  buildBrentWtiSpreadHistory,
  buildCrudeMarketSummary
} from "../utils/marketSummary";
import type {
  BrentWtiSpreadHistory,
  CrudeMarketSummary,
  CrudePriceSnapshot,
  DmeOmanSnapshot,
  MurbanSnapshot
} from "../types/Market";

interface UseCrudePricesResult {
  error: Error | null;
  isLoading: boolean;
  snapshot: CrudePriceSnapshot | null;
  dmeOmanSnapshot: DmeOmanSnapshot | null;
  murbanSnapshot: MurbanSnapshot | null;
  spreadHistory: BrentWtiSpreadHistory | null;
  summary: CrudeMarketSummary | null;
}

export function useCrudePrices(): UseCrudePricesResult {
  const [snapshot, setSnapshot] = useState<CrudePriceSnapshot | null>(null);
  const [dmeOmanSnapshot, setDmeOmanSnapshot] = useState<DmeOmanSnapshot | null>(
    null
  );
  const [murbanSnapshot, setMurbanSnapshot] = useState<MurbanSnapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function fetchSnapshots() {
      try {
        const [crudeResult, dmeOmanResult, murbanResult] = await Promise.allSettled([
          loadCrudePriceSnapshot(),
          loadDmeOmanSnapshot(),
          loadMurbanSnapshot()
        ]);

        if (!isActive) {
          return;
        }

        if (crudeResult.status === "rejected") {
          throw crudeResult.reason instanceof Error
            ? crudeResult.reason
            : new Error("Failed to load crude prices");
        }

        setSnapshot(crudeResult.value);
        setDmeOmanSnapshot(
          dmeOmanResult.status === "fulfilled" ? dmeOmanResult.value : null
        );
        setMurbanSnapshot(
          murbanResult.status === "fulfilled" ? murbanResult.value : null
        );
        setError(null);
      } catch (nextError) {
        if (!isActive) {
          return;
        }

        setError(
          nextError instanceof Error
            ? nextError
            : new Error("Failed to load crude prices")
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    fetchSnapshots();

    return () => {
      isActive = false;
    };
  }, []);

  const summary = useMemo(() => {
    if (!snapshot) {
      return null;
    }

    return buildCrudeMarketSummary({
      crude: snapshot,
      dmeOman: dmeOmanSnapshot,
      murban: murbanSnapshot
    });
  }, [snapshot, dmeOmanSnapshot, murbanSnapshot]);

  const spreadHistory = useMemo(() => {
    if (!snapshot) {
      return null;
    }

    return buildBrentWtiSpreadHistory(snapshot);
  }, [snapshot]);

  return {
    error,
    isLoading,
    snapshot,
    dmeOmanSnapshot,
    murbanSnapshot,
    spreadHistory,
    summary
  };
}
