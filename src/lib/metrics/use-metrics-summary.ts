"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { toSummaryQuery, type DateRange, type Granularity } from "@/lib/metrics/period";

export function useMetricsSummary(range: DateRange, granularity: Granularity, enabled: boolean) {
  const query = toSummaryQuery(range, granularity);
  return useQuery({
    queryKey: ["metrics-summary", query],
    queryFn: ({ signal }) => unwrap(api.GET("/metrics/summary", { params: { query }, signal })),
    placeholderData: keepPreviousData,
    enabled,
  });
}
